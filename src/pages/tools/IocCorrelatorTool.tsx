import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import {
  correlateIocSources,
  type IocCorrelationByType,
  type IocCorrelationResult,
} from "@/lib/utils/ioc-correlator"
import type { IocType } from "@/lib/utils/ioc"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

const VALID_TYPES = new Set<IocType>([
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
])

function parseCriticalTypes(input: string): IocType[] {
  return Array.from(
    new Set(
      input
        .split(/[\s,]+/)
        .map((item) => item.trim().toLowerCase())
        .filter((item): item is IocType => VALID_TYPES.has(item as IocType)),
    ),
  )
}

export default function IocCorrelatorTool() {
  const [sourceB, setSourceB] = useState("")
  const [includePrivateIps, setIncludePrivateIps] = useState(false)
  const [minOverlapPercent, setMinOverlapPercent] = useState("30")
  const [maxUniqueDriftPercent, setMaxUniqueDriftPercent] = useState("70")
  const [criticalTypesInput, setCriticalTypesInput] = useState("url,domain,ipv4,sha256,cve")
  const [requireSharedCriticalTypes, setRequireSharedCriticalTypes] = useState(true)
  const [failIfSourceEmpty, setFailIfSourceEmpty] = useState(true)
  const [maxEvidenceRows, setMaxEvidenceRows] = useState("300")

  const process = (sourceA: string) => {
    if (failIfSourceEmpty) {
      if (!sourceA.trim()) throw new Error("Source A is required under strict mode.")
      if (!sourceB.trim()) throw new Error("Source B is required under strict mode.")
    }

    const correlation = correlateIocSources(sourceA, sourceB, {
      includePrivateIps,
    })

    const findings: ToolFinding[] = []
    const overlapFloor = Math.max(0, Math.min(100, Number(minOverlapPercent) || 30))
    const uniqueDriftCap = Math.max(0, Math.min(100, Number(maxUniqueDriftPercent) || 70))
    const evidenceLimit = Math.max(20, Math.min(2000, Number(maxEvidenceRows) || 300))
    const criticalTypes = parseCriticalTypes(criticalTypesInput)

    if (correlation.summary.totalSourceA === 0 || correlation.summary.totalSourceB === 0) {
      findings.push({
        id: "ioc-correlation-empty-source",
        severity: "high",
        confidence: 85,
        category: "input-quality",
        title: "One or more correlation sources produced no indicators",
        description: `Source A total=${correlation.summary.totalSourceA}, Source B total=${correlation.summary.totalSourceB}.`,
        remediation: "Provide sufficiently rich IOC datasets from both sources before correlation.",
      })
    }

    if (correlation.summary.shared === 0) {
      findings.push({
        id: "ioc-correlation-no-overlap",
        severity: "high",
        confidence: 86,
        category: "correlation-signal",
        title: "No shared indicators between sources",
        description: "Cross-source overlap is zero.",
        remediation: "Recheck data normalization and broaden enrichment pivots before concluding unrelated incidents.",
      })
    }

    if (correlation.summary.overlapPercent < overlapFloor) {
      findings.push({
        id: "ioc-correlation-overlap-below-target",
        severity: correlation.summary.overlapPercent < Math.max(10, overlapFloor - 20) ? "high" : "medium",
        confidence: 78,
        category: "correlation-signal",
        title: "Overlap below baseline target",
        description: `Observed overlap is ${correlation.summary.overlapPercent}% and minimum target is ${overlapFloor}%.`,
        remediation: "Normalize IOC forms and enrich both datasets before prioritizing campaign-level correlation.",
      })
    }

    const sourceAUniqueRate = correlation.summary.totalSourceA === 0
      ? 0
      : (correlation.summary.uniqueSourceA / correlation.summary.totalSourceA) * 100
    const sourceBUniqueRate = correlation.summary.totalSourceB === 0
      ? 0
      : (correlation.summary.uniqueSourceB / correlation.summary.totalSourceB) * 100

    if (sourceAUniqueRate > uniqueDriftCap || sourceBUniqueRate > uniqueDriftCap) {
      findings.push({
        id: "ioc-correlation-unique-drift",
        severity: "medium",
        confidence: 74,
        category: "dataset-drift",
        title: "Source drift exceeds unique-indicator threshold",
        description: `Unique rates: A=${sourceAUniqueRate.toFixed(2)}%, B=${sourceBUniqueRate.toFixed(2)}%; cap=${uniqueDriftCap}%.`,
        remediation: "Segment sources by timeframe/campaign and re-run correlation for tighter comparability.",
      })
    }

    if (requireSharedCriticalTypes && criticalTypes.length > 0) {
      const missingCriticalOverlap = criticalTypes.filter((type) => {
        const bucket = correlation.byType.find((row) => row.type === type)
        if (!bucket) return false
        return bucket.shared.length === 0 && (bucket.onlySourceA.length > 0 || bucket.onlySourceB.length > 0)
      })

      if (missingCriticalOverlap.length > 0) {
        findings.push({
          id: "ioc-correlation-critical-type-gaps",
          severity: missingCriticalOverlap.some((type) => type === "sha256" || type === "sha512" || type === "cve") ? "high" : "medium",
          confidence: 80,
          category: "coverage-gap",
          title: "Critical IOC types lack shared overlap",
          description: `No overlap found for critical type(s): ${missingCriticalOverlap.join(", ")}.`,
          remediation: "Investigate ingestion inconsistencies and verify type-specific extraction coverage.",
        })
      }
    }

    const sharedHighSignalTypes = correlation.byType
      .filter((row) => (row.type === "sha256" || row.type === "sha512" || row.type === "cve") && row.shared.length > 0)
      .map((row) => `${row.type}:${row.shared.length}`)

    if (sharedHighSignalTypes.length > 0) {
      findings.push({
        id: "ioc-correlation-high-signal-overlap",
        severity: "info",
        confidence: 72,
        category: "correlation-signal",
        title: "High-signal indicator overlap present",
        description: `Shared high-signal types detected (${sharedHighSignalTypes.join(", ")}).`,
        remediation: "Prioritize these overlaps for campaign clustering and detection coverage updates.",
      })
    }

    const evidenceRows = correlation.byType
      .map((bucket) => ({
        type: bucket.type,
        sharedCount: bucket.shared.length,
        onlySourceACount: bucket.onlySourceA.length,
        onlySourceBCount: bucket.onlySourceB.length,
        shared: bucket.shared,
        onlySourceA: bucket.onlySourceA,
        onlySourceB: bucket.onlySourceB,
      }))

    const summary = createSummaryFromFindings({
      title: "IOC correlation completed",
      text: `Compared ${correlation.summary.totalSourceA} IOC(s) from A and ${correlation.summary.totalSourceB} IOC(s) from B with ${correlation.summary.shared} shared indicator(s).`,
      findings,
      metrics: {
        overlapPercent: correlation.summary.overlapPercent,
        shared: correlation.summary.shared,
        uniqueSourceA: correlation.summary.uniqueSourceA,
        uniqueSourceB: correlation.summary.uniqueSourceB,
        criticalTypesConfigured: criticalTypes.length,
      },
      baseScore: 93,
    })

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "IOC Correlator",
        summary,
        findings,
        evidence: evidenceRows.slice(0, evidenceLimit),
        recommendations: [
          "Standardize IOC normalization across sources before overlap decisions.",
          "Use overlap thresholds as triage gates, then validate with contextual telemetry.",
          "Focus correlation on high-signal IOC types (hashes/CVEs) for campaign confidence.",
        ],
        raw: {
          correlation,
          config: {
            includePrivateIps,
            overlapFloor,
            uniqueDriftCap,
            criticalTypes,
            requireSharedCriticalTypes,
            failIfSourceEmpty,
            evidenceLimit,
          },
          evidenceTruncated: evidenceRows.length > evidenceLimit,
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null
    const envelope = parseToolResultEnvelope(output, "IOC Correlator")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null
    const parsed = raw?.correlation as IocCorrelationResult | undefined
    const config = raw?.config && typeof raw.config === "object" && raw.config !== null
      ? (raw.config as Record<string, unknown>)
      : null

    if (!parsed) return null

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold text-muted-foreground uppercase">Shared</div>
            <div className="text-xl font-semibold">{parsed.summary.shared}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold text-muted-foreground uppercase">Only Source A</div>
            <div className="text-xl font-semibold">{parsed.summary.uniqueSourceA}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold text-muted-foreground uppercase">Only Source B</div>
            <div className="text-xl font-semibold">{parsed.summary.uniqueSourceB}</div>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          Overlap: {parsed.summary.overlapPercent}% (A={parsed.summary.totalSourceA}, B={parsed.summary.totalSourceB})
          {config && <> | Target: {String(config.overlapFloor ?? "30")}%</>}
        </div>

        <div className="space-y-2">
          {parsed.byType
            .filter(
              (bucket: IocCorrelationByType) =>
                bucket.shared.length > 0 ||
                bucket.onlySourceA.length > 0 ||
                bucket.onlySourceB.length > 0,
            )
            .map((bucket: IocCorrelationByType) => (
              <div key={bucket.type} className="p-3 border rounded bg-muted/20 space-y-2">
                <h3 className="text-sm font-semibold uppercase">{bucket.type}</h3>
                {bucket.shared.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-green-600 dark:text-green-400">Shared</div>
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">{bucket.shared.join("\n")}</pre>
                  </div>
                )}
                {bucket.onlySourceA.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">Only A</div>
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">{bucket.onlySourceA.join("\n")}</pre>
                  </div>
                )}
                {bucket.onlySourceB.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">Only B</div>
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">{bucket.onlySourceB.join("\n")}</pre>
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    )
  }

  return (
    <ToolTemplate
      toolName="IOC Correlator"
      description="Compare IOC datasets with overlap thresholds, critical-type coverage checks, and enterprise triage findings."
      actionLabel="Correlate"
      placeholder="Paste source A indicators, logs, or notes..."
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Source B</Label>
            <Textarea
              value={sourceB}
              onChange={(event) => setSourceB(event.target.value)}
              placeholder="Paste source B indicators..."
              className="min-h-[140px] font-mono text-sm"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Minimum overlap (%)</Label>
              <Input
                value={minOverlapPercent}
                onChange={(event) => setMinOverlapPercent(event.target.value)}
                placeholder="30"
              />
            </div>
            <div className="space-y-1">
              <Label>Max unique drift (%)</Label>
              <Input
                value={maxUniqueDriftPercent}
                onChange={(event) => setMaxUniqueDriftPercent(event.target.value)}
                placeholder="70"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Critical IOC types (comma separated)</Label>
              <Input
                value={criticalTypesInput}
                onChange={(event) => setCriticalTypesInput(event.target.value)}
                placeholder="url,domain,ipv4,sha256,cve"
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

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="ioc-correlator-private" className="text-sm">Include private/reserved IPs</Label>
              <Switch
                id="ioc-correlator-private"
                checked={includePrivateIps}
                onChange={(event) => setIncludePrivateIps(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="ioc-correlator-critical-types" className="text-sm">Require critical type overlap</Label>
              <Switch
                id="ioc-correlator-critical-types"
                checked={requireSharedCriticalTypes}
                onChange={(event) => setRequireSharedCriticalTypes(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 sm:col-span-2">
              <Label htmlFor="ioc-correlator-strict-input" className="text-sm">Fail if either source is empty</Label>
              <Switch
                id="ioc-correlator-strict-input"
                checked={failIfSourceEmpty}
                onChange={(event) => setFailIfSourceEmpty(event.target.checked)}
              />
            </div>
          </div>
        </div>
      }
      examples={[
        "https://a.example.com\n8.8.8.8\nCVE-2024-1111",
        "https://a.example.com\n1.1.1.1\nCVE-2024-1111",
      ]}
    />
  )
}
