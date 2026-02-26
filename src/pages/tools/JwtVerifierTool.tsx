import { useState } from "react"
import { ToolTemplate, type ToolProcessContext } from "@/components/tools/ToolTemplate"
import {
  verifyJwsSignature,
  type JwtKeySource,
  type SupportedJwtAlgorithm,
  type VerifyJwsResult,
} from "@/lib/utils/jwt-verify"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

type KeyMode = JwtKeySource["kind"]
type OidcPreset = "custom" | "oidc-api" | "oidc-spa" | "machine"

const SUPPORTED_ALGS: SupportedJwtAlgorithm[] = [
  "HS256",
  "HS384",
  "HS512",
  "RS256",
  "RS384",
  "RS512",
  "PS256",
  "PS384",
  "PS512",
]

function reasonCode(result: VerifyJwsResult): string {
  if (result.valid) return "VERIFIED"
  const reason = result.reason?.toLowerCase() ?? ""
  if (reason.includes("algorithm mismatch")) return "ALG_MISMATCH"
  if (reason.includes("expired")) return "TOKEN_EXPIRED"
  if (reason.includes("not yet valid")) return "TOKEN_NOT_YET_VALID"
  if (reason.includes("signature mismatch")) return "SIGNATURE_MISMATCH"
  if (reason.includes("issuer mismatch")) return "ISSUER_MISMATCH"
  if (reason.includes("audience mismatch")) return "AUDIENCE_MISMATCH"
  if (reason.includes("subject mismatch")) return "SUBJECT_MISMATCH"
  return "VERIFICATION_FAILED"
}

function baseFindingFromClaimError(error: string, index: number): ToolFinding {
  const normalized = error.toLowerCase()
  if (normalized.includes("expired")) {
    return {
      id: `jwt-claim-expired-${index}`,
      severity: "high",
      confidence: 86,
      category: "token-lifecycle",
      title: "JWT token is expired",
      description: error,
      remediation: "Ensure token refresh flow is operating and clock sync is healthy across issuer and verifiers.",
    }
  }
  if (normalized.includes("not yet valid")) {
    return {
      id: `jwt-claim-not-yet-valid-${index}`,
      severity: "medium",
      confidence: 78,
      category: "token-lifecycle",
      title: "JWT not yet valid",
      description: error,
      remediation: "Validate `nbf` issuance logic and check system clock skew between systems.",
    }
  }
  if (normalized.includes("issuer mismatch")) {
    return {
      id: `jwt-claim-issuer-${index}`,
      severity: "high",
      confidence: 84,
      category: "identity-policy",
      title: "Issuer validation failed",
      description: error,
      remediation: "Pin verifier configuration to trusted issuer values for each environment.",
    }
  }
  if (normalized.includes("audience mismatch")) {
    return {
      id: `jwt-claim-audience-${index}`,
      severity: "high",
      confidence: 84,
      category: "identity-policy",
      title: "Audience validation failed",
      description: error,
      remediation: "Require service-specific audience values and reject cross-service token reuse.",
    }
  }
  if (normalized.includes("subject mismatch")) {
    return {
      id: `jwt-claim-subject-${index}`,
      severity: "medium",
      confidence: 75,
      category: "identity-policy",
      title: "Subject validation failed",
      description: error,
      remediation: "Enforce subject binding rules where subject identity is part of access policy.",
    }
  }

  return {
    id: `jwt-claim-error-${index}`,
    severity: "medium",
    confidence: 70,
    category: "claim-validation",
    title: "JWT claim validation error",
    description: error,
    remediation: "Review claim constraints and token issuance profile for this workload.",
  }
}

export default function JwtVerifierTool() {
  const [keyMode, setKeyMode] = useState<KeyMode>("secret")
  const [preset, setPreset] = useState<OidcPreset>("custom")
  const [keyInput, setKeyInput] = useState("")
  const [expectedAlg, setExpectedAlg] = useState<string>("")
  const [expectedIssuer, setExpectedIssuer] = useState("")
  const [expectedAudience, setExpectedAudience] = useState("")
  const [expectedSubject, setExpectedSubject] = useState("")
  const [validateTimeClaims, setValidateTimeClaims] = useState(true)
  const [clockSkewSec, setClockSkewSec] = useState("60")
  const [timeoutMs, setTimeoutMs] = useState("8000")
  const [requireKid, setRequireKid] = useState(true)
  const [requireIssuedAtClaim, setRequireIssuedAtClaim] = useState(false)
  const [requireJwtIdClaim, setRequireJwtIdClaim] = useState(false)

  const applyPreset = (value: OidcPreset) => {
    setPreset(value)
    if (value === "custom") return

    if (value === "oidc-api") {
      setExpectedAlg("RS256")
      setValidateTimeClaims(true)
      setClockSkewSec("60")
      setRequireKid(true)
      return
    }

    if (value === "oidc-spa") {
      setExpectedAlg("RS256")
      setValidateTimeClaims(true)
      setClockSkewSec("120")
      setRequireKid(true)
      return
    }

    setExpectedAlg("PS256")
    setValidateTimeClaims(true)
    setClockSkewSec("45")
    setRequireKid(true)
  }

  const handleKeyModeChange = (value: string) => {
    if (value === "secret" || value === "pem" || value === "jwk" || value === "jwks-url") {
      setKeyMode(value)
    }
  }

  const process = async (input: string, context: ToolProcessContext) => {
    if (!keyInput.trim()) throw new Error("Verification key input is required.")
    if (context.localOnly && keyMode === "jwks-url") {
      throw new Error("Local-only mode is enabled. Disable local-only mode to resolve keys from a JWKS URL.")
    }

    const keySource: JwtKeySource =
      keyMode === "secret"
        ? { kind: "secret", secret: keyInput }
        : keyMode === "pem"
          ? { kind: "pem", pem: keyInput }
          : keyMode === "jwk"
            ? { kind: "jwk", jwk: keyInput }
            : { kind: "jwks-url", url: keyInput.trim() }

    const normalizedExpectedAlg = expectedAlg.trim().toUpperCase()
    const expectedAlgorithm = SUPPORTED_ALGS.includes(normalizedExpectedAlg as SupportedJwtAlgorithm)
      ? (normalizedExpectedAlg as SupportedJwtAlgorithm)
      : undefined

    const verification = await verifyJwsSignature(input, {
      keySource,
      expectedAlgorithm,
      expectedIssuer: expectedIssuer.trim() || undefined,
      expectedAudience: expectedAudience.trim() || undefined,
      expectedSubject: expectedSubject.trim() || undefined,
      validateTimeClaims,
      clockSkewSec: Number(clockSkewSec) || 0,
      timeoutMs: Number(timeoutMs) || 8000,
    })

    const findings: ToolFinding[] = []

    if (!verification.signatureVerified) {
      const reason = verification.reason ?? "Signature validation failed."
      const normalized = reason.toLowerCase()
      const isAlgMismatch = normalized.includes("algorithm mismatch")
      findings.push({
        id: isAlgMismatch ? "jwt-algorithm-mismatch" : "jwt-signature-invalid",
        severity: "high",
        confidence: isAlgMismatch ? 90 : 88,
        category: "signature-validation",
        title: isAlgMismatch ? "JWT algorithm mismatch" : "JWT signature verification failed",
        description: reason,
        remediation: isAlgMismatch
          ? "Pin expected algorithm and reject tokens where `alg` does not match policy."
          : "Validate key material, algorithm pairing, and signature generation path.",
      })
    }

    verification.claimErrors.forEach((error, index) => {
      if (error.toLowerCase().includes("claims were not evaluated")) return
      findings.push(baseFindingFromClaimError(error, index))
    })

    if (!expectedAlgorithm) {
      findings.push({
        id: "jwt-policy-expected-alg-missing",
        severity: "medium",
        confidence: 82,
        category: "policy-hardening",
        title: "Expected algorithm not pinned",
        description: "Verifier accepts the token-declared algorithm without a policy-level algorithm pin.",
        remediation: "Set an expected algorithm to prevent algorithm confusion and policy drift.",
      })
    }

    if (!expectedAudience.trim()) {
      findings.push({
        id: "jwt-policy-audience-missing",
        severity: "medium",
        confidence: 79,
        category: "policy-hardening",
        title: "Audience constraint not configured",
        description: "No expected `aud` value is set for token validation.",
        remediation: "Bind audience checks to each API or service to prevent token replay across services.",
      })
    }

    if (!expectedIssuer.trim()) {
      findings.push({
        id: "jwt-policy-issuer-missing",
        severity: "low",
        confidence: 74,
        category: "policy-hardening",
        title: "Issuer constraint not configured",
        description: "No expected `iss` value is configured.",
        remediation: "Set an expected issuer to reduce acceptance of tokens from untrusted issuers.",
      })
    }

    if (!validateTimeClaims) {
      findings.push({
        id: "jwt-time-validation-disabled",
        severity: "medium",
        confidence: 84,
        category: "token-lifecycle",
        title: "Time-based claim validation disabled",
        description: "`exp` and `nbf` validation is disabled.",
        remediation: "Enable time claim validation for production and keep system clocks synchronized.",
      })
    }

    const effectiveClockSkew = Number(clockSkewSec) || 0
    if (validateTimeClaims && effectiveClockSkew > 300) {
      findings.push({
        id: "jwt-clock-skew-wide",
        severity: "low",
        confidence: 68,
        category: "token-lifecycle",
        title: "Large clock skew allowance",
        description: `Clock skew is set to ${effectiveClockSkew} seconds.`,
        remediation: "Keep skew narrowly scoped to operational need and fix underlying time drift.",
      })
    }

    if (requireKid && !verification.keyId) {
      findings.push({
        id: "jwt-kid-missing",
        severity: "medium",
        confidence: 80,
        category: "key-management",
        title: "JWT header missing `kid`",
        description: "No key ID was found in the JWT header.",
        remediation: "Include `kid` on issued tokens to support safe key rotation and deterministic verification.",
      })
    }

    const payload = verification.payload as Record<string, unknown>
    if (requireIssuedAtClaim && typeof payload.iat !== "number") {
      findings.push({
        id: "jwt-iat-missing",
        severity: "low",
        confidence: 72,
        category: "claim-governance",
        title: "`iat` claim missing",
        description: "Token does not include an issued-at (`iat`) claim.",
        remediation: "Add `iat` to improve token age analysis and replay investigations.",
      })
    }

    if (requireJwtIdClaim && typeof payload.jti !== "string") {
      findings.push({
        id: "jwt-jti-missing",
        severity: "low",
        confidence: 72,
        category: "claim-governance",
        title: "`jti` claim missing",
        description: "Token does not include a JWT ID (`jti`) claim.",
        remediation: "Include `jti` to support revocation and anti-replay controls.",
      })
    }

    if (preset !== "custom" && verification.algorithm?.startsWith("HS")) {
      findings.push({
        id: "jwt-preset-weak-alg-profile",
        severity: "high",
        confidence: 88,
        category: "identity-policy",
        title: "Algorithm deviates from preset trust profile",
        description: `Preset ${preset} was selected but token algorithm is ${verification.algorithm}.`,
        remediation: "Use asymmetric signing for OIDC/API workloads and align issuer policy to RS*/PS* algorithms.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "JWT verification completed",
      text: `Token ${verification.valid ? "passed" : "failed"} verification with reason code ${reasonCode(verification)}.`,
      findings,
      metrics: {
        signatureVerified: verification.signatureVerified ? 1 : 0,
        claimsValid: verification.claimsValid ? 1 : 0,
        claimErrorCount: verification.claimErrors.length,
        hasKid: verification.keyId ? 1 : 0,
        policyChecksEnabled:
          (expectedAlgorithm ? 1 : 0)
          + (expectedIssuer.trim() ? 1 : 0)
          + (expectedAudience.trim() ? 1 : 0)
          + (expectedSubject.trim() ? 1 : 0)
          + (validateTimeClaims ? 1 : 0)
          + (requireKid ? 1 : 0)
          + (requireIssuedAtClaim ? 1 : 0)
          + (requireJwtIdClaim ? 1 : 0),
      },
      baseScore: 95,
    })

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "JWT/JWS Signature Verifier",
        summary,
        findings,
        evidence: [
          {
            valid: verification.valid,
            signatureVerified: verification.signatureVerified,
            claimsValid: verification.claimsValid,
            reason: verification.reason ?? null,
            reasonCode: reasonCode(verification),
            algorithm: verification.algorithm,
            keySource: verification.keySource,
            keyId: verification.keyId,
            claimErrors: verification.claimErrors,
          },
        ],
        recommendations: [
          "Pin expected algorithm, issuer, and audience for every trust boundary.",
          "Prefer asymmetric signing (RS*/PS*) with deterministic key rotation and `kid` governance.",
          "Keep exp/nbf validation enabled and monitor clock skew drift in production systems.",
        ],
        raw: {
          jwtVerify: verification,
          policy: {
            preset,
            keyMode,
            expectedAlgorithm: expectedAlgorithm ?? null,
            expectedIssuer: expectedIssuer.trim() || null,
            expectedAudience: expectedAudience.trim() || null,
            expectedSubject: expectedSubject.trim() || null,
            validateTimeClaims,
            clockSkewSec: effectiveClockSkew,
            requireKid,
            requireIssuedAtClaim,
            requireJwtIdClaim,
          },
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null
    const envelope = parseToolResultEnvelope(output, "JWT/JWS Signature Verifier")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null
    const parsed = raw?.jwtVerify as VerifyJwsResult | undefined
    const policy = raw?.policy && typeof raw.policy === "object" && raw.policy !== null
      ? (raw.policy as Record<string, unknown>)
      : null

    if (!parsed) return null

    return (
      <div className="space-y-4">
        <div className="p-3 border rounded bg-muted/20">
          <div className="text-xs font-bold text-muted-foreground uppercase">Verification Status</div>
          <div
            className={
              parsed.valid
                ? "text-green-600 dark:text-green-400 font-semibold"
                : "text-red-600 dark:text-red-400 font-semibold"
            }
          >
            {parsed.valid ? "Token Accepted" : "Token Rejected"}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Algorithm: {parsed.algorithm ?? "Unknown"} | Key Source: {parsed.keySource}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Reason code: {reasonCode(parsed)}
            {parsed.keyId ? ` | kid: ${parsed.keyId}` : " | kid: missing"}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Signature: {parsed.signatureVerified ? "valid" : "invalid"} | Claims: {parsed.claimsValid ? "valid" : "invalid"}
          </div>
          {parsed.reason && <div className="text-sm text-muted-foreground mt-1">{parsed.reason}</div>}
          {parsed.claimErrors.length > 0 && (
            <ul className="text-xs text-muted-foreground mt-2 space-y-1">
              {parsed.claimErrors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          )}
        </div>

        {policy && (
          <div className="p-3 border rounded bg-muted/20 space-y-1">
            <h3 className="text-sm font-semibold">Policy Profile</h3>
            <div className="text-xs text-muted-foreground">
              Preset: {String(policy.preset ?? "custom")} | Key mode: {String(policy.keyMode ?? "unknown")}
            </div>
            <div className="text-xs text-muted-foreground">
              Expected alg: {String(policy.expectedAlgorithm ?? "none")} | Validate time: {policy.validateTimeClaims ? "Yes" : "No"}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">JWT Header</h3>
          <pre className="p-3 rounded border bg-muted/20 text-xs font-mono overflow-auto">
            {JSON.stringify(parsed.header, null, 2)}
          </pre>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">JWT Payload</h3>
          <pre className="p-3 rounded border bg-muted/20 text-xs font-mono overflow-auto">
            {JSON.stringify(parsed.payload, null, 2)}
          </pre>
        </div>
      </div>
    )
  }

  return (
    <ToolTemplate
      toolName="JWT/JWS Signature Verifier"
      description="Verify JWT/JWS signatures with enterprise policy controls for algorithm pinning, claim governance, and key management hygiene."
      actionLabel="Verify Signature"
      placeholder="eyJhbGciOi..."
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>OIDC/JWT Policy Preset</Label>
            <Tabs
              value={preset}
              onValueChange={(value) => {
                if (value === "custom" || value === "oidc-api" || value === "oidc-spa" || value === "machine") {
                  applyPreset(value)
                }
              }}
              className="w-full"
            >
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="custom">Custom</TabsTrigger>
                <TabsTrigger value="oidc-api">OIDC API</TabsTrigger>
                <TabsTrigger value="oidc-spa">OIDC SPA</TabsTrigger>
                <TabsTrigger value="machine">Machine</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-1">
            <Label>Key Source</Label>
            <Tabs value={keyMode} onValueChange={handleKeyModeChange} className="w-full">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="secret">Secret</TabsTrigger>
                <TabsTrigger value="pem">PEM</TabsTrigger>
                <TabsTrigger value="jwk">JWK</TabsTrigger>
                <TabsTrigger value="jwks-url">JWKS URL</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-1">
            <Label>{keyMode === "jwks-url" ? "JWKS URL" : "Verification Key"}</Label>
            {keyMode === "jwks-url" ? (
              <Input
                value={keyInput}
                onChange={(event) => setKeyInput(event.target.value)}
                placeholder="https://issuer.example/.well-known/jwks.json"
              />
            ) : (
              <Textarea
                value={keyInput}
                onChange={(event) => setKeyInput(event.target.value)}
                className="min-h-[100px] font-mono text-xs"
                placeholder={
                  keyMode === "secret"
                    ? "shared-secret"
                    : keyMode === "pem"
                      ? "-----BEGIN PUBLIC KEY-----..."
                      : '{"kty":"RSA","n":"...","e":"AQAB"}'
                }
              />
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Expected Algorithm (optional)</Label>
              <Input
                value={expectedAlg}
                onChange={(event) => setExpectedAlg(event.target.value)}
                placeholder="HS256 / RS256 / PS256..."
              />
            </div>
            <div className="space-y-1">
              <Label>Timeout (ms)</Label>
              <Input
                value={timeoutMs}
                onChange={(event) => setTimeoutMs(event.target.value)}
                placeholder="8000"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Expected Issuer (iss)</Label>
              <Input
                value={expectedIssuer}
                onChange={(event) => setExpectedIssuer(event.target.value)}
                placeholder="https://issuer.example"
              />
            </div>
            <div className="space-y-1">
              <Label>Expected Audience (aud)</Label>
              <Input
                value={expectedAudience}
                onChange={(event) => setExpectedAudience(event.target.value)}
                placeholder="api://my-service"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Expected Subject (sub)</Label>
              <Input
                value={expectedSubject}
                onChange={(event) => setExpectedSubject(event.target.value)}
                placeholder="user-123"
              />
            </div>
            <div className="space-y-1">
              <Label>Clock Skew (sec)</Label>
              <Input
                value={clockSkewSec}
                onChange={(event) => setClockSkewSec(event.target.value)}
                placeholder="60"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="jwt-validate-time-claims" className="text-sm">Validate exp/nbf claims</Label>
              <Switch
                id="jwt-validate-time-claims"
                checked={validateTimeClaims}
                onChange={(event) => setValidateTimeClaims(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="jwt-require-kid" className="text-sm">Require `kid` header</Label>
              <Switch
                id="jwt-require-kid"
                checked={requireKid}
                onChange={(event) => setRequireKid(event.target.checked)}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="jwt-require-iat" className="text-sm">Require `iat` claim</Label>
              <Switch
                id="jwt-require-iat"
                checked={requireIssuedAtClaim}
                onChange={(event) => setRequireIssuedAtClaim(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="jwt-require-jti" className="text-sm">Require `jti` claim</Label>
              <Switch
                id="jwt-require-jti"
                checked={requireJwtIdClaim}
                onChange={(event) => setRequireJwtIdClaim(event.target.checked)}
              />
            </div>
          </div>

          {keyMode === "jwks-url" && (
            <p className="text-xs text-muted-foreground">
              JWKS diagnostics: ensure URL is issuer-controlled, HTTPS-only, and contains the matching <code>kid</code>.
            </p>
          )}
        </div>
      }
      examples={[
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "Bearer eyJraWQiOiJrZXkxIiwiYWxnIjoiUlMyNTYifQ...",
      ]}
    />
  )
}
