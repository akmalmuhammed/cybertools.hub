import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import {
  minimizeScopesAndLintPolicy,
  type OAuthOidcLinterResult,
} from "@/lib/utils/oauth-oidc-scope"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

const BUILT_IN_SCOPES = new Set(["openid", "profile", "email", "phone", "address", "offline_access", "groups"])

function parsePrefixes(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\s,]+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  )
}

export default function OAuthOidcLinterTool() {
  const [forbidOfflineAccess, setForbidOfflineAccess] = useState(true)
  const [requirePkce, setRequirePkce] = useState(true)
  const [maxAccessTokenTtlMinutes, setMaxAccessTokenTtlMinutes] = useState("60")
  const [maxRefreshTokenDays, setMaxRefreshTokenDays] = useState("30")
  const [maxExcessScopes, setMaxExcessScopes] = useState("0")
  const [enforceScopePrefix, setEnforceScopePrefix] = useState(false)
  const [requiredScopePrefixesInput, setRequiredScopePrefixesInput] = useState("api:,read:,write:")
  const [flagMissingPolicyFields, setFlagMissingPolicyFields] = useState(true)

  const process = (input: string) => {
    const oauth = minimizeScopesAndLintPolicy(input)
    const findings: ToolFinding[] = oauth.findings.map((finding, index) => ({
      id: `oauth-finding-${index + 1}`,
      severity: finding.severity,
      confidence: finding.severity === "high" ? 84 : finding.severity === "medium" ? 76 : 68,
      category: "oauth-policy",
      title: finding.issue,
      description: finding.issue,
      remediation: finding.recommendation,
    }))

    const accessTtlCap = Math.max(1, Number(maxAccessTokenTtlMinutes) || 60)
    const refreshCap = Math.max(1, Number(maxRefreshTokenDays) || 30)
    const excessLimit = Math.max(0, Number(maxExcessScopes) || 0)
    const prefixes = parsePrefixes(requiredScopePrefixesInput)

    if (forbidOfflineAccess && oauth.requestedScopes.includes("offline_access")) {
      findings.push({
        id: "oauth-offline-access-forbidden",
        severity: "high",
        confidence: 87,
        category: "scope-governance",
        title: "offline_access scope requested under restricted policy",
        description: "offline_access was requested while strict offline-token policy is enabled.",
        remediation: "Remove offline_access unless refresh-token persistence is explicitly approved.",
      })
    }

    if (oauth.tokenPolicy.accessTokenTtlMinutes !== null && oauth.tokenPolicy.accessTokenTtlMinutes > accessTtlCap) {
      findings.push({
        id: "oauth-access-ttl-over-cap",
        severity: oauth.tokenPolicy.accessTokenTtlMinutes > accessTtlCap * 2 ? "high" : "medium",
        confidence: 80,
        category: "token-lifecycle",
        title: "Access token TTL exceeds policy limit",
        description: `Configured access token TTL is ${oauth.tokenPolicy.accessTokenTtlMinutes} minutes; max allowed is ${accessTtlCap}.`,
        remediation: "Reduce access token TTL and rely on refresh/token exchange patterns for long sessions.",
      })
    }

    if (oauth.tokenPolicy.refreshTokenDays !== null && oauth.tokenPolicy.refreshTokenDays > refreshCap) {
      findings.push({
        id: "oauth-refresh-ttl-over-cap",
        severity: oauth.tokenPolicy.refreshTokenDays > refreshCap * 2 ? "high" : "medium",
        confidence: 79,
        category: "token-lifecycle",
        title: "Refresh token lifetime exceeds policy limit",
        description: `Configured refresh token lifetime is ${oauth.tokenPolicy.refreshTokenDays} days; max allowed is ${refreshCap}.`,
        remediation: "Use shorter refresh lifetimes with rotation, reuse detection, and revocation monitoring.",
      })
    }

    if (requirePkce) {
      if (oauth.tokenPolicy.pkceRequired === false) {
        findings.push({
          id: "oauth-pkce-disabled",
          severity: "high",
          confidence: 89,
          category: "client-security",
          title: "PKCE is disabled",
          description: "Token policy explicitly disables PKCE.",
          remediation: "Require PKCE for public clients and authorization-code flow integrations.",
        })
      } else if (oauth.tokenPolicy.pkceRequired === null) {
        findings.push({
          id: "oauth-pkce-unknown",
          severity: "medium",
          confidence: 72,
          category: "client-security",
          title: "PKCE requirement unspecified",
          description: "Token policy did not explicitly declare PKCE requirement.",
          remediation: "Set pkceRequired=true in policy to avoid ambiguous client enforcement.",
        })
      }
    }

    if (oauth.excessScopes.length > excessLimit) {
      findings.push({
        id: "oauth-excess-scopes-over-limit",
        severity: oauth.excessScopes.length > excessLimit + 2 ? "high" : "medium",
        confidence: 78,
        category: "scope-governance",
        title: "Excess scopes exceed policy threshold",
        description: `${oauth.excessScopes.length} excess scope(s) detected; configured maximum is ${excessLimit}.`,
        remediation: "Reduce scope request set to least privilege based on required claims and API operations.",
      })
    }

    if (enforceScopePrefix && prefixes.length > 0) {
      const nonConforming = oauth.requestedScopes.filter((scope) => {
        if (BUILT_IN_SCOPES.has(scope)) return false
        return !prefixes.some((prefix) => scope.startsWith(prefix))
      })
      if (nonConforming.length > 0) {
        findings.push({
          id: "oauth-scope-prefix-violation",
          severity: "low",
          confidence: 70,
          category: "scope-taxonomy",
          title: "Requested scopes violate naming taxonomy",
          description: `Nonconforming scopes: ${nonConforming.join(", ")}.`,
          remediation: `Use scoped naming prefixes: ${prefixes.join(", ")}.`,
        })
      }
    }

    if (flagMissingPolicyFields) {
      const missingFields = [
        oauth.tokenPolicy.accessTokenTtlMinutes === null ? "accessTokenTtlMinutes" : null,
        oauth.tokenPolicy.refreshTokenDays === null ? "refreshTokenDays" : null,
        oauth.tokenPolicy.pkceRequired === null ? "pkceRequired" : null,
      ].filter((value): value is string => Boolean(value))

      if (missingFields.length > 0) {
        findings.push({
          id: "oauth-policy-fields-missing",
          severity: "low",
          confidence: 68,
          category: "policy-completeness",
          title: "Token policy fields missing",
          description: `Missing policy declarations: ${missingFields.join(", ")}.`,
          remediation: "Declare token TTL and PKCE requirements explicitly for deterministic governance.",
        })
      }
    }

    if (oauth.requestedScopes.length === 0) {
      findings.push({
        id: "oauth-no-requested-scopes",
        severity: "info",
        confidence: 73,
        category: "input-quality",
        title: "No requested scopes supplied",
        description: "Analyzer ran without explicit scope request set.",
        remediation: "Provide requested scope list to assess least-privilege posture accurately.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "OAuth/OIDC policy lint completed",
      text: `Evaluated ${oauth.requestedScopes.length} requested scope(s), ${oauth.excessScopes.length} marked excess.`,
      findings,
      metrics: {
        requestedScopes: oauth.requestedScopes.length,
        recommendedScopes: oauth.recommendedScopes.length,
        excessScopes: oauth.excessScopes.length,
        baseFindings: oauth.findings.length,
        highFindings: findings.filter((finding) => finding.severity === "high").length,
      },
      baseScore: 94,
    })

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "OAuth/OIDC Scope Minimizer & Policy Linter",
        summary,
        findings,
        evidence: [
          {
            requestedScopes: oauth.requestedScopes,
            recommendedScopes: oauth.recommendedScopes,
            excessScopes: oauth.excessScopes,
            tokenPolicy: oauth.tokenPolicy,
          },
        ],
        recommendations: [
          "Enforce least-privilege scopes aligned to actual claim and API usage.",
          "Use short-lived access tokens and rotate refresh tokens with replay detection.",
          "Require PKCE and explicit token policy declarations for all client profiles.",
        ],
        raw: {
          oauth,
          config: {
            forbidOfflineAccess,
            requirePkce,
            accessTtlCap,
            refreshCap,
            excessLimit,
            enforceScopePrefix,
            prefixes,
            flagMissingPolicyFields,
          },
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null
    const envelope = parseToolResultEnvelope(output, "OAuth/OIDC Scope Minimizer & Policy Linter")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null
    const parsed = raw?.oauth as OAuthOidcLinterResult | undefined
    const config = raw?.config && typeof raw.config === "object" && raw.config !== null
      ? (raw.config as Record<string, unknown>)
      : null

    if (!parsed) return null

    return (
      <div className="space-y-4">
        <div className="p-3 border rounded bg-muted/20">
          <div className="text-xs uppercase text-muted-foreground">Requested Scopes</div>
          <div className="text-sm">{parsed.requestedScopes.join(", ") || "-"}</div>
          {config && (
            <div className="text-xs text-muted-foreground mt-1">
              Max excess: {String(config.excessLimit ?? "0")} | PKCE required: {config.requirePkce ? "yes" : "no"}
            </div>
          )}
        </div>

        <div className="p-3 border rounded bg-muted/20">
          <div className="text-xs uppercase text-muted-foreground">Recommended Scopes</div>
          <div className="text-sm">{parsed.recommendedScopes.join(", ") || "-"}</div>
        </div>

        {parsed.excessScopes.length > 0 && (
          <div className="p-3 border rounded bg-amber-500/10 border-amber-600/30">
            <div className="text-xs uppercase mb-1">Excess Scopes</div>
            <div className="text-sm">{parsed.excessScopes.join(", ")}</div>
          </div>
        )}

        <div className="p-3 border rounded bg-muted/20">
          <div className="text-xs uppercase text-muted-foreground">Token Policy</div>
          <div className="text-sm mt-1">
            Access TTL: {parsed.tokenPolicy.accessTokenTtlMinutes ?? "N/A"} min | Refresh TTL: {parsed.tokenPolicy.refreshTokenDays ?? "N/A"} days | PKCE: {parsed.tokenPolicy.pkceRequired === null ? "N/A" : parsed.tokenPolicy.pkceRequired ? "required" : "not required"}
          </div>
        </div>

        <div className="space-y-2">
          {parsed.findings.map((finding, index) => (
            <div key={`${finding.issue}:${index}`} className="p-3 border rounded bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{finding.issue}</div>
                <div className="text-xs uppercase">{finding.severity}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{finding.recommendation}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <ToolTemplate
      toolName="OAuth/OIDC Scope Minimizer & Policy Linter"
      description="Reduce excess scopes and enforce enterprise token policy controls for least-privilege identity posture."
      actionLabel="Lint OAuth/OIDC Policy"
      placeholder={`{
  "requestedScopes": ["openid", "profile", "email", "admin", "offline_access"],
  "usedClaims": ["sub", "email"],
  "tokenPolicy": {
    "accessTokenTtlMinutes": 120,
    "refreshTokenDays": 90,
    "pkceRequired": false
  }
}`}
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Max access token TTL (minutes)</Label>
              <Input
                value={maxAccessTokenTtlMinutes}
                onChange={(event) => setMaxAccessTokenTtlMinutes(event.target.value)}
                placeholder="60"
              />
            </div>
            <div className="space-y-1">
              <Label>Max refresh token lifetime (days)</Label>
              <Input
                value={maxRefreshTokenDays}
                onChange={(event) => setMaxRefreshTokenDays(event.target.value)}
                placeholder="30"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Max excess scopes allowed</Label>
              <Input
                value={maxExcessScopes}
                onChange={(event) => setMaxExcessScopes(event.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label>Required scope prefixes (comma separated)</Label>
              <Input
                value={requiredScopePrefixesInput}
                onChange={(event) => setRequiredScopePrefixesInput(event.target.value)}
                placeholder="api:,read:,write:"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="oauth-forbid-offline" className="text-sm">Forbid offline_access scope</Label>
              <Switch
                id="oauth-forbid-offline"
                checked={forbidOfflineAccess}
                onChange={(event) => setForbidOfflineAccess(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="oauth-require-pkce" className="text-sm">Require PKCE</Label>
              <Switch
                id="oauth-require-pkce"
                checked={requirePkce}
                onChange={(event) => setRequirePkce(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="oauth-enforce-prefix" className="text-sm">Enforce scope naming prefixes</Label>
              <Switch
                id="oauth-enforce-prefix"
                checked={enforceScopePrefix}
                onChange={(event) => setEnforceScopePrefix(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="oauth-missing-policy-fields" className="text-sm">Flag missing token policy fields</Label>
              <Switch
                id="oauth-missing-policy-fields"
                checked={flagMissingPolicyFields}
                onChange={(event) => setFlagMissingPolicyFields(event.target.checked)}
              />
            </div>
          </div>
        </div>
      }
    />
  )
}
