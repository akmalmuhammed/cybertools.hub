import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import {
  analyzeCorsPolicy,
  type CorsAnalysisResult,
} from "@/lib/utils/cors-policy"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding, ToolFindingSeverity } from "@/types/tool.types"

function toToolSeverity(severity: "low" | "medium" | "high" | "critical"): ToolFindingSeverity {
  if (severity === "critical") return "critical"
  if (severity === "high") return "high"
  if (severity === "medium") return "medium"
  return "low"
}

function parseAllowlist(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\n,\s]+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  )
}

export default function CorsPolicyAnalyzerTool() {
  const [strictMissingOrigin, setStrictMissingOrigin] = useState(true)
  const [enforceOriginAllowlist, setEnforceOriginAllowlist] = useState(false)
  const [originAllowlistInput, setOriginAllowlistInput] = useState("")
  const [denySensitiveMethodsWithWildcardOrigin, setDenySensitiveMethodsWithWildcardOrigin] = useState(true)
  const [blockPrivateNetwork, setBlockPrivateNetwork] = useState(true)
  const [requireVaryOriginAlways, setRequireVaryOriginAlways] = useState(false)
  const [enforceMaxAgeLimit, setEnforceMaxAgeLimit] = useState(false)
  const [maxAllowedMaxAge, setMaxAllowedMaxAge] = useState("600")
  const [targetScore, setTargetScore] = useState("85")

  const process = (input: string) => {
    const cors = analyzeCorsPolicy(input)
    const allowlist = parseAllowlist(originAllowlistInput)
    const findings: ToolFinding[] = cors.findings.map((finding, index) => ({
      id: `cors-finding-${index + 1}`,
      severity: toToolSeverity(finding.severity),
      confidence: finding.severity === "critical" ? 90 : finding.severity === "high" ? 84 : finding.severity === "medium" ? 76 : 68,
      category: "cors-policy",
      title: finding.issue,
      description: finding.evidence,
      remediation: finding.recommendation,
    }))

    const allowOrigin = (cors.normalizedHeaders["access-control-allow-origin"] ?? "").trim().toLowerCase()
    const allowPrivateNetwork = (cors.normalizedHeaders["access-control-allow-private-network"] ?? "").trim().toLowerCase()
    const varyHeader = (cors.normalizedHeaders.vary ?? "").toLowerCase()
    const methodList = (cors.normalizedHeaders["access-control-allow-methods"] ?? "")
      .split(",")
      .map((method) => method.trim().toUpperCase())
      .filter(Boolean)

    if (strictMissingOrigin && !allowOrigin) {
      findings.push({
        id: "cors-strict-missing-origin",
        severity: "high",
        confidence: 84,
        category: "cors-governance",
        title: "Missing explicit CORS origin policy",
        description: "Strict mode is enabled and Access-Control-Allow-Origin is missing.",
        remediation: "Declare explicit trusted origins or disable CORS on endpoints that do not require cross-origin access.",
      })
    }

    if (enforceOriginAllowlist && allowlist.length > 0) {
      if (!allowOrigin) {
        findings.push({
          id: "cors-allowlist-origin-missing",
          severity: "high",
          confidence: 86,
          category: "cors-governance",
          title: "Allowlist mode enabled but origin header missing",
          description: "No Access-Control-Allow-Origin value was returned while allowlist enforcement is active.",
          remediation: "Return explicit origins that align with approved allowlist entries.",
        })
      } else if (allowOrigin === "*") {
        findings.push({
          id: "cors-allowlist-wildcard",
          severity: "high",
          confidence: 88,
          category: "cors-governance",
          title: "Wildcard origin violates allowlist policy",
          description: "Origin allowlist enforcement is enabled but header still uses wildcard `*`.",
          remediation: "Replace wildcard with explicit, vetted origins from your allowlist.",
        })
      } else if (!allowlist.includes(allowOrigin)) {
        findings.push({
          id: "cors-origin-not-in-allowlist",
          severity: "medium",
          confidence: 77,
          category: "cors-governance",
          title: "Configured origin not in approved allowlist",
          description: `Observed origin \`${allowOrigin}\` is outside configured allowlist policy.`,
          remediation: "Align runtime CORS origin with governance allowlist, or update policy through change control.",
        })
      }
    }

    if (blockPrivateNetwork && allowPrivateNetwork === "true") {
      findings.push({
        id: "cors-private-network-enabled",
        severity: "high",
        confidence: 82,
        category: "network-exposure",
        title: "Private network access exposed via CORS",
        description: "Access-Control-Allow-Private-Network is enabled.",
        remediation: "Disable private-network CORS where possible and enforce gateway-layer controls.",
      })
    }

    if (requireVaryOriginAlways && allowOrigin && !varyHeader.includes("origin")) {
      findings.push({
        id: "cors-vary-origin-missing-policy",
        severity: "medium",
        confidence: 74,
        category: "cache-safety",
        title: "Vary: Origin missing under policy requirement",
        description: "Policy requires Vary: Origin whenever origin is returned.",
        remediation: "Add Vary: Origin to prevent cache confusion across requesting origins.",
      })
    }

    const maxAgeLimit = Math.max(0, Number(maxAllowedMaxAge) || 600)
    if (enforceMaxAgeLimit) {
      const maxAge = Number((cors.normalizedHeaders["access-control-max-age"] ?? "").trim())
      if (Number.isFinite(maxAge) && maxAge > maxAgeLimit) {
        findings.push({
          id: "cors-max-age-too-high",
          severity: maxAge > maxAgeLimit * 2 ? "medium" : "low",
          confidence: 71,
          category: "preflight-governance",
          title: "CORS preflight cache duration exceeds policy",
          description: `Observed Access-Control-Max-Age=${maxAge}, policy limit=${maxAgeLimit}.`,
          remediation: "Reduce max-age to tighten response to policy updates and incident response changes.",
        })
      }
    }

    if (denySensitiveMethodsWithWildcardOrigin && allowOrigin === "*") {
      const sensitiveMethods = methodList.filter((method) => method === "PUT" || method === "PATCH" || method === "DELETE")
      if (sensitiveMethods.length > 0) {
        findings.push({
          id: "cors-wildcard-sensitive-methods",
          severity: "high",
          confidence: 86,
          category: "attack-surface",
          title: "Sensitive methods exposed to wildcard origin",
          description: `Wildcard origin with sensitive methods: ${sensitiveMethods.join(", ")}.`,
          remediation: "Require explicit origin allowlisting for state-changing methods.",
        })
      }
    }

    const minimumScore = Math.max(0, Math.min(100, Number(targetScore) || 85))
    if (cors.score < minimumScore) {
      findings.push({
        id: "cors-score-under-target",
        severity: cors.score <= Math.max(40, minimumScore - 20) ? "high" : "medium",
        confidence: 79,
        category: "policy-baseline",
        title: "CORS posture score below target",
        description: `Score ${cors.score} is below target baseline ${minimumScore}.`,
        remediation: "Address high/critical CORS issues and re-test until baseline is achieved.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "CORS policy analysis completed",
      text: `Evaluated ${Object.keys(cors.normalizedHeaders).length} header(s) with base risk score ${cors.score}.`,
      findings,
      metrics: {
        baseScore: cors.score,
        headerCount: Object.keys(cors.normalizedHeaders).length,
        methodCount: methodList.length,
        criticalFindings: findings.filter((finding) => finding.severity === "critical").length,
        highFindings: findings.filter((finding) => finding.severity === "high").length,
      },
      baseScore: cors.score,
    })

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "CORS Policy Analyzer",
        summary,
        findings,
        evidence: [
          {
            score: cors.score,
            normalizedHeaders: cors.normalizedHeaders,
            findingCount: cors.findings.length,
            methods: methodList,
          },
        ],
        recommendations: [
          "Enforce explicit origin allowlists for sensitive API paths.",
          "Avoid wildcard origin with credentialed or state-changing CORS methods.",
          "Continuously monitor CORS drift and retest after platform or CDN changes.",
        ],
        raw: {
          cors,
          config: {
            strictMissingOrigin,
            enforceOriginAllowlist,
            allowlist,
            denySensitiveMethodsWithWildcardOrigin,
            blockPrivateNetwork,
            requireVaryOriginAlways,
            enforceMaxAgeLimit,
            maxAgeLimit,
            minimumScore,
          },
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null
    const envelope = parseToolResultEnvelope(output, "CORS Policy Analyzer")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null
    const parsed = raw?.cors as CorsAnalysisResult | undefined
    const config = raw?.config && typeof raw.config === "object" && raw.config !== null
      ? (raw.config as Record<string, unknown>)
      : null
    if (!parsed) return null

    return (
      <div className="space-y-4">
        <div className="p-3 border rounded bg-muted/20">
          <div className="text-xs uppercase text-muted-foreground">CORS Risk Score</div>
          <div className="text-2xl font-semibold">{parsed.score}</div>
          {config && (
            <div className="text-xs text-muted-foreground mt-1">
              Target: {String(config.minimumScore ?? "85")} | Private-network block: {config.blockPrivateNetwork ? "on" : "off"}
            </div>
          )}
        </div>

        <div className="space-y-2">
          {parsed.findings.map((finding, index) => (
            <div key={`${finding.issue}:${index}`} className="p-3 border rounded bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{finding.issue}</div>
                <div className="text-xs uppercase">{finding.severity}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{finding.evidence}</div>
              <div className="text-xs text-muted-foreground">{finding.recommendation}</div>
            </div>
          ))}
        </div>

        <pre className="min-h-[140px] p-4 rounded-lg bg-background border overflow-auto text-xs font-mono whitespace-pre-wrap break-all">
          {JSON.stringify(parsed.normalizedHeaders, null, 2)}
        </pre>
      </div>
    )
  }

  return (
    <ToolTemplate
      toolName="CORS Policy Analyzer"
      description="Analyze CORS response headers with enterprise policy baselines, governance checks, and cache-safety controls."
      actionLabel="Analyze CORS"
      placeholder="Access-Control-Allow-Origin: *\nAccess-Control-Allow-Credentials: true\nAccess-Control-Allow-Methods: GET,POST,PUT,DELETE"
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Approved origin allowlist (optional)</Label>
            <Input
              value={originAllowlistInput}
              onChange={(event) => setOriginAllowlistInput(event.target.value)}
              placeholder="https://app.example.com, https://admin.example.com"
            />
          </div>

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
              <Label>Max allowed Access-Control-Max-Age</Label>
              <Input
                value={maxAllowedMaxAge}
                onChange={(event) => setMaxAllowedMaxAge(event.target.value)}
                placeholder="600"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="cors-strict-missing-origin" className="text-sm">Strict missing-origin check</Label>
              <Switch
                id="cors-strict-missing-origin"
                checked={strictMissingOrigin}
                onChange={(event) => setStrictMissingOrigin(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="cors-enforce-allowlist" className="text-sm">Enforce origin allowlist</Label>
              <Switch
                id="cors-enforce-allowlist"
                checked={enforceOriginAllowlist}
                onChange={(event) => setEnforceOriginAllowlist(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="cors-deny-sensitive-methods" className="text-sm">Deny wildcard sensitive methods</Label>
              <Switch
                id="cors-deny-sensitive-methods"
                checked={denySensitiveMethodsWithWildcardOrigin}
                onChange={(event) => setDenySensitiveMethodsWithWildcardOrigin(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="cors-block-private-network" className="text-sm">Block private-network CORS</Label>
              <Switch
                id="cors-block-private-network"
                checked={blockPrivateNetwork}
                onChange={(event) => setBlockPrivateNetwork(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="cors-require-vary-origin" className="text-sm">Require Vary: Origin</Label>
              <Switch
                id="cors-require-vary-origin"
                checked={requireVaryOriginAlways}
                onChange={(event) => setRequireVaryOriginAlways(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="cors-enforce-max-age" className="text-sm">Enforce max-age cap</Label>
              <Switch
                id="cors-enforce-max-age"
                checked={enforceMaxAgeLimit}
                onChange={(event) => setEnforceMaxAgeLimit(event.target.checked)}
              />
            </div>
          </div>
        </div>
      }
    />
  )
}
