import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import {
  buildSecurityHeaders,
  type CspPreset,
  type SecurityHeaderBuildResult,
} from "@/lib/utils/security-header-builder"
import {
  analyzeHttpSecurityHeaders,
  type HttpHeadersAnalysisResult,
  type ParsedHeaders,
} from "@/lib/utils/http-headers"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

type SecurityHeaderWorkbenchResult = SecurityHeaderBuildResult & {
  detailedAnalysis: HttpHeadersAnalysisResult
}

function scoreColor(score: number): string {
  if (score >= 90) return "text-green-600 dark:text-green-400"
  if (score >= 75) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

function parseAllowedOrigins(input: string): string[] {
  const entries = input
    .split(/[\n,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)

  const allowlistKeywords = new Set(["'self'", "'none'", "'unsafe-inline'", "'unsafe-eval'", "data:", "blob:"])
  const urls: string[] = []

  entries.forEach((entry) => {
    if (allowlistKeywords.has(entry)) {
      urls.push(entry)
      return
    }

    try {
      const parsed = new URL(entry)
      if (parsed.protocol !== "https:" && parsed.protocol !== "wss:") {
        throw new Error("Only https:// and wss:// origins are allowed.")
      }
      urls.push(parsed.origin)
    } catch {
      throw new Error(`Invalid origin: ${entry}`)
    }
  })

  return Array.from(new Set(urls)).slice(0, 30)
}

function toLowerHeaderRecord(headers: Record<string, string>): ParsedHeaders {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  )
}

export default function SecurityHeaderBuilderTool() {
  const [preset, setPreset] = useState<CspPreset>("strict")
  const [routeProfile, setRouteProfile] = useState<"global" | "admin" | "api">("global")
  const [reportOnly, setReportOnly] = useState(false)
  const [allowInlineScript, setAllowInlineScript] = useState(false)
  const [allowInlineStyle, setAllowInlineStyle] = useState(false)
  const [allowDataImages, setAllowDataImages] = useState(false)
  const [includeUpgrade, setIncludeUpgrade] = useState(true)
  const [scriptSourcesInput, setScriptSourcesInput] = useState("")
  const [connectSourcesInput, setConnectSourcesInput] = useState("")
  const [reportUri, setReportUri] = useState("")
  const [minimumScore, setMinimumScore] = useState("90")
  const [includeCoep, setIncludeCoep] = useState(false)
  const [requireCrossOriginIsolation, setRequireCrossOriginIsolation] = useState(false)
  const [enforceNoUnsafeInline, setEnforceNoUnsafeInline] = useState(true)
  const [requireNoncePlaceholder, setRequireNoncePlaceholder] = useState(true)
  const [addAdminNoStoreCacheHeaders, setAddAdminNoStoreCacheHeaders] = useState(true)

  const process = (input: string): string => {
    const extraOrigins = parseAllowedOrigins(input)
    const scriptSources = parseAllowedOrigins(scriptSourcesInput)
    const connectSources = parseAllowedOrigins(connectSourcesInput)

    const mergedScriptSources = Array.from(new Set([...scriptSources, ...extraOrigins]))
    const mergedConnectSources = Array.from(new Set([...connectSources, ...extraOrigins]))

    const normalizedReportUri = reportUri.trim()
    if (normalizedReportUri) {
      const reportUrl = new URL(normalizedReportUri)
      if (reportUrl.protocol !== "https:") {
        throw new Error("Report URI must use https://")
      }
    }

    const baseResult = buildSecurityHeaders({
      preset,
      reportOnly,
      reportUri: normalizedReportUri || undefined,
      allowInlineScript,
      allowInlineStyle,
      allowDataImages,
      includeUpgradeInsecureRequests: includeUpgrade,
      scriptSources: mergedScriptSources,
      connectSources: mergedConnectSources,
      frameAncestors: routeProfile === "admin" ? "none" : preset === "strict" ? "none" : "self",
    })

    const headers = { ...baseResult.headers }
    const tradeoffs = [...baseResult.tradeoffs, `Route profile: ${routeProfile}`]

    if (includeCoep) {
      headers["cross-origin-embedder-policy"] = "require-corp"
      tradeoffs.push("Enabled cross-origin-embedder-policy=require-corp for stronger isolation.")
    }

    if (routeProfile === "admin" && addAdminNoStoreCacheHeaders) {
      headers["cache-control"] = "no-store, max-age=0"
      headers.pragma = "no-cache"
      tradeoffs.push("Admin profile added no-store caching controls.")
    }

    const detailedAnalysis = analyzeHttpSecurityHeaders(toLowerHeaderRecord(headers))
    const findings: ToolFinding[] = []

    detailedAnalysis.findings.forEach((finding, index) => {
      if (finding.status === "good") return
      findings.push({
        id: `header-builder-${finding.header}-${index}`,
        severity: finding.status === "bad" ? "high" : "medium",
        confidence: finding.status === "bad" ? 84 : 76,
        category: "header-hardening",
        title: `${finding.header}: ${finding.message}`,
        description: finding.message,
        remediation: finding.recommendation,
      })
    })

    if (enforceNoUnsafeInline && /'unsafe-inline'|'unsafe-eval'/i.test(baseResult.csp)) {
      findings.push({
        id: "header-builder-unsafe-inline",
        severity: "high",
        confidence: 88,
        category: "csp-governance",
        title: "CSP contains unsafe inline/eval directives",
        description: "Policy includes `unsafe-inline` or `unsafe-eval` while strict inline policy is enabled.",
        remediation: "Use nonce/hash based script controls and remove unsafe script/style execution directives.",
      })
    }

    if (requireNoncePlaceholder && !/script-src[^;]*(nonce-|sha256-|sha384-|sha512-)/i.test(baseResult.csp)) {
      findings.push({
        id: "header-builder-missing-nonce-hash",
        severity: "medium",
        confidence: 75,
        category: "csp-governance",
        title: "No nonce/hash strategy in script-src",
        description: "script-src does not include nonce/hash tokens for inline-script governance.",
        remediation: "Adopt nonce/hash approach for dynamic scripts in production deployments.",
      })
    }

    if (reportOnly) {
      findings.push({
        id: "header-builder-report-only",
        severity: "low",
        confidence: 70,
        category: "deployment-mode",
        title: "CSP is configured in report-only mode",
        description: "Policy violations are reported but not blocked.",
        remediation: "Promote to enforcing mode once violation telemetry is stable.",
      })
    }

    if (requireCrossOriginIsolation) {
      const coop = (headers["cross-origin-opener-policy"] ?? "").toLowerCase()
      const coep = (headers["cross-origin-embedder-policy"] ?? "").toLowerCase()
      if (coop !== "same-origin") {
        findings.push({
          id: "header-builder-coop-missing",
          severity: "medium",
          confidence: 77,
          category: "browser-isolation",
          title: "COOP baseline not satisfied",
          description: "cross-origin-opener-policy is not same-origin.",
          remediation: "Set COOP to same-origin on routes requiring process isolation.",
        })
      }
      if (coep !== "require-corp" && coep !== "credentialless") {
        findings.push({
          id: "header-builder-coep-missing",
          severity: "medium",
          confidence: 76,
          category: "browser-isolation",
          title: "COEP baseline not satisfied",
          description: "cross-origin-embedder-policy is missing or weak.",
          remediation: "Use COEP require-corp (or credentialless) for isolation-enabled applications.",
        })
      }
    }

    const target = Math.max(0, Math.min(100, Number(minimumScore) || 90))
    if (detailedAnalysis.score < target) {
      findings.push({
        id: "header-builder-score-under-target",
        severity: detailedAnalysis.score < Math.max(60, target - 15) ? "high" : "medium",
        confidence: 80,
        category: "policy-baseline",
        title: "Generated header set below target score",
        description: `Generated score ${detailedAnalysis.score} is below baseline ${target}.`,
        remediation: "Tighten CSP and missing header controls before using this policy in production.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "Security header policy generated",
      text: `Generated ${Object.keys(headers).length} header(s) with posture score ${detailedAnalysis.score}/100 (${detailedAnalysis.grade}).`,
      findings,
      metrics: {
        score: detailedAnalysis.score,
        headerCount: Object.keys(headers).length,
        missingCritical: detailedAnalysis.missing.length,
        tradeoffCount: tradeoffs.length,
        target,
      },
      baseScore: detailedAnalysis.score,
    })

    const workbenchResult: SecurityHeaderWorkbenchResult = {
      ...baseResult,
      headers,
      tradeoffs,
      detailedAnalysis,
      analysis: {
        score: detailedAnalysis.score,
        grade: detailedAnalysis.grade,
      },
    }

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "Security Header/CSP Builder",
        summary,
        findings,
        evidence: [
          {
            csp: workbenchResult.csp,
            headers: workbenchResult.headers,
            score: detailedAnalysis.score,
            grade: detailedAnalysis.grade,
            tradeoffs: workbenchResult.tradeoffs,
          },
        ],
        recommendations: [
          "Use report-only mode only during staged rollout, then enforce and monitor violations.",
          "Avoid unsafe inline/eval directives and adopt nonce/hash CSP strategy.",
          "Apply stricter route-specific profiles for admin and privileged control planes.",
        ],
        raw: {
          securityHeaders: workbenchResult,
          config: {
            preset,
            routeProfile,
            reportOnly,
            includeCoep,
            requireCrossOriginIsolation,
            enforceNoUnsafeInline,
            requireNoncePlaceholder,
            addAdminNoStoreCacheHeaders,
            target,
          },
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null

    const envelope = parseToolResultEnvelope(output, "Security Header/CSP Builder")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null
    const parsed = raw?.securityHeaders as SecurityHeaderWorkbenchResult | undefined
    const config = raw?.config && typeof raw.config === "object" && raw.config !== null
      ? (raw.config as Record<string, unknown>)
      : null

    if (!parsed) return null

    return (
      <div className="space-y-4">
        <div className="p-3 border rounded bg-muted/20">
          <div className="text-xs uppercase font-bold text-muted-foreground">Estimated Header Posture</div>
          <div className={`text-2xl font-bold ${scoreColor(parsed.detailedAnalysis.score)}`}>
            {parsed.detailedAnalysis.score}/100 ({parsed.detailedAnalysis.grade})
          </div>
          {config && (
            <div className="text-xs text-muted-foreground mt-1">
              Preset: {String(config.preset)} | Route: {String(config.routeProfile)} | Target: {String(config.target ?? "90")}
            </div>
          )}
        </div>

        <div className="p-3 border rounded bg-muted/20 space-y-2">
          <h3 className="text-sm font-semibold">Content-Security-Policy</h3>
          <pre className="text-xs font-mono whitespace-pre-wrap break-all">{parsed.csp}</pre>
        </div>

        <div className="p-3 border rounded bg-muted/20 space-y-2">
          <h3 className="text-sm font-semibold">Generated Headers</h3>
          <ul className="text-xs space-y-2">
            {Object.entries(parsed.headers).map(([name, value]) => (
              <li key={name}>
                <div className="font-mono font-semibold">{name}</div>
                <div className="font-mono text-muted-foreground break-all">{value}</div>
              </li>
            ))}
          </ul>
        </div>

        {parsed.tradeoffs.length > 0 && (
          <div className="p-3 border rounded bg-muted/20">
            <h3 className="text-sm font-semibold mb-2">Tradeoffs</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              {parsed.tradeoffs.map((note, index) => (
                <li key={index}>• {note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <ToolTemplate
      toolName="Security Header/CSP Builder"
      description="Generate security header policies with enterprise governance controls and deployability scoring."
      actionLabel="Generate Policy"
      placeholder="Optional: extra trusted origins (one per line), e.g. https://cdn.example.com"
      requiresInput={false}
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="header-builder-preset">Preset</Label>
            <select
              id="header-builder-preset"
              className="w-full rounded border bg-background px-2 py-2 text-sm"
              value={preset}
              onChange={(event) => setPreset(event.target.value as CspPreset)}
            >
              <option value="strict">Strict</option>
              <option value="balanced">Balanced</option>
              <option value="compat">Compatibility</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="header-builder-route-profile">Route Profile</Label>
            <select
              id="header-builder-route-profile"
              className="w-full rounded border bg-background px-2 py-2 text-sm"
              value={routeProfile}
              onChange={(event) => {
                const value = event.target.value
                if (value === "global" || value === "admin" || value === "api") {
                  setRouteProfile(value)
                }
              }}
            >
              <option value="global">Global site policy</option>
              <option value="admin">Admin console route</option>
              <option value="api">API route profile</option>
            </select>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Target score baseline</Label>
              <Input
                value={minimumScore}
                onChange={(event) => setMinimumScore(event.target.value)}
                placeholder="90"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="csp-report-uri">Report URI (optional)</Label>
              <Input
                id="csp-report-uri"
                value={reportUri}
                onChange={(event) => setReportUri(event.target.value)}
                placeholder="https://security.example.com/csp-report"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Additional script-src sources (optional)</Label>
            <textarea
              className="w-full min-h-[80px] rounded border bg-background px-2 py-2 text-xs font-mono"
              value={scriptSourcesInput}
              onChange={(event) => setScriptSourcesInput(event.target.value)}
              placeholder="https://cdn.example.com"
            />
          </div>

          <div className="space-y-1">
            <Label>Additional connect-src sources (optional)</Label>
            <textarea
              className="w-full min-h-[80px] rounded border bg-background px-2 py-2 text-xs font-mono"
              value={connectSourcesInput}
              onChange={(event) => setConnectSourcesInput(event.target.value)}
              placeholder="https://api.example.com"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="csp-report-only">Report-only mode</Label>
              <Switch id="csp-report-only" checked={reportOnly} onChange={(event) => setReportOnly(event.target.checked)} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="csp-inline-script">Allow inline scripts</Label>
              <Switch id="csp-inline-script" checked={allowInlineScript} onChange={(event) => setAllowInlineScript(event.target.checked)} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="csp-inline-style">Allow inline styles</Label>
              <Switch id="csp-inline-style" checked={allowInlineStyle} onChange={(event) => setAllowInlineStyle(event.target.checked)} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="csp-data-images">Allow data: images</Label>
              <Switch id="csp-data-images" checked={allowDataImages} onChange={(event) => setAllowDataImages(event.target.checked)} />
            </div>
            <div className="flex items-center justify-between gap-2 sm:col-span-2">
              <Label htmlFor="csp-upgrade">Enable upgrade-insecure-requests</Label>
              <Switch id="csp-upgrade" checked={includeUpgrade} onChange={(event) => setIncludeUpgrade(event.target.checked)} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="csp-include-coep" className="text-sm">Include COEP header</Label>
              <Switch id="csp-include-coep" checked={includeCoep} onChange={(event) => setIncludeCoep(event.target.checked)} />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="csp-require-isolation" className="text-sm">Require cross-origin isolation</Label>
              <Switch id="csp-require-isolation" checked={requireCrossOriginIsolation} onChange={(event) => setRequireCrossOriginIsolation(event.target.checked)} />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="csp-enforce-no-unsafe" className="text-sm">Disallow unsafe-inline/eval</Label>
              <Switch id="csp-enforce-no-unsafe" checked={enforceNoUnsafeInline} onChange={(event) => setEnforceNoUnsafeInline(event.target.checked)} />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="csp-require-nonce" className="text-sm">Require nonce/hash strategy</Label>
              <Switch id="csp-require-nonce" checked={requireNoncePlaceholder} onChange={(event) => setRequireNoncePlaceholder(event.target.checked)} />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 sm:col-span-2">
              <Label htmlFor="csp-admin-no-store" className="text-sm">Add no-store cache headers on admin profile</Label>
              <Switch id="csp-admin-no-store" checked={addAdminNoStoreCacheHeaders} onChange={(event) => setAddAdminNoStoreCacheHeaders(event.target.checked)} />
            </div>
          </div>
        </div>
      }
      examples={[
        "https://cdn.jsdelivr.net\nhttps://www.googletagmanager.com",
      ]}
    />
  )
}
