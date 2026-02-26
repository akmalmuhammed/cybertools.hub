import { useState } from "react"
import { CopyButton } from "@/components/features/CopyButton"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import {
  extractIocs,
  flattenIocs,
  type IocExtractionResult,
  type IocType,
} from "@/lib/utils/ioc"
import { classifyIp } from "@/lib/utils/ip-intel"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

const IOC_ORDER: IocType[] = [
  "url",
  "domain",
  "email",
  "ipv4",
  "ipv6",
  "md5",
  "sha1",
  "sha256",
  "sha512",
  "cve",
]

const IOC_LABELS: Record<IocType, string> = {
  url: "URLs",
  domain: "Domains",
  email: "Emails",
  ipv4: "IPv4",
  ipv6: "IPv6",
  md5: "MD5",
  sha1: "SHA-1",
  sha256: "SHA-256",
  sha512: "SHA-512",
  cve: "CVEs",
}

export default function IocExtractorTool() {
  const [includePrivateIps, setIncludePrivateIps] = useState(false)
  const [includeDomainsFromUrls, setIncludeDomainsFromUrls] = useState(true)
  const [includeDomainsFromEmails, setIncludeDomainsFromEmails] = useState(true)
  const [highVolumeThreshold, setHighVolumeThreshold] = useState("50")
  const [maxEvidenceRows, setMaxEvidenceRows] = useState("300")
  const [requireStrongHashes, setRequireStrongHashes] = useState(true)
  const [flagEmailExposure, setFlagEmailExposure] = useState(true)

  const process = (input: string) => {
    const extraction = extractIocs(input, {
      includePrivateIps,
      includeDomainsFromUrls,
      includeDomainsFromEmails,
    })

    const flattened = flattenIocs(extraction)
    const findings: ToolFinding[] = []

    const volumeThreshold = Math.max(1, Number(highVolumeThreshold) || 50)
    const evidenceLimit = Math.max(20, Math.min(2000, Number(maxEvidenceRows) || 300))

    if (extraction.total === 0) {
      findings.push({
        id: "ioc-extractor-empty",
        severity: "info",
        confidence: 75,
        category: "input-quality",
        title: "No indicators extracted",
        description: "Input did not yield supported IOC artifacts.",
        remediation: "Verify source text includes URL/domain/IP/hash/CVE indicators and refang heavily obfuscated values.",
      })
    }

    if (extraction.total > volumeThreshold) {
      findings.push({
        id: "ioc-extractor-high-volume",
        severity: extraction.total > volumeThreshold * 2 ? "high" : "medium",
        confidence: 79,
        category: "triage-workload",
        title: "High IOC volume detected",
        description: `${extraction.total} indicators extracted, threshold set to ${volumeThreshold}.`,
        remediation: "Prioritize by type and confidence/TTL scoring before escalating for containment.",
      })
    }

    if (!includeDomainsFromUrls) {
      findings.push({
        id: "ioc-extractor-url-domain-derivation-disabled",
        severity: "low",
        confidence: 70,
        category: "coverage-gap",
        title: "Domain derivation from URLs disabled",
        description: "URL host extraction is disabled and may hide pivot opportunities.",
        remediation: "Enable URL domain derivation when preparing correlation or enrichment workflows.",
      })
    }

    if (!includeDomainsFromEmails && extraction.counts.email > 0) {
      findings.push({
        id: "ioc-extractor-email-domain-derivation-disabled",
        severity: "low",
        confidence: 68,
        category: "coverage-gap",
        title: "Email domain derivation disabled",
        description: "Email indicators are present but sender-domain pivots are disabled.",
        remediation: "Enable email-domain derivation for phishing and identity investigations.",
      })
    }

    if (requireStrongHashes) {
      const weakHashes = extraction.counts.md5 + extraction.counts.sha1
      const strongHashes = extraction.counts.sha256 + extraction.counts.sha512
      if (weakHashes > 0 && strongHashes === 0) {
        findings.push({
          id: "ioc-extractor-weak-hash-only",
          severity: "medium",
          confidence: 76,
          category: "indicator-quality",
          title: "Only weak hash indicators detected",
          description: `Detected ${weakHashes} MD5/SHA1 hash(es) without SHA-256/SHA-512 equivalents.`,
          remediation: "Prefer SHA-256/SHA-512 for high-fidelity matching and sharing.",
        })
      } else if (weakHashes > 0) {
        findings.push({
          id: "ioc-extractor-weak-hash-present",
          severity: "low",
          confidence: 69,
          category: "indicator-quality",
          title: "Weak hash indicators present",
          description: `Detected ${weakHashes} weak hash(es) alongside ${strongHashes} stronger hash(es).`,
          remediation: "Phase out weak hash usage in blocklists and canonical IOC sets.",
        })
      }
    }

    if (flagEmailExposure && extraction.counts.email > 0) {
      findings.push({
        id: "ioc-extractor-email-observables",
        severity: "medium",
        confidence: 73,
        category: "data-handling",
        title: "Email observables extracted",
        description: `${extraction.counts.email} email indicator(s) detected; may include personal data.`,
        remediation: "Handle exports under data-classification policy and redact when sharing externally.",
      })
    }

    const allIpValues = [...extraction.items.ipv4, ...extraction.items.ipv6]
    if (allIpValues.length > 0) {
      const nonPublicCount = allIpValues.filter((ip) => classifyIp(ip).scope !== "public").length
      if (nonPublicCount > 0) {
        findings.push({
          id: "ioc-extractor-non-public-ip",
          severity: includePrivateIps ? "low" : "info",
          confidence: 71,
          category: "indicator-context",
          title: "Non-public IP indicators present",
          description: `${nonPublicCount} IP indicator(s) fall in private/reserved scopes.`,
          remediation: "Interpret these IOCs in internal context and avoid external blocking assumptions.",
        })
      }
    }

    const punycodeDomains = extraction.items.domain.filter((domain) => domain.startsWith("xn--"))
    if (punycodeDomains.length > 0) {
      findings.push({
        id: "ioc-extractor-punycode-domain",
        severity: "low",
        confidence: 70,
        category: "brand-abuse",
        title: "Punycode domains detected",
        description: `${punycodeDomains.length} punycode domain(s) found; review for homograph abuse risk.`,
        remediation: "Correlate with domain age, registrar context, and spoof-detection workflows.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "IOC extraction completed",
      text: `Extracted ${extraction.total} indicator(s) across ${IOC_ORDER.filter((type) => extraction.counts[type] > 0).length} IOC type(s).`,
      findings,
      metrics: {
        total: extraction.total,
        urls: extraction.counts.url,
        domains: extraction.counts.domain,
        emails: extraction.counts.email,
        ipv4: extraction.counts.ipv4,
        ipv6: extraction.counts.ipv6,
        hashes: extraction.counts.md5 + extraction.counts.sha1 + extraction.counts.sha256 + extraction.counts.sha512,
        cves: extraction.counts.cve,
      },
      baseScore: 95,
    })

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "IOC Extractor",
        summary,
        findings,
        evidence: flattened.slice(0, evidenceLimit),
        recommendations: [
          "Normalize and deduplicate extracted IOCs before enrichment or detection matching.",
          "Treat high-volume extracts as triage queues and prioritize by confidence and freshness.",
          "Protect IOC exports that include email or internal addressing artifacts.",
        ],
        raw: {
          extraction,
          config: {
            includePrivateIps,
            includeDomainsFromUrls,
            includeDomainsFromEmails,
            volumeThreshold,
            evidenceLimit,
            requireStrongHashes,
            flagEmailExposure,
          },
          evidenceTruncated: flattened.length > evidenceLimit,
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    const envelope = parseToolResultEnvelope(output, "IOC Extractor")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null
    const parsed = raw?.extraction as IocExtractionResult | undefined
    if (!parsed) return null

    if (parsed.total === 0) {
      return (
        <div className="h-full min-h-[300px] rounded-lg border border-dashed flex items-center justify-center text-muted-foreground">
          No indicators found in the input.
        </div>
      )
    }

    const flattened = flattenIocs(parsed)
    const exportText = flattened
      .map((ioc) => `${ioc.type.toUpperCase()},${ioc.value}`)
      .join("\n")

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Detected <span className="font-semibold text-foreground">{parsed.total}</span>{" "}
            indicators.
          </div>
          <CopyButton text={exportText} size="sm" variant="outline" />
        </div>

        <div className="flex flex-wrap gap-2">
          {IOC_ORDER.filter((type) => parsed.counts[type] > 0).map((type) => (
            <Badge key={type} variant="secondary" className="font-mono">
              {IOC_LABELS[type]}: {parsed.counts[type]}
            </Badge>
          ))}
        </div>

        <div className="space-y-3">
          {IOC_ORDER.filter((type) => parsed.counts[type] > 0).map((type) => {
            const values = parsed.items[type]
            const text = values.join("\n")
            return (
              <div key={type} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    {IOC_LABELS[type]} ({values.length})
                  </h3>
                  <CopyButton text={text} size="sm" variant="outline" />
                </div>
                <pre className="max-h-40 overflow-auto rounded border bg-background p-2 text-xs font-mono whitespace-pre-wrap break-all">
                  {text}
                </pre>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <ToolTemplate
      toolName="IOC Extractor"
      description="Extract IOCs from raw content with enterprise quality controls, triage findings, and export-safe evidence."
      actionLabel="Extract IOCs"
      placeholder="Paste logs, headers, chat transcripts, or incident notes..."
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>High-volume threshold</Label>
              <Input
                value={highVolumeThreshold}
                onChange={(event) => setHighVolumeThreshold(event.target.value)}
                placeholder="50"
              />
            </div>
            <div className="space-y-1">
              <Label>Max evidence rows</Label>
              <Input
                value={maxEvidenceRows}
                onChange={(event) => setMaxEvidenceRows(event.target.value)}
                placeholder="300"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="ioc-private-ips">Include private/reserved IPs</Label>
            <Switch
              id="ioc-private-ips"
              checked={includePrivateIps}
              onChange={(event) => setIncludePrivateIps(event.target.checked)}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="ioc-domain-from-url">Derive domains from URLs</Label>
            <Switch
              id="ioc-domain-from-url"
              checked={includeDomainsFromUrls}
              onChange={(event) => setIncludeDomainsFromUrls(event.target.checked)}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="ioc-domain-from-email">Derive domains from emails</Label>
            <Switch
              id="ioc-domain-from-email"
              checked={includeDomainsFromEmails}
              onChange={(event) => setIncludeDomainsFromEmails(event.target.checked)}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="ioc-require-strong-hashes">Flag weak hash-only indicators</Label>
            <Switch
              id="ioc-require-strong-hashes"
              checked={requireStrongHashes}
              onChange={(event) => setRequireStrongHashes(event.target.checked)}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="ioc-flag-email-exposure">Flag email data exposure</Label>
            <Switch
              id="ioc-flag-email-exposure"
              checked={flagEmailExposure}
              onChange={(event) => setFlagEmailExposure(event.target.checked)}
            />
          </div>
        </div>
      }
      examples={[
        "https://example.com/login?token=abc\nuser@corp.com\n8.8.8.8\nCVE-2024-12345",
        "Alert: md5=d41d8cd98f00b204e9800998ecf8427e sha256=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "Received from 10.10.1.5 to 203.0.113.10, callback hxxp://evil.example[.]com",
      ]}
    />
  )
}
