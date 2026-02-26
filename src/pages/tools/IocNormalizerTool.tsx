import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import {
  normalizeAndCanonicalizeIocs,
  type IocNormalizationResult,
  type CanonicalIoc,
} from "@/lib/utils/ioc-normalizer"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

function typeBadgeColor(type: string): string {
  if (type === "url") return "text-blue-600 dark:text-blue-400"
  if (type === "domain") return "text-purple-600 dark:text-purple-400"
  if (type === "email") return "text-amber-600 dark:text-amber-400"
  if (type === "ipv4" || type === "ipv6") return "text-green-600 dark:text-green-400"
  return "text-muted-foreground"
}

function hasUnicode(value: string): boolean {
  return /[^\x20-\x7E]/.test(value)
}

export default function IocNormalizerTool() {
  const [maxEvidenceRows, setMaxEvidenceRows] = useState("300")
  const [variantThreshold, setVariantThreshold] = useState("4")
  const [collapseRatioThreshold, setCollapseRatioThreshold] = useState("3")
  const [flagInsecureHttpUrls, setFlagInsecureHttpUrls] = useState(true)
  const [flagPunycodeDomains, setFlagPunycodeDomains] = useState(true)
  const [flagUnmatchedTokens, setFlagUnmatchedTokens] = useState(true)

  const process = (input: string) => {
    const normalization = normalizeAndCanonicalizeIocs(input)
    const findings: ToolFinding[] = []

    const evidenceLimit = Math.max(20, Math.min(2000, Number(maxEvidenceRows) || 300))
    const maxVariants = Math.max(2, Number(variantThreshold) || 4)
    const collapseThreshold = Math.max(1, Number(collapseRatioThreshold) || 3)

    if (normalization.summary.deduplicated === 0) {
      findings.push({
        id: "ioc-normalizer-empty",
        severity: "info",
        confidence: 74,
        category: "input-quality",
        title: "No supported IOC tokens normalized",
        description: "Input did not produce canonical IOC entries.",
        remediation: "Provide URL/domain/email/IP IOC material and refang heavily obfuscated indicators.",
      })
    }

    if (normalization.summary.deduplicated > 0) {
      const collapseRatio = normalization.summary.normalized / normalization.summary.deduplicated
      if (collapseRatio >= collapseThreshold) {
        findings.push({
          id: "ioc-normalizer-high-collapse-ratio",
          severity: collapseRatio >= collapseThreshold * 2 ? "high" : "medium",
          confidence: 78,
          category: "obfuscation-signal",
          title: "High normalization collapse ratio",
          description: `Normalized-to-deduplicated ratio is ${collapseRatio.toFixed(2)} (threshold=${collapseThreshold}).`,
          remediation: "Review merged variants for obfuscation patterns and retain raw evidence for attribution.",
        })
      }
    }

    const highVariantEntries = normalization.entries.filter((entry) => entry.originals.length >= maxVariants)
    if (highVariantEntries.length > 0) {
      findings.push({
        id: "ioc-normalizer-high-variant-count",
        severity: highVariantEntries.length > 5 ? "medium" : "low",
        confidence: 73,
        category: "obfuscation-signal",
        title: "Canonical entries with many observed variants",
        description: `${highVariantEntries.length} canonical IOC(s) have at least ${maxVariants} observed raw variants.`,
        remediation: "Track these as potential evasion artifacts and preserve raw-original forms in case records.",
      })
    }

    if (flagInsecureHttpUrls) {
      const insecureUrls = normalization.entries.filter((entry) => entry.type === "url" && entry.canonical.startsWith("http://"))
      if (insecureUrls.length > 0) {
        findings.push({
          id: "ioc-normalizer-http-observables",
          severity: "medium",
          confidence: 75,
          category: "transport-risk",
          title: "Non-TLS URLs present",
          description: `${insecureUrls.length} canonical URL(s) use HTTP and may indicate downgrade or legacy delivery paths.`,
          remediation: "Prioritize these URLs for blocking and monitor for TLS upgrade opportunities.",
        })
      }
    }

    if (flagPunycodeDomains) {
      const punycodeEntries = normalization.entries.filter((entry) =>
        entry.type === "domain" && (entry.canonical.startsWith("xn--") || entry.originals.some((value) => hasUnicode(value))),
      )
      if (punycodeEntries.length > 0) {
        findings.push({
          id: "ioc-normalizer-punycode-homograph",
          severity: "medium",
          confidence: 77,
          category: "brand-abuse",
          title: "Punycode/unicode domain signals detected",
          description: `${punycodeEntries.length} domain IOC(s) include punycode or unicode variants.`,
          remediation: "Correlate with spoofing controls and domain registration intelligence before trust decisions.",
        })
      }
    }

    if (flagUnmatchedTokens) {
      const unmatched = Math.max(0, normalization.summary.inputTokens - normalization.summary.normalized)
      if (unmatched > 0) {
        findings.push({
          id: "ioc-normalizer-unmatched-tokens",
          severity: unmatched > normalization.summary.normalized ? "medium" : "low",
          confidence: 70,
          category: "parsing-coverage",
          title: "Input tokens not mapped to supported IOC types",
          description: `${unmatched} token(s) were not normalized into canonical IOC entries.`,
          remediation: "Inspect raw feed format and extend parsing patterns for missed IOC encodings.",
        })
      }
    }

    const summary = createSummaryFromFindings({
      title: "IOC normalization completed",
      text: `Processed ${normalization.summary.inputTokens} token(s), normalized ${normalization.summary.normalized}, deduplicated to ${normalization.summary.deduplicated}.`,
      findings,
      metrics: {
        inputTokens: normalization.summary.inputTokens,
        normalized: normalization.summary.normalized,
        deduplicated: normalization.summary.deduplicated,
        noteCount: normalization.notes.length,
      },
      baseScore: 94,
    })

    const evidenceRows = normalization.entries.map((entry) => ({
      type: entry.type,
      canonical: entry.canonical,
      defanged: entry.defanged,
      originalCount: entry.originals.length,
      originals: entry.originals,
    }))

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "Defanged IOC Normalizer + Canonicalizer",
        summary,
        findings,
        evidence: evidenceRows.slice(0, evidenceLimit),
        recommendations: [
          "Use canonical IOC values for deduped detection and enrichment workflows.",
          "Retain defanged output for safe sharing across incident response channels.",
          "Investigate high-variant and punycode IOC patterns for evasion/brand-abuse behavior.",
        ],
        raw: {
          normalization,
          config: {
            evidenceLimit,
            maxVariants,
            collapseThreshold,
            flagInsecureHttpUrls,
            flagPunycodeDomains,
            flagUnmatchedTokens,
          },
          evidenceTruncated: evidenceRows.length > evidenceLimit,
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null
    const envelope = parseToolResultEnvelope(output, "Defanged IOC Normalizer + Canonicalizer")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null
    const parsed = raw?.normalization as IocNormalizationResult | undefined
    if (!parsed) return null

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold uppercase text-muted-foreground">Input Tokens</div>
            <div className="text-xl font-semibold">{parsed.summary.inputTokens}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold uppercase text-muted-foreground">Normalized</div>
            <div className="text-xl font-semibold">{parsed.summary.normalized}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold uppercase text-muted-foreground">Deduplicated</div>
            <div className="text-xl font-semibold">{parsed.summary.deduplicated}</div>
          </div>
        </div>

        <div className="space-y-2">
          {parsed.entries.map((entry: CanonicalIoc) => (
            <div key={`${entry.type}:${entry.canonical}`} className="p-3 border rounded bg-muted/20 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs uppercase font-semibold ${typeBadgeColor(entry.type)}`}>{entry.type}</span>
                <span className="text-xs text-muted-foreground">Raw variants: {entry.originals.length}</span>
              </div>
              <div className="text-xs text-muted-foreground">Canonical</div>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">{entry.canonical}</pre>
              <div className="text-xs text-muted-foreground">Defanged</div>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">{entry.defanged}</pre>
              <div className="text-xs text-muted-foreground">Observed forms</div>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">{entry.originals.join("\n")}</pre>
            </div>
          ))}
        </div>

        {parsed.notes.length > 0 && (
          <div className="p-3 border rounded bg-muted/20">
            <h3 className="text-sm font-semibold mb-2">Notes</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              {parsed.notes.map((note, index) => (
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
      toolName="Defanged IOC Normalizer + Canonicalizer"
      description="Refang, canonicalize, and deduplicate IOC artifacts with enterprise quality and obfuscation findings."
      actionLabel="Normalize IOCs"
      placeholder="hxxps://login[.]example[.]com\nаррӏе.com\nxn--80ak6aa92e.com"
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Variant-count alert threshold</Label>
              <Input
                value={variantThreshold}
                onChange={(event) => setVariantThreshold(event.target.value)}
                placeholder="4"
              />
            </div>
            <div className="space-y-1">
              <Label>Collapse ratio alert threshold</Label>
              <Input
                value={collapseRatioThreshold}
                onChange={(event) => setCollapseRatioThreshold(event.target.value)}
                placeholder="3"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Max evidence rows</Label>
              <Input
                value={maxEvidenceRows}
                onChange={(event) => setMaxEvidenceRows(event.target.value)}
                placeholder="300"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="ioc-normalizer-http" className="text-sm">Flag non-TLS URLs</Label>
              <Switch
                id="ioc-normalizer-http"
                checked={flagInsecureHttpUrls}
                onChange={(event) => setFlagInsecureHttpUrls(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="ioc-normalizer-punycode" className="text-sm">Flag punycode/unicode domains</Label>
              <Switch
                id="ioc-normalizer-punycode"
                checked={flagPunycodeDomains}
                onChange={(event) => setFlagPunycodeDomains(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 sm:col-span-2">
              <Label htmlFor="ioc-normalizer-unmatched" className="text-sm">Flag unmatched tokens</Label>
              <Switch
                id="ioc-normalizer-unmatched"
                checked={flagUnmatchedTokens}
                onChange={(event) => setFlagUnmatchedTokens(event.target.checked)}
              />
            </div>
          </div>
        </div>
      }
      examples={[
        "hxxps://example[.]com/path\nhttp://EXAMPLE.com/path#frag\nexample(.)com",
        "support[@]paypaI[.]com\nраураl.com\nxn--80ak6aa92e.com",
      ]}
    />
  )
}
