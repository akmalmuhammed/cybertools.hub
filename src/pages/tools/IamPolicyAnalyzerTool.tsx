import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import {
  analyzeIamPolicy,
  type IamPolicyAnalysisResult,
} from "@/lib/utils/iam-policy-analyzer"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

interface GenericObject {
  [key: string]: unknown
}

function isObject(value: unknown): value is GenericObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (value === null || value === undefined) return []
  return [value]
}

function normalizeStringList(value: unknown): string[] {
  return asArray(value).map((item) => String(item).trim().toLowerCase()).filter(Boolean)
}

function readAwsStatements(payload: GenericObject): GenericObject[] {
  return asArray(payload.Statement).filter((item) => isObject(item)) as GenericObject[]
}

function hasWildcardPrincipal(statement: GenericObject): boolean {
  const principal = statement.Principal
  if (principal === "*") return true
  if (!isObject(principal)) return false
  const awsValues = normalizeStringList(principal.AWS)
  return awsValues.includes("*")
}

function actionContains(actions: string[], matcher: string): boolean {
  return actions.some((action) => action === matcher || action.startsWith(`${matcher}:`) || action === `${matcher}:*`)
}

function hasMfaCondition(statement: GenericObject): boolean {
  const condition = statement.Condition
  if (!isObject(condition)) return false

  const conditionBlocks = Object.values(condition).filter((item) => isObject(item)) as GenericObject[]
  return conditionBlocks.some((block) => {
    const key = Object.keys(block).find((candidate) => candidate.toLowerCase() === "aws:multifactorauthpresent")
    if (!key) return false
    const value = block[key]
    if (typeof value === "boolean") return value
    return String(value).toLowerCase() === "true"
  })
}

export default function IamPolicyAnalyzerTool() {
  const [failOnCritical, setFailOnCritical] = useState(true)
  const [maxHighFindings, setMaxHighFindings] = useState("0")
  const [enforceMfaForAssumeRole, setEnforceMfaForAssumeRole] = useState(true)
  const [enforceNoWildcardPrincipal, setEnforceNoWildcardPrincipal] = useState(true)
  const [flagPassRoleWildcard, setFlagPassRoleWildcard] = useState(true)
  const [suppressNoRiskInfo, setSuppressNoRiskInfo] = useState(false)

  const process = (input: string) => {
    const iam = analyzeIamPolicy(input)
    const findings: ToolFinding[] = iam.findings
      .filter((finding) => !suppressNoRiskInfo || !finding.issue.toLowerCase().includes("no high-confidence risky patterns"))
      .map((finding, index) => ({
        id: `iam-${finding.platform}-${index + 1}`,
        severity: finding.severity,
        confidence: finding.severity === "critical" ? 92 : finding.severity === "high" ? 84 : finding.severity === "medium" ? 76 : 68,
        category: "iam-risk",
        title: `${finding.platform.toUpperCase()}: ${finding.issue}`,
        description: finding.evidence,
        remediation: finding.recommendation,
      }))

    let parsedPolicy: GenericObject = {}
    try {
      const parsed = JSON.parse(input)
      if (isObject(parsed)) parsedPolicy = parsed
    } catch {
      parsedPolicy = {}
    }

    const awsStatements = readAwsStatements(parsedPolicy)

    if (enforceNoWildcardPrincipal) {
      const wildcardPrincipalCount = awsStatements.filter((statement) => hasWildcardPrincipal(statement)).length
      if (wildcardPrincipalCount > 0) {
        findings.push({
          id: "iam-wildcard-principal-strict",
          severity: "critical",
          confidence: 90,
          category: "trust-policy",
          title: "Wildcard principal violates trust policy baseline",
          description: `Detected ${wildcardPrincipalCount} statement(s) with wildcard principals.`,
          remediation: "Restrict principals to explicit account, role, or service identities.",
        })
      }
    }

    if (enforceMfaForAssumeRole) {
      let assumeRoleWithoutMfa = 0
      awsStatements.forEach((statement) => {
        const effect = String(statement.Effect ?? "").toLowerCase()
        if (effect !== "allow") return
        const actions = normalizeStringList(statement.Action)
        if (!actions.some((action) => action === "sts:assumerole" || action === "sts:*")) return
        if (!hasMfaCondition(statement)) assumeRoleWithoutMfa += 1
      })

      if (assumeRoleWithoutMfa > 0) {
        findings.push({
          id: "iam-assumerole-without-mfa",
          severity: "high",
          confidence: 83,
          category: "authentication-assurance",
          title: "AssumeRole allowed without MFA condition",
          description: `${assumeRoleWithoutMfa} statement(s) permit AssumeRole without MFA enforcement.`,
          remediation: "Require aws:MultiFactorAuthPresent=true for high-trust role assumption paths.",
        })
      }
    }

    if (flagPassRoleWildcard) {
      let passRoleWildcardCount = 0
      awsStatements.forEach((statement) => {
        const effect = String(statement.Effect ?? "").toLowerCase()
        if (effect !== "allow") return
        const actions = normalizeStringList(statement.Action)
        const resources = normalizeStringList(statement.Resource)
        if (actionContains(actions, "iam:passrole") && resources.includes("*")) {
          passRoleWildcardCount += 1
        }
      })

      if (passRoleWildcardCount > 0) {
        findings.push({
          id: "iam-passrole-wildcard",
          severity: "high",
          confidence: 86,
          category: "privilege-escalation",
          title: "iam:PassRole granted on wildcard resources",
          description: `${passRoleWildcardCount} statement(s) grant iam:PassRole with Resource=*.`,
          remediation: "Restrict PassRole targets to explicit role ARNs and enforce path-based boundaries.",
        })
      }
    }

    const highOrCritical = findings.filter((finding) => finding.severity === "high" || finding.severity === "critical").length
    const criticalCount = findings.filter((finding) => finding.severity === "critical").length
    const maxHigh = Math.max(0, Number(maxHighFindings) || 0)

    if (failOnCritical && criticalCount > 0) {
      findings.push({
        id: "iam-critical-release-blocker",
        severity: "critical",
        confidence: 85,
        category: "release-governance",
        title: "Critical IAM findings present",
        description: `${criticalCount} critical IAM finding(s) detected under strict release policy.`,
        remediation: "Block deployment until critical IAM findings are remediated or formally excepted.",
      })
    }

    if (highOrCritical > maxHigh) {
      findings.push({
        id: "iam-high-findings-over-limit",
        severity: highOrCritical > maxHigh + 2 ? "critical" : "high",
        confidence: 82,
        category: "release-governance",
        title: "High-severity IAM findings exceed threshold",
        description: `${highOrCritical} high/critical finding(s) detected; configured max is ${maxHigh}.`,
        remediation: "Reduce risky grants or split policy scope before promotion.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "IAM policy analysis completed",
      text: `Analyzed policy with ${iam.summary.totalFindings} base finding(s) across provider heuristics.`,
      findings,
      metrics: {
        baseFindings: iam.summary.totalFindings,
        critical: findings.filter((finding) => finding.severity === "critical").length,
        high: findings.filter((finding) => finding.severity === "high").length,
        medium: findings.filter((finding) => finding.severity === "medium").length,
        low: findings.filter((finding) => finding.severity === "low").length,
      },
      baseScore: 92,
    })

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "IAM Policy Analyzer",
        summary,
        findings,
        evidence: iam.findings.map((finding) => ({
          platform: finding.platform,
          severity: finding.severity,
          issue: finding.issue,
          evidence: finding.evidence,
          recommendation: finding.recommendation,
        })),
        recommendations: [
          "Eliminate wildcard principals/actions/resources for production trust boundaries.",
          "Protect role-assumption and credential delegation paths with MFA and explicit constraints.",
          "Treat IAM lint findings as CI/CD release gates with documented exception workflow.",
        ],
        raw: {
          iamPolicy: iam,
          config: {
            failOnCritical,
            maxHigh,
            enforceMfaForAssumeRole,
            enforceNoWildcardPrincipal,
            flagPassRoleWildcard,
            suppressNoRiskInfo,
          },
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null
    const envelope = parseToolResultEnvelope(output, "IAM Policy Analyzer")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null
    const parsed = raw?.iamPolicy as IamPolicyAnalysisResult | undefined
    const config = raw?.config && typeof raw.config === "object" && raw.config !== null
      ? (raw.config as Record<string, unknown>)
      : null

    if (!parsed) return null

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-5 gap-2">
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">Findings</div><div className="text-xl font-semibold">{parsed.summary.totalFindings}</div></div>
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">Critical</div><div className="text-xl font-semibold">{parsed.summary.critical}</div></div>
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">High</div><div className="text-xl font-semibold">{parsed.summary.high}</div></div>
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">Medium</div><div className="text-xl font-semibold">{parsed.summary.medium}</div></div>
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">Low</div><div className="text-xl font-semibold">{parsed.summary.low}</div></div>
        </div>

        {config && (
          <div className="p-3 border rounded bg-muted/20 text-xs text-muted-foreground">
            Fail on critical: {config.failOnCritical ? "yes" : "no"} | Max high findings: {String(config.maxHigh ?? "0")} | MFA on AssumeRole: {config.enforceMfaForAssumeRole ? "required" : "optional"}
          </div>
        )}

        <div className="space-y-2">
          {parsed.findings.map((finding, index) => (
            <div key={`${finding.issue}:${index}`} className="p-3 border rounded bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{finding.issue}</div>
                <div className="text-xs uppercase">{finding.platform} · {finding.severity}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{finding.evidence}</div>
              <div className="text-xs text-muted-foreground">{finding.recommendation}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <ToolTemplate
      toolName="IAM Policy Analyzer"
      description="Lint AWS/Azure/GCP policy JSON with enterprise governance controls for wildcard, trust, and role-assumption risk."
      actionLabel="Analyze IAM Policy"
      placeholder={`{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "*",
      "Resource": "*"
    }
  ]
}`}
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Max allowed high/critical findings</Label>
            <Input
              value={maxHighFindings}
              onChange={(event) => setMaxHighFindings(event.target.value)}
              placeholder="0"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="iam-fail-critical" className="text-sm">Fail on critical findings</Label>
              <Switch
                id="iam-fail-critical"
                checked={failOnCritical}
                onChange={(event) => setFailOnCritical(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="iam-enforce-mfa-assumerole" className="text-sm">Require MFA for AssumeRole</Label>
              <Switch
                id="iam-enforce-mfa-assumerole"
                checked={enforceMfaForAssumeRole}
                onChange={(event) => setEnforceMfaForAssumeRole(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="iam-no-wildcard-principal" className="text-sm">Disallow wildcard principal</Label>
              <Switch
                id="iam-no-wildcard-principal"
                checked={enforceNoWildcardPrincipal}
                onChange={(event) => setEnforceNoWildcardPrincipal(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="iam-flag-passrole" className="text-sm">Flag PassRole wildcard grants</Label>
              <Switch
                id="iam-flag-passrole"
                checked={flagPassRoleWildcard}
                onChange={(event) => setFlagPassRoleWildcard(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 sm:col-span-2">
              <Label htmlFor="iam-suppress-low-signal" className="text-sm">Suppress low-signal no-risk info finding</Label>
              <Switch
                id="iam-suppress-low-signal"
                checked={suppressNoRiskInfo}
                onChange={(event) => setSuppressNoRiskInfo(event.target.checked)}
              />
            </div>
          </div>
        </div>
      }
    />
  )
}
