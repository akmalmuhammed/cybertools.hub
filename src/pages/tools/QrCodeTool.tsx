import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { QRCodeCanvas } from "qrcode.react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

type PayloadType = "url" | "wifi" | "email" | "phone" | "text"

function parseDomainAllowlist(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\s,]+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  )
}

function classifyPayload(payload: string): PayloadType {
  if (/^https?:\/\//i.test(payload)) return "url"
  if (/^WIFI:/i.test(payload)) return "wifi"
  if (/^mailto:/i.test(payload)) return "email"
  if (/^tel:/i.test(payload)) return "phone"
  return "text"
}

function containsSecretLikeText(payload: string): boolean {
  return /(api[_-]?key|token|secret|password|bearer\s+[A-Za-z0-9._-]{12,})/i.test(payload)
}

export default function QrCodeTool() {
  const [maxPayloadLength, setMaxPayloadLength] = useState("512")
  const [requiredDomains, setRequiredDomains] = useState("")
  const [requireHttpsForUrls, setRequireHttpsForUrls] = useState(true)
  const [flagCredentialUrls, setFlagCredentialUrls] = useState(true)
  const [flagSecretLikePayload, setFlagSecretLikePayload] = useState(true)

  const process = (input: string) => {
    const payload = input.trim()
    const type = classifyPayload(payload)
    const maxLength = Math.max(16, Number(maxPayloadLength) || 512)
    const allowlist = parseDomainAllowlist(requiredDomains)

    const findings: ToolFinding[] = []

    if (payload.length > maxLength) {
      findings.push({
        id: "qr-payload-length-exceeds-policy",
        severity: payload.length > maxLength * 1.5 ? "high" : "medium",
        confidence: 88,
        category: "payload-governance",
        title: "QR payload exceeds configured length",
        description: `Payload length ${payload.length} exceeds policy limit ${maxLength}.`,
        remediation: "Use shorter redirect URLs or token references for QR payloads.",
      })
    }

    if (flagSecretLikePayload && containsSecretLikeText(payload)) {
      findings.push({
        id: "qr-secret-like-content",
        severity: "high",
        confidence: 90,
        category: "secret-exposure",
        title: "Secret-like content detected in QR payload",
        description: "Payload appears to include token/secret/password style content.",
        remediation: "Replace embedded secrets with short-lived references and secure retrieval flow.",
      })
    }

    if (type === "url") {
      try {
        const parsed = new URL(payload)

        if (requireHttpsForUrls && parsed.protocol !== "https:") {
          findings.push({
            id: "qr-non-https-url",
            severity: "high",
            confidence: 92,
            category: "transport-security",
            title: "URL payload is not HTTPS",
            description: `Detected ${parsed.protocol.replace(":", "")} URL in QR payload while HTTPS is required.`,
            remediation: "Use HTTPS URLs only for production QR deployments.",
          })
        }

        if (flagCredentialUrls && (parsed.username || parsed.password)) {
          findings.push({
            id: "qr-url-embedded-credentials",
            severity: "high",
            confidence: 93,
            category: "credential-exposure",
            title: "URL contains embedded credentials",
            description: "QR URL includes username/password fields in the authority section.",
            remediation: "Remove URL credentials and rotate any exposed secrets.",
          })
        }

        if (allowlist.length > 0 && !allowlist.some((domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`))) {
          findings.push({
            id: "qr-domain-outside-allowlist",
            severity: "medium",
            confidence: 86,
            category: "domain-governance",
            title: "URL domain outside allowlist",
            description: `Host ${parsed.hostname} is outside configured domain allowlist policy.`,
            remediation: "Restrict QR links to approved domains or update governance scope.",
          })
        }

        if (parsed.hostname.includes("xn--")) {
          findings.push({
            id: "qr-punycode-domain",
            severity: "low",
            confidence: 69,
            category: "phishing-risk",
            title: "Punycode domain detected",
            description: "URL uses internationalized domain encoding and may require spoofing review.",
            remediation: "Validate domain ownership and monitor for homoglyph abuse.",
          })
        }
      } catch {
        findings.push({
          id: "qr-url-parse-error",
          severity: "medium",
          confidence: 74,
          category: "data-quality",
          title: "URL payload parsing failed",
          description: "Payload looked like a URL but could not be parsed reliably.",
          remediation: "Normalize URL syntax before QR generation.",
        })
      }
    }

    if (type === "wifi" && payload.length > 160) {
      findings.push({
        id: "qr-wifi-payload-heavy",
        severity: "low",
        confidence: 67,
        category: "usability",
        title: "Large Wi-Fi payload may reduce scan reliability",
        description: "Long Wi-Fi payloads can increase QR density and scanning failures on low-quality cameras.",
        remediation: "Use concise SSID names and avoid excessive optional Wi-Fi fields.",
      })
    }

    if (findings.length === 0) {
      findings.push({
        id: "qr-policy-pass",
        severity: "info",
        confidence: 72,
        category: "payload-governance",
        title: "QR payload passes configured policy controls",
        description: "No policy violations were detected for this QR payload.",
        remediation: "Document QR campaign ownership and rotation schedule for operational governance.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "QR payload analysis completed",
      text: `Prepared ${type.toUpperCase()} payload (${payload.length} chars) for QR generation with policy validation.`,
      findings,
      metrics: {
        payloadLength: payload.length,
        allowlistSize: allowlist.length,
        isUrl: type === "url" ? 1 : 0,
      },
      baseScore: 98,
    })

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "QR Code Generator",
        summary,
        findings,
        evidence: [
          {
            type,
            payloadLength: payload.length,
            payloadPreview: payload.slice(0, 200),
          },
        ],
        recommendations: [
          "Prefer HTTPS URLs and approved domains for externally distributed QR campaigns.",
          "Never embed static secrets or credentials directly inside QR payload data.",
          "Track QR payload ownership and expiry windows for incident response traceability.",
        ],
        raw: {
          payload,
          type,
          config: {
            maxLength,
            allowlist,
            requireHttpsForUrls,
            flagCredentialUrls,
            flagSecretLikePayload,
          },
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null

    const envelope = parseToolResultEnvelope(output, "QR Code Generator")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null

    const payload = typeof raw?.payload === "string" ? raw.payload : ""
    const type = typeof raw?.type === "string" ? raw.type : "text"
    if (!payload) return null

    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4 bg-white p-8 rounded-lg">
        <QRCodeCanvas value={payload} size={256} includeMargin level="M" />
        <p className="text-sm text-muted-foreground mt-2 text-center">
          Payload type: {type.toUpperCase()} | Length: {payload.length} chars
        </p>
      </div>
    )
  }

  return (
    <ToolTemplate
      toolName="QR Code Generator"
      description="Generate QR codes with payload governance checks for transport security, domain scope, and secret exposure risk."
      actionLabel="Generate"
      placeholder="https://example.com"
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Maximum payload length</Label>
              <Input value={maxPayloadLength} onChange={(event) => setMaxPayloadLength(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Required URL domains (comma separated)</Label>
              <Input
                value={requiredDomains}
                onChange={(event) => setRequiredDomains(event.target.value)}
                placeholder="example.com,secure.example"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="qr-require-https">Require HTTPS for URL payloads</Label>
              <Switch
                id="qr-require-https"
                checked={requireHttpsForUrls}
                onChange={(event) => setRequireHttpsForUrls(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="qr-flag-creds">Flag URL embedded credentials</Label>
              <Switch
                id="qr-flag-creds"
                checked={flagCredentialUrls}
                onChange={(event) => setFlagCredentialUrls(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="qr-flag-secret">Flag secret-like payload strings</Label>
              <Switch
                id="qr-flag-secret"
                checked={flagSecretLikePayload}
                onChange={(event) => setFlagSecretLikePayload(event.target.checked)}
              />
            </div>
          </div>
        </div>
      }
      examples={[
        "https://google.com",
        "WIFI:S:MyNetwork;T:WPA;P:password;;",
        "mailto:soc@example.com?subject=Incident%20Report",
      ]}
    />
  )
}
