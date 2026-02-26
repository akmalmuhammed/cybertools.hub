import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import {
  analyzeOpenApiAuthzGaps,
  type OpenApiAuthzResult,
} from "@/lib/utils/openapi-authz-gap"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding, ToolFindingSeverity } from "@/types/tool.types"

function parsePathPatterns(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

function toSeverity(severity: "low" | "medium" | "high" | "critical"): ToolFindingSeverity {
  if (severity === "critical") return "critical"
  if (severity === "high") return "high"
  if (severity === "medium") return "medium"
  return "low"
}

export default function OpenApiAuthzGapTool() {
  const [failOnAnonymous, setFailOnAnonymous] = useState(true)
  const [allowedUnsecuredOps, setAllowedUnsecuredOps] = useState("0")
  const [requireWriteMethodSecurity, setRequireWriteMethodSecurity] = useState(true)
  const [requireHeaderApiKeys, setRequireHeaderApiKeys] = useState(true)
  const [maxHighFindings, setMaxHighFindings] = useState("0")
  const [criticalPathPatternsInput, setCriticalPathPatternsInput] = useState("/admin,/internal,/management")

  const process = (input: string) => {
    const openapi = analyzeOpenApiAuthzGaps(input)
    const findings: ToolFinding[] = openapi.findings.map((finding, index) => ({
      id: `openapi-${finding.method}-${finding.path}-${index}`,
      severity: toSeverity(finding.severity),
      confidence: finding.severity === "critical" ? 90 : finding.severity === "high" ? 84 : finding.severity === "medium" ? 76 : 68,
      category: "api-authorization",
      title: `${finding.method} ${finding.path}: ${finding.issue}`,
      description: finding.issue,
      remediation: finding.recommendation,
      evidenceRef: `${finding.method} ${finding.path}`,
    }))

    const maxUnsecured = Math.max(0, Number(allowedUnsecuredOps) || 0)
    const maxHighAllowed = Math.max(0, Number(maxHighFindings) || 0)
    const criticalPathPatterns = parsePathPatterns(criticalPathPatternsInput)

    if (failOnAnonymous && openapi.summary.unsecured > maxUnsecured) {
      findings.push({
        id: "openapi-anonymous-over-limit",
        severity: openapi.summary.unsecured > maxUnsecured + 2 ? "critical" : "high",
        confidence: 86,
        category: "authn-requirements",
        title: "Anonymous operations exceed policy threshold",
        description: `Detected ${openapi.summary.unsecured} unsecured operation(s), policy allows ${maxUnsecured}.`,
        remediation: "Add security requirements or document explicit anonymous exceptions per operation.",
      })
    }

    if (requireHeaderApiKeys && openapi.summary.riskyApiKeyQuery > 0) {
      findings.push({
        id: "openapi-api-key-query-disallowed",
        severity: "high",
        confidence: 82,
        category: "credential-handling",
        title: "API keys in query parameters violate policy",
        description: `${openapi.summary.riskyApiKeyQuery} operation(s) use query-string API keys.`,
        remediation: "Move API keys to headers and avoid credential transport in URL/query logs.",
      })
    }

    if (requireWriteMethodSecurity) {
      const insecureWrites = openapi.findings.filter((finding) => {
        const writeMethod = finding.method === "POST" || finding.method === "PUT" || finding.method === "PATCH" || finding.method === "DELETE"
        return writeMethod && finding.issue.toLowerCase().includes("no authentication")
      })
      if (insecureWrites.length > 0) {
        findings.push({
          id: "openapi-write-method-unsecured",
          severity: "critical",
          confidence: 90,
          category: "authz-enforcement",
          title: "Unsecured write operations detected",
          description: `${insecureWrites.length} state-changing operation(s) lack auth requirements.`,
          remediation: "Enforce authentication and least-privilege authorization for all write operations.",
        })
      }
    }

    if (criticalPathPatterns.length > 0) {
      const criticalPathHits = openapi.findings.filter((finding) =>
        criticalPathPatterns.some((pattern) => finding.path.includes(pattern)),
      )
      if (criticalPathHits.length > 0) {
        findings.push({
          id: "openapi-critical-path-hits",
          severity: "critical",
          confidence: 85,
          category: "sensitive-surface",
          title: "Findings detected on critical API paths",
          description: `Matched ${criticalPathHits.length} finding(s) on critical paths: ${criticalPathPatterns.join(", ")}.`,
          remediation: "Prioritize remediation for privileged/admin/internal paths before production release.",
        })
      }
    }

    const highOrCritical = findings.filter((finding) => finding.severity === "high" || finding.severity === "critical").length
    if (highOrCritical > maxHighAllowed) {
      findings.push({
        id: "openapi-high-findings-over-limit",
        severity: highOrCritical > maxHighAllowed + 2 ? "critical" : "high",
        confidence: 83,
        category: "release-governance",
        title: "High-severity findings exceed allowed threshold",
        description: `${highOrCritical} high/critical finding(s) detected; max allowed is ${maxHighAllowed}.`,
        remediation: "Treat as release blocker until findings are remediated or exception approved.",
      })
    }

    if (openapi.summary.operations === 0) {
      findings.push({
        id: "openapi-no-operations",
        severity: "info",
        confidence: 72,
        category: "input-quality",
        title: "No API operations parsed",
        description: "Spec parsed, but no operations were discovered.",
        remediation: "Provide a valid OpenAPI `paths` section with operation objects.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "OpenAPI authorization gap analysis completed",
      text: `Inspected ${openapi.summary.operations} operation(s) with ${openapi.findings.length} base finding(s).`,
      findings,
      metrics: {
        operations: openapi.summary.operations,
        unsecured: openapi.summary.unsecured,
        weakScoped: openapi.summary.weakScoped,
        riskyApiKeyQuery: openapi.summary.riskyApiKeyQuery,
        highOrCritical,
      },
      baseScore: 94,
    })

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "OpenAPI AuthZ Gap Analyzer",
        summary,
        findings,
        evidence: openapi.findings.map((finding) => ({
          path: finding.path,
          method: finding.method,
          severity: finding.severity,
          issue: finding.issue,
          recommendation: finding.recommendation,
        })),
        recommendations: [
          "Require explicit security requirements for every operation, especially write paths.",
          "Avoid query-string API keys and enforce scoped OAuth requirements.",
          "Add OpenAPI authz checks into CI gates to prevent security drift.",
        ],
        raw: {
          openapiAuthz: openapi,
          config: {
            failOnAnonymous,
            maxUnsecured,
            requireWriteMethodSecurity,
            requireHeaderApiKeys,
            maxHighAllowed,
            criticalPathPatterns,
          },
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null

    const envelope = parseToolResultEnvelope(output, "OpenAPI AuthZ Gap Analyzer")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null
    const parsed = raw?.openapiAuthz as OpenApiAuthzResult | undefined
    const config = raw?.config && typeof raw.config === "object" && raw.config !== null
      ? (raw.config as Record<string, unknown>)
      : null

    if (!parsed) return null

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-4 gap-2">
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">Ops</div><div className="text-xl font-semibold">{parsed.summary.operations}</div></div>
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">Unsecured</div><div className="text-xl font-semibold">{parsed.summary.unsecured}</div></div>
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">Weak Scope</div><div className="text-xl font-semibold">{parsed.summary.weakScoped}</div></div>
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">API Key Query</div><div className="text-xl font-semibold">{parsed.summary.riskyApiKeyQuery}</div></div>
        </div>

        {config && (
          <div className="p-3 border rounded bg-muted/20 text-xs text-muted-foreground">
            Max unsecured: {String(config.maxUnsecured ?? "0")} | Max high findings: {String(config.maxHighAllowed ?? "0")} | Write-security required: {config.requireWriteMethodSecurity ? "yes" : "no"}
          </div>
        )}

        <div className="space-y-2">
          {parsed.findings.map((finding, index) => (
            <div key={`${finding.path}:${finding.method}:${index}`} className="p-3 border rounded bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{finding.method} {finding.path}</div>
                <div className="text-xs uppercase">{finding.severity}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{finding.issue}</div>
              <div className="text-xs text-muted-foreground">{finding.recommendation}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <ToolTemplate
      toolName="OpenAPI AuthZ Gap Analyzer"
      description="Find authorization gaps and over-broad scope patterns in OpenAPI contracts with enterprise release-gate controls."
      actionLabel="Analyze OpenAPI"
      placeholder={`{
  "openapi": "3.0.3",
  "paths": {
    "/admin/users": {
      "get": { "responses": { "200": { "description": "ok" } } }
    }
  }
}`}
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Max allowed unsecured operations</Label>
              <Input
                value={allowedUnsecuredOps}
                onChange={(event) => setAllowedUnsecuredOps(event.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label>Max high/critical findings</Label>
              <Input
                value={maxHighFindings}
                onChange={(event) => setMaxHighFindings(event.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Critical path patterns (comma separated)</Label>
            <Input
              value={criticalPathPatternsInput}
              onChange={(event) => setCriticalPathPatternsInput(event.target.value)}
              placeholder="/admin,/internal,/management"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="openapi-fail-anon" className="text-sm">Fail on anonymous ops</Label>
              <Switch
                id="openapi-fail-anon"
                checked={failOnAnonymous}
                onChange={(event) => setFailOnAnonymous(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="openapi-require-write" className="text-sm">Require auth on write methods</Label>
              <Switch
                id="openapi-require-write"
                checked={requireWriteMethodSecurity}
                onChange={(event) => setRequireWriteMethodSecurity(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 sm:col-span-2">
              <Label htmlFor="openapi-require-header-keys" className="text-sm">Disallow query API keys</Label>
              <Switch
                id="openapi-require-header-keys"
                checked={requireHeaderApiKeys}
                onChange={(event) => setRequireHeaderApiKeys(event.target.checked)}
              />
            </div>
          </div>
        </div>
      }
    />
  )
}
