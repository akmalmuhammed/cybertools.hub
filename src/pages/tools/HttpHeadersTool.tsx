import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import {
  analyzeHttpSecurityHeaders,
  parseHttpHeaders,
  type HttpHeadersAnalysisResult,
  type ParsedHeaders,
} from "@/lib/utils/http-headers"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding, ToolFindingSeverity } from "@/types/tool.types"

function scoreColor(score: number): string {
  if (score >= 90) return "text-green-600 dark:text-green-400"
  if (score >= 70) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

function findingSeverity(status: "good" | "warn" | "bad", header: string): ToolFindingSeverity {
  if (status === "good") return "info"
  if (status === "warn") return "medium"
  return header === "content-security-policy" || header === "strict-transport-security" ? "high" : "medium"
}

export default function HttpHeadersTool() {
  const [targetScore, setTargetScore] = useState("85")
  const [maxMissingCritical, setMaxMissingCritical] = useState("0")
  const [includePassingChecks, setIncludePassingChecks] = useState(false)
  const [requireHstsPreload, setRequireHstsPreload] = useState(true)
  const [requireCrossOriginIsolation, setRequireCrossOriginIsolation] = useState(false)
  const [flagServerBanner, setFlagServerBanner] = useState(true)
  const [requireStrictPermissionsPolicy, setRequireStrictPermissionsPolicy] = useState(false)
  const [flagLegacyXssHeader, setFlagLegacyXssHeader] = useState(true)

  const process = (input: string) => {
    const parsedHeaders = parseHttpHeaders(input)
    const analysis = analyzeHttpSecurityHeaders(parsedHeaders)
    const findings: ToolFinding[] = []

    analysis.findings.forEach((finding, index) => {
      if (!includePassingChecks && finding.status === "good") return
      findings.push({
        id: `http-header-${finding.header}-${index}`,
        severity: findingSeverity(finding.status, finding.header),
        confidence: finding.status === "good" ? 66 : finding.status === "warn" ? 74 : 82,
        category: "http-header-hardening",
        title: `${finding.header}: ${finding.message}`,
        description: finding.message,
        remediation: finding.recommendation,
      })
    })

    const hsts = (parsedHeaders["strict-transport-security"] ?? "").toLowerCase()
    if (requireHstsPreload && hsts && !hsts.includes("preload")) {
      findings.push({
        id: "http-hsts-preload-missing",
        severity: "low",
        confidence: 71,
        category: "transport-security",
        title: "HSTS preload flag missing",
        description: "HSTS is present but does not include preload token.",
        remediation: "Add preload once domain is ready and submit to HSTS preload list governance workflow.",
      })
    }

    if (requireCrossOriginIsolation) {
      const coop = (parsedHeaders["cross-origin-opener-policy"] ?? "").trim().toLowerCase()
      const coep = (parsedHeaders["cross-origin-embedder-policy"] ?? "").trim().toLowerCase()
      if (coop !== "same-origin") {
        findings.push({
          id: "http-coop-missing",
          severity: "medium",
          confidence: 77,
          category: "browser-isolation",
          title: "COOP baseline not met",
          description: "cross-origin-opener-policy is not set to same-origin.",
          remediation: "Set COOP to same-origin for stronger tab/process isolation where compatible.",
        })
      }
      if (coep !== "require-corp" && coep !== "credentialless") {
        findings.push({
          id: "http-coep-missing",
          severity: "medium",
          confidence: 76,
          category: "browser-isolation",
          title: "COEP baseline not met",
          description: "cross-origin-embedder-policy is missing or weak.",
          remediation: "Use COEP require-corp (or credentialless where needed) for isolation-sensitive applications.",
        })
      }
    }

    if (flagServerBanner) {
      if (parsedHeaders.server) {
        findings.push({
          id: "http-server-banner-exposed",
          severity: "low",
          confidence: 72,
          category: "information-disclosure",
          title: "Server banner exposed",
          description: `Server header present: ${parsedHeaders.server}`,
          remediation: "Remove or minimize server version disclosure in edge and app responses.",
        })
      }
      if (parsedHeaders["x-powered-by"]) {
        findings.push({
          id: "http-x-powered-by-exposed",
          severity: "low",
          confidence: 72,
          category: "information-disclosure",
          title: "X-Powered-By header exposed",
          description: `x-powered-by present: ${parsedHeaders["x-powered-by"]}`,
          remediation: "Suppress framework signature headers in production.",
        })
      }
    }

    if (requireStrictPermissionsPolicy) {
      const permissionsPolicy = parsedHeaders["permissions-policy"] ?? ""
      if (!permissionsPolicy) {
        findings.push({
          id: "http-permissions-policy-missing-policy",
          severity: "medium",
          confidence: 79,
          category: "browser-feature-governance",
          title: "Permissions-Policy required but missing",
          description: "Policy requires explicit Permissions-Policy header but none was found.",
          remediation: "Declare restrictive Permissions-Policy for sensitive browser features.",
        })
      } else if (permissionsPolicy.includes("*")) {
        findings.push({
          id: "http-permissions-policy-wildcard",
          severity: "medium",
          confidence: 74,
          category: "browser-feature-governance",
          title: "Permissions-Policy contains wildcard grants",
          description: "Detected wildcard capability grants in Permissions-Policy.",
          remediation: "Replace wildcard grants with explicit deny-by-default feature declarations.",
        })
      }
    }

    if (flagLegacyXssHeader) {
      const xssProtection = (parsedHeaders["x-xss-protection"] ?? "").trim().toLowerCase()
      if (xssProtection && xssProtection !== "0") {
        findings.push({
          id: "http-legacy-xss-header",
          severity: "low",
          confidence: 69,
          category: "legacy-controls",
          title: "Legacy X-XSS-Protection header detected",
          description: `x-xss-protection=${xssProtection}`,
          remediation: "Prefer modern CSP controls and disable obsolete browser XSS filters when unsupported.",
        })
      }
    }

    const target = Math.max(0, Math.min(100, Number(targetScore) || 85))
    if (analysis.score < target) {
      findings.push({
        id: "http-score-under-target",
        severity: analysis.score < Math.max(55, target - 20) ? "high" : "medium",
        confidence: 80,
        category: "policy-baseline",
        title: "Header posture score below baseline",
        description: `Score ${analysis.score} is below target baseline ${target}.`,
        remediation: "Address missing and warning headers before release promotion.",
      })
    }

    const missingLimit = Math.max(0, Number(maxMissingCritical) || 0)
    if (analysis.missing.length > missingLimit) {
      findings.push({
        id: "http-missing-critical-over-limit",
        severity: analysis.missing.length > missingLimit + 2 ? "high" : "medium",
        confidence: 77,
        category: "policy-baseline",
        title: "Missing critical headers exceed policy threshold",
        description: `Missing critical count is ${analysis.missing.length}, configured max is ${missingLimit}.`,
        remediation: "Close missing-header gaps or document approved exceptions before deployment.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "HTTP header analysis completed",
      text: `Analyzed ${Object.keys(parsedHeaders).length} header(s); posture score ${analysis.score}/100 (${analysis.grade}).`,
      findings,
      metrics: {
        score: analysis.score,
        missingCritical: analysis.missing.length,
        totalFindings: analysis.findings.length,
        presentHeaders: analysis.present.length,
        policyTarget: target,
      },
      baseScore: analysis.score,
    })

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "HTTP Security Headers Analyzer",
        summary,
        findings,
        evidence: [
          {
            score: analysis.score,
            grade: analysis.grade,
            missing: analysis.missing,
            present: analysis.present,
            normalizedHeaders: parsedHeaders,
          },
        ],
        recommendations: [
          "Treat missing CSP/HSTS/XFO/XCTO as release-blocking for public endpoints.",
          "Set explicit browser isolation and Permissions-Policy controls for high-value apps.",
          "Track security header drift in CI/CD and edge-config change management.",
        ],
        raw: {
          httpHeaders: analysis,
          normalizedHeaders: parsedHeaders,
          config: {
            target,
            missingLimit,
            includePassingChecks,
            requireHstsPreload,
            requireCrossOriginIsolation,
            flagServerBanner,
            requireStrictPermissionsPolicy,
            flagLegacyXssHeader,
          },
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null

    const envelope = parseToolResultEnvelope(output, "HTTP Security Headers Analyzer")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null
    const parsed = raw?.httpHeaders as HttpHeadersAnalysisResult | undefined
    const normalizedHeaders = raw?.normalizedHeaders as ParsedHeaders | undefined
    const config = raw?.config && typeof raw.config === "object" && raw.config !== null
      ? (raw.config as Record<string, unknown>)
      : null

    if (!parsed) return null

    return (
      <div className="space-y-4">
        <div className="p-3 border rounded bg-muted/20">
          <div className="text-xs font-bold text-muted-foreground uppercase">Security Score</div>
          <div className={`text-2xl font-bold ${scoreColor(parsed.score)}`}>
            {parsed.score}/100 ({parsed.grade})
          </div>
          {config && (
            <div className="text-xs text-muted-foreground mt-1">
              Baseline target: {String(config.target ?? "85")} | Missing threshold: {String(config.missingLimit ?? "0")}
            </div>
          )}
        </div>

        <div className="p-3 border rounded bg-muted/20">
          <h3 className="text-sm font-semibold mb-2">Missing Critical Headers</h3>
          {parsed.missing.length === 0 ? (
            <div className="text-sm text-green-600 dark:text-green-400">No critical headers missing.</div>
          ) : (
            <ul className="text-sm text-muted-foreground space-y-1">
              {parsed.missing.map((header) => (
                <li key={header}>• {header}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Findings</h3>
          {parsed.findings.map((finding, index) => (
            <div key={`${finding.header}-${index}`} className="p-3 border rounded bg-muted/20 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{finding.header}</span>
                <span
                  className={
                    finding.status === "good"
                      ? "text-green-600 dark:text-green-400"
                      : finding.status === "warn"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400"
                  }
                >
                  {finding.status.toUpperCase()}
                </span>
              </div>
              <p className="text-muted-foreground mt-1">{finding.message}</p>
              {finding.recommendation && (
                <p className="text-xs text-muted-foreground mt-1">
                  Recommendation: {finding.recommendation}
                </p>
              )}
            </div>
          ))}
        </div>

        {normalizedHeaders && (
          <pre className="min-h-[120px] p-4 rounded-lg bg-background border overflow-auto text-xs font-mono whitespace-pre-wrap break-all">
            {JSON.stringify(normalizedHeaders, null, 2)}
          </pre>
        )}
      </div>
    )
  }

  return (
    <ToolTemplate
      toolName="HTTP Security Headers Analyzer"
      description="Analyze HTTP response headers with policy baselines, risk scoring, and deployment-governance controls."
      actionLabel="Analyze Headers"
      placeholder={"HTTP/1.1 200 OK\nStrict-Transport-Security: max-age=31536000; includeSubDomains\nContent-Security-Policy: default-src 'self'"}
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Target score baseline</Label>
              <Input
                value={targetScore}
                onChange={(event) => setTargetScore(event.target.value)}
                placeholder="85"
              />
            </div>
            <div className="space-y-1">
              <Label>Max missing critical headers</Label>
              <Input
                value={maxMissingCritical}
                onChange={(event) => setMaxMissingCritical(event.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="http-include-good" className="text-sm">Include passing checks as findings</Label>
              <Switch
                id="http-include-good"
                checked={includePassingChecks}
                onChange={(event) => setIncludePassingChecks(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="http-require-preload" className="text-sm">Require HSTS preload</Label>
              <Switch
                id="http-require-preload"
                checked={requireHstsPreload}
                onChange={(event) => setRequireHstsPreload(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="http-require-isolation" className="text-sm">Require cross-origin isolation</Label>
              <Switch
                id="http-require-isolation"
                checked={requireCrossOriginIsolation}
                onChange={(event) => setRequireCrossOriginIsolation(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="http-flag-banners" className="text-sm">Flag server/framework banners</Label>
              <Switch
                id="http-flag-banners"
                checked={flagServerBanner}
                onChange={(event) => setFlagServerBanner(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="http-strict-permissions" className="text-sm">Require strict Permissions-Policy</Label>
              <Switch
                id="http-strict-permissions"
                checked={requireStrictPermissionsPolicy}
                onChange={(event) => setRequireStrictPermissionsPolicy(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="http-flag-legacy-xss" className="text-sm">Flag legacy X-XSS-Protection</Label>
              <Switch
                id="http-flag-legacy-xss"
                checked={flagLegacyXssHeader}
                onChange={(event) => setFlagLegacyXssHeader(event.target.checked)}
              />
            </div>
          </div>
        </div>
      }
      examples={[
        "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload\nContent-Security-Policy: default-src 'self'\nX-Frame-Options: DENY\nX-Content-Type-Options: nosniff\nReferrer-Policy: strict-origin-when-cross-origin\nPermissions-Policy: geolocation=()",
        "Server: Apache/2.4\nContent-Type: text/html",
      ]}
    />
  )
}
