import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { encodeURL, decodeURL } from "@/lib/utils/encoders"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { buildToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

function parseDomainSuffixes(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\s,]+/)
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    ),
  )
}

function inspectUrlFindings(candidate: string): ToolFinding[] {
  const findings: ToolFinding[] = []
  const trimmed = candidate.trim()
  if (!trimmed) return findings

  const protocolMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/)
  const protocol = protocolMatch?.[1]?.toLowerCase()

  if (protocol === "javascript" || protocol === "data") {
    findings.push({
      id: "url-dangerous-scheme",
      severity: "high",
      confidence: 88,
      category: "link-safety",
      title: "Potentially dangerous URL scheme detected",
      description: `Detected ${protocol}: scheme. Validate before sharing or rendering this link.`,
      remediation: "Prefer https:// URLs for user-facing links and block script/data schemes in untrusted contexts.",
    })
  }

  if (/%0d|%0a/i.test(trimmed)) {
    findings.push({
      id: "url-encoded-crlf",
      severity: "medium",
      confidence: 78,
      category: "input-safety",
      title: "Encoded CRLF characters present",
      description: "URL contains encoded line break characters that can be abused in header-splitting chains.",
      remediation: "Reject or sanitize CRLF payloads in redirect and header construction paths.",
    })
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.username || parsed.password) {
      findings.push({
        id: "url-embedded-credentials",
        severity: "medium",
        confidence: 90,
        category: "credential-exposure",
        title: "Embedded URL credentials found",
        description: "Username/password are embedded directly in the URL authority component.",
        remediation: "Move credentials to secure secret storage and authenticated request headers.",
      })
    }

    if (parsed.hostname.includes("xn--")) {
      findings.push({
        id: "url-punycode-host",
        severity: "low",
        confidence: 68,
        category: "identity-abuse",
        title: "Punycode hostname detected",
        description: "Internationalized hostname may require spoofing review in phishing-sensitive workflows.",
        remediation: "Validate expected domain ownership and monitor for homoglyph abuse.",
      })
    }
  } catch {
    if (trimmed.includes("://")) {
      findings.push({
        id: "url-parse-anomaly",
        severity: "low",
        confidence: 60,
        category: "data-quality",
        title: "URL parsing anomaly",
        description: "Input resembles a URL but could not be parsed as a standard absolute URL.",
        remediation: "Normalize and validate URL components before downstream automation.",
      })
    }
  }

  return findings
}

export default function UrlTool() {
  const [mode, setMode] = useState<"encode" | "decode">("encode")
  const [requireHttps, setRequireHttps] = useState(true)
  const [enforceHostScope, setEnforceHostScope] = useState(false)
  const [requiredHostSuffixesInput, setRequiredHostSuffixesInput] = useState("")
  const [maxOutputChars, setMaxOutputChars] = useState("4096")
  const [maxQueryParams, setMaxQueryParams] = useState("20")
  const [blockCredentials, setBlockCredentials] = useState(true)
  const [flagDoubleEncoding, setFlagDoubleEncoding] = useState(true)

  const handleModeChange = (value: string) => {
    if (value === "encode" || value === "decode") {
      setMode(value)
    }
  }

  const process = (input: string) => {
    const output = mode === "encode" ? encodeURL(input) : decodeURL(input)
    const inspectionTarget = mode === "decode" ? output : input
    const findings = inspectUrlFindings(inspectionTarget)

    const hostSuffixes = parseDomainSuffixes(requiredHostSuffixesInput)
    const outputLimit = Math.max(64, Number(maxOutputChars) || 4096)
    const queryLimit = Math.max(0, Number(maxQueryParams) || 20)

    let parsed: URL | null = null
    try {
      parsed = new URL(inspectionTarget)
    } catch {
      parsed = null
    }

    if (output.length > outputLimit) {
      findings.push({
        id: "url-output-length-limit",
        severity: output.length > outputLimit * 2 ? "high" : "medium",
        confidence: 82,
        category: "payload-governance",
        title: "Transformed URL exceeds output length policy",
        description: `Output length ${output.length} exceeds configured limit ${outputLimit}.`,
        remediation: "Use shortened URLs or remove unnecessary query parameters before distribution.",
      })
    }

    if (parsed) {
      if (requireHttps && parsed.protocol !== "https:") {
        findings.push({
          id: "url-non-https-policy",
          severity: "high",
          confidence: 90,
          category: "transport-security",
          title: "URL violates HTTPS-only policy",
          description: `Detected ${parsed.protocol.replace(":", "")} URL while HTTPS is required.`,
          remediation: "Enforce HTTPS-only URLs for redirects, callbacks, and user-facing links.",
        })
      }

      if (blockCredentials && (parsed.username || parsed.password)) {
        findings.push({
          id: "url-credentials-policy-block",
          severity: "high",
          confidence: 92,
          category: "credential-exposure",
          title: "Embedded URL credentials violate policy",
          description: "URL contains username/password fields in authority component.",
          remediation: "Remove credentials from URL and store secrets in approved secret managers.",
        })
      }

      if (queryLimit >= 0 && parsed.searchParams.size > queryLimit) {
        findings.push({
          id: "url-query-param-limit",
          severity: parsed.searchParams.size > queryLimit + 10 ? "medium" : "low",
          confidence: 74,
          category: "payload-governance",
          title: "Query parameter count exceeds threshold",
          description: `URL contains ${parsed.searchParams.size} query parameters; limit is ${queryLimit}.`,
          remediation: "Simplify query strings and remove unused tracking/state parameters.",
        })
      }

      if (enforceHostScope && hostSuffixes.length > 0) {
        const inScope = hostSuffixes.some((suffix) => parsed.hostname === suffix || parsed.hostname.endsWith(`.${suffix}`))
        if (!inScope) {
          findings.push({
            id: "url-host-scope-violation",
            severity: "high",
            confidence: 88,
            category: "domain-governance",
            title: "URL host outside allowed scope",
            description: `Host ${parsed.hostname} is outside configured scope allowlist.`,
            remediation: "Restrict URL handling to approved domains or update governance scope.",
          })
        }
      }
    }

    if (flagDoubleEncoding && /%25[0-9A-Fa-f]{2}/.test(inspectionTarget)) {
      findings.push({
        id: "url-double-encoding-signal",
        severity: "medium",
        confidence: 76,
        category: "input-safety",
        title: "Potential double-encoding detected",
        description: "Detected %25xx sequence pattern, which may indicate double-encoded payload data.",
        remediation: "Normalize decoding order and validate encoded payloads before processing.",
      })
    }

    if (findings.length === 0) {
      findings.push({
        id: "url-policy-pass",
        severity: "info",
        confidence: 71,
        category: "link-safety",
        title: "URL transformation passed policy checks",
        description: "No policy violations detected for transformed URL workflow.",
        remediation: "Continue enforcing URL normalization and host-scope controls in automation pipelines.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "URL transformation completed",
      text: mode === "encode"
        ? "URL encoding completed for safe transport and logging contexts."
        : "URL decoding completed for analyst inspection and triage.",
      findings,
      metrics: {
        inputChars: input.length,
        outputChars: output.length,
        changed: output === input ? 0 : 1,
        hostScopeRules: hostSuffixes.length,
      },
      baseScore: 98,
    })

    const recommendations = [
      "Normalize URLs before deduplication and reputation matching.",
      "Block dangerous schemes (javascript/data) in user-controllable redirect flows.",
      "Avoid storing credentials inside URL authority fields.",
      "Enforce host allowlists for outbound redirect/callback workflows.",
    ]

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "URL Encoder/Decoder",
        summary,
        findings,
        evidence: [
          {
            mode,
            input,
            output,
            inspectedTarget: inspectionTarget,
            changed: output !== input,
            host: parsed?.hostname ?? "",
            protocol: parsed?.protocol ?? "",
            queryParams: parsed?.searchParams.size ?? 0,
          },
        ],
        recommendations,
        raw: {
          mode,
          input,
          output,
          config: {
            requireHttps,
            enforceHostScope,
            hostSuffixes,
            outputLimit,
            queryLimit,
            blockCredentials,
            flagDoubleEncoding,
          },
        },
      }),
    )
  }

  return (
    <ToolTemplate
      toolName="URL Encoder/Decoder"
      description="Encode/decode URLs with enterprise link-safety controls, host-scope governance, and transport policy checks."
      actionLabel={mode === "encode" ? "Encode" : "Decode"}
      controls={
        <div className="space-y-3">
          <Tabs value={mode} onValueChange={handleModeChange} className="w-[200px]">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="encode">Encode</TabsTrigger>
              <TabsTrigger value="decode">Decode</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Max output chars</Label>
              <Input value={maxOutputChars} onChange={(event) => setMaxOutputChars(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Max query params</Label>
              <Input value={maxQueryParams} onChange={(event) => setMaxQueryParams(event.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Required host suffixes (comma separated)</Label>
              <Input
                value={requiredHostSuffixesInput}
                onChange={(event) => setRequiredHostSuffixesInput(event.target.value)}
                placeholder="example.com,corp.example"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="url-require-https">Require HTTPS URLs</Label>
              <Switch id="url-require-https" checked={requireHttps} onChange={(event) => setRequireHttps(event.target.checked)} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="url-enforce-scope">Enforce host suffix allowlist</Label>
              <Switch
                id="url-enforce-scope"
                checked={enforceHostScope}
                onChange={(event) => setEnforceHostScope(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="url-block-creds">Block embedded URL credentials</Label>
              <Switch
                id="url-block-creds"
                checked={blockCredentials}
                onChange={(event) => setBlockCredentials(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="url-flag-double-encode">Flag possible double-encoding</Label>
              <Switch
                id="url-flag-double-encode"
                checked={flagDoubleEncoding}
                onChange={(event) => setFlagDoubleEncoding(event.target.checked)}
              />
            </div>
          </div>
        </div>
      }
      onProcess={process}
      examples={[
        "https://example.com/search?q=hello world",
        "https%3A%2F%2Fexample.com%2Fsearch%3Fq%3Dhello%20world",
      ]}
    />
  )
}
