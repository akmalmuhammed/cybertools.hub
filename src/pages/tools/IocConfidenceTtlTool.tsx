import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import {
  scoreIocConfidenceAndTtl,
  type IocConfidenceResult,
  type IocConfidenceItem,
} from "@/lib/utils/ioc-confidence"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

function parseSourceList(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\s,]+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  )
}

function ageDaysFromIso(isoValue: string | null, nowMs: number): number | null {
  if (!isoValue) return null
  const parsed = new Date(isoValue)
  if (Number.isNaN(parsed.getTime())) return null
  return Math.max(0, Math.floor((nowMs - parsed.getTime()) / (1000 * 60 * 60 * 24)))
}

function daysUntilIso(isoValue: string, nowMs: number): number | null {
  const parsed = new Date(isoValue)
  if (Number.isNaN(parsed.getTime())) return null
  return Math.floor((parsed.getTime() - nowMs) / (1000 * 60 * 60 * 24))
}

export default function IocConfidenceTtlTool() {
  const [minimumActionConfidence, setMinimumActionConfidence] = useState("70")
  const [maxTtlDays, setMaxTtlDays] = useState("90")
  const [staleIndicatorDays, setStaleIndicatorDays] = useState("30")
  const [nearExpiryWindowDays, setNearExpiryWindowDays] = useState("7")
  const [flagUnknownTypeIndicators, setFlagUnknownTypeIndicators] = useState(true)
  const [flagLowTrustHighConfidence, setFlagLowTrustHighConfidence] = useState(true)
  const [lowTrustSourcesInput, setLowTrustSourcesInput] = useState("osint,community")
  const [maxEvidenceRows, setMaxEvidenceRows] = useState("300")

  const process = (input: string) => {
    const scoring = scoreIocConfidenceAndTtl(input)
    const findings: ToolFinding[] = []

    const actionThreshold = Math.max(0, Math.min(100, Number(minimumActionConfidence) || 70))
    const ttlCap = Math.max(1, Number(maxTtlDays) || 90)
    const staleDays = Math.max(1, Number(staleIndicatorDays) || 30)
    const nearExpiryDays = Math.max(0, Number(nearExpiryWindowDays) || 7)
    const evidenceLimit = Math.max(20, Math.min(2000, Number(maxEvidenceRows) || 300))
    const lowTrustSources = parseSourceList(lowTrustSourcesInput)

    const nowMs = Date.now()

    if (scoring.summary.total === 0) {
      findings.push({
        id: "ioc-confidence-empty",
        severity: "info",
        confidence: 75,
        category: "input-quality",
        title: "No IOC confidence rows parsed",
        description: "Expected CSV rows in format: indicator,type,source,lastSeen,sightings.",
        remediation: "Provide properly formatted IOC records to generate confidence and TTL outputs.",
      })
    }

    const actionReady = scoring.items.filter((item) => item.confidence >= actionThreshold)
    if (actionReady.length === 0 && scoring.items.length > 0) {
      findings.push({
        id: "ioc-confidence-no-actionable-indicators",
        severity: "medium",
        confidence: 78,
        category: "triage-priority",
        title: "No indicators meet action confidence threshold",
        description: `No indicators reached confidence >= ${actionThreshold}.`,
        remediation: "Increase corroboration signals (sightings/source quality) before automated enforcement.",
      })
    } else if (actionReady.length > 0) {
      findings.push({
        id: "ioc-confidence-actionable-indicators",
        severity: "info",
        confidence: 70,
        category: "triage-priority",
        title: "Actionable confidence indicators present",
        description: `${actionReady.length} indicator(s) meet confidence threshold >= ${actionThreshold}.`,
        remediation: "Prioritize these indicators for blocking/detection after context validation.",
      })
    }

    const ttlOverCap = scoring.items.filter((item) => item.ttlDays > ttlCap)
    if (ttlOverCap.length > 0) {
      findings.push({
        id: "ioc-confidence-ttl-over-cap",
        severity: ttlOverCap.length > 5 ? "medium" : "low",
        confidence: 74,
        category: "ttl-governance",
        title: "Indicator TTL exceeds policy cap",
        description: `${ttlOverCap.length} indicator(s) exceed max TTL ${ttlCap} days.`,
        remediation: "Reduce TTL values to control stale blocklist persistence and false-positive risk.",
      })
    }

    const staleHighConfidence = scoring.items.filter((item) => {
      const age = ageDaysFromIso(item.lastSeen, nowMs)
      return age !== null && age > staleDays && item.confidence >= actionThreshold
    })
    if (staleHighConfidence.length > 0) {
      findings.push({
        id: "ioc-confidence-stale-high-confidence",
        severity: "medium",
        confidence: 79,
        category: "freshness-risk",
        title: "High-confidence indicators are stale",
        description: `${staleHighConfidence.length} high-confidence indicator(s) were last seen more than ${staleDays} days ago.`,
        remediation: "Revalidate stale indicators against recent telemetry before continuing enforcement.",
      })
    }

    const nearExpiryActionable = scoring.items.filter((item) => {
      const daysLeft = daysUntilIso(item.expiresAt, nowMs)
      return daysLeft !== null && daysLeft <= nearExpiryDays && item.confidence >= actionThreshold
    })
    if (nearExpiryActionable.length > 0) {
      findings.push({
        id: "ioc-confidence-near-expiry",
        severity: "low",
        confidence: 71,
        category: "ttl-governance",
        title: "Actionable indicators near expiry",
        description: `${nearExpiryActionable.length} actionable indicator(s) expire within ${nearExpiryDays} day(s).`,
        remediation: "Refresh high-value indicators from trusted feeds before TTL expiry.",
      })
    }

    if (flagUnknownTypeIndicators) {
      const unknownTypeCount = scoring.items.filter((item) => item.type === "unknown").length
      if (unknownTypeCount > 0) {
        findings.push({
          id: "ioc-confidence-unknown-type",
          severity: "low",
          confidence: 69,
          category: "data-quality",
          title: "Unknown IOC types detected",
          description: `${unknownTypeCount} indicator(s) were classified as unknown.`,
          remediation: "Provide explicit type labels or improve upstream IOC parsing quality.",
        })
      }
    }

    if (flagLowTrustHighConfidence && lowTrustSources.length > 0) {
      const lowTrustHighConfidence = scoring.items.filter(
        (item) => item.confidence >= actionThreshold && lowTrustSources.includes(item.source.toLowerCase()),
      )
      if (lowTrustHighConfidence.length > 0) {
        findings.push({
          id: "ioc-confidence-low-trust-high-confidence",
          severity: "medium",
          confidence: 76,
          category: "source-trust",
          title: "High-confidence scoring from low-trust sources",
          description: `${lowTrustHighConfidence.length} indicator(s) crossed confidence threshold from sources marked low trust.`,
          remediation: "Require corroborating telemetry before automated response for low-trust sourced IOCs.",
        })
      }
    }

    const summary = createSummaryFromFindings({
      title: "IOC confidence scoring completed",
      text: `Scored ${scoring.summary.total} indicator(s): ${scoring.summary.high} high, ${scoring.summary.medium} medium, ${scoring.summary.low} low confidence.`,
      findings,
      metrics: {
        total: scoring.summary.total,
        high: scoring.summary.high,
        medium: scoring.summary.medium,
        low: scoring.summary.low,
        actionable: actionReady.length,
      },
      baseScore: 93,
    })

    const evidenceRows = scoring.items.map((item) => ({
      indicator: item.indicator,
      type: item.type,
      source: item.source,
      confidence: item.confidence,
      ttlDays: item.ttlDays,
      expiresAt: item.expiresAt,
      lastSeen: item.lastSeen,
      sightings: item.sightings,
      rationale: item.rationale,
    }))

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "IOC Confidence + TTL Scorer",
        summary,
        findings,
        evidence: evidenceRows.slice(0, evidenceLimit),
        recommendations: [
          "Automate response only for high-confidence and recently observed indicators.",
          "Keep TTL caps bounded to prevent stale indicator persistence.",
          "Cross-validate low-trust feed hits with internal telemetry before blocking.",
        ],
        raw: {
          confidenceScoring: scoring,
          config: {
            actionThreshold,
            ttlCap,
            staleDays,
            nearExpiryDays,
            flagUnknownTypeIndicators,
            flagLowTrustHighConfidence,
            lowTrustSources,
            evidenceLimit,
          },
          evidenceTruncated: evidenceRows.length > evidenceLimit,
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null
    const envelope = parseToolResultEnvelope(output, "IOC Confidence + TTL Scorer")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null
    const parsed = raw?.confidenceScoring as IocConfidenceResult | undefined
    const config = raw?.config && typeof raw.config === "object" && raw.config !== null
      ? (raw.config as Record<string, unknown>)
      : null

    if (!parsed) return null

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-4 gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Total</div>
            <div className="text-xl font-semibold">{parsed.summary.total}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">High</div>
            <div className="text-xl font-semibold">{parsed.summary.high}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Medium</div>
            <div className="text-xl font-semibold">{parsed.summary.medium}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Low</div>
            <div className="text-xl font-semibold">{parsed.summary.low}</div>
          </div>
        </div>

        {config && (
          <div className="text-xs text-muted-foreground">
            Action threshold: {String(config.actionThreshold ?? "70")} | TTL cap: {String(config.ttlCap ?? "90")} days | Stale window: {String(config.staleDays ?? "30")} days
          </div>
        )}

        <div className="space-y-2">
          {parsed.items.map((item: IocConfidenceItem) => (
            <div key={`${item.indicator}:${item.source}`} className="p-3 border rounded bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold truncate">{item.indicator}</div>
                <div className="text-sm">{item.confidence}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Type: {item.type} | Source: {item.source} | TTL: {item.ttlDays}d | Expires: {item.expiresAt}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <ToolTemplate
      toolName="IOC Confidence + TTL Scorer"
      description="Score IOC confidence and TTL with enterprise freshness, source-trust, and action-threshold governance controls."
      actionLabel="Score IOCs"
      placeholder="malicious.example,domain,misp,2026-02-24T10:30:00Z,4"
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Minimum action confidence</Label>
              <Input
                value={minimumActionConfidence}
                onChange={(event) => setMinimumActionConfidence(event.target.value)}
                placeholder="70"
              />
            </div>
            <div className="space-y-1">
              <Label>Maximum TTL days</Label>
              <Input
                value={maxTtlDays}
                onChange={(event) => setMaxTtlDays(event.target.value)}
                placeholder="90"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Stale indicator window (days)</Label>
              <Input
                value={staleIndicatorDays}
                onChange={(event) => setStaleIndicatorDays(event.target.value)}
                placeholder="30"
              />
            </div>
            <div className="space-y-1">
              <Label>Near-expiry window (days)</Label>
              <Input
                value={nearExpiryWindowDays}
                onChange={(event) => setNearExpiryWindowDays(event.target.value)}
                placeholder="7"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Low-trust sources (comma separated)</Label>
              <Input
                value={lowTrustSourcesInput}
                onChange={(event) => setLowTrustSourcesInput(event.target.value)}
                placeholder="osint,community"
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
              <Label htmlFor="ioc-confidence-unknown" className="text-sm">Flag unknown IOC types</Label>
              <Switch
                id="ioc-confidence-unknown"
                checked={flagUnknownTypeIndicators}
                onChange={(event) => setFlagUnknownTypeIndicators(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="ioc-confidence-lowtrust" className="text-sm">Flag high confidence from low-trust sources</Label>
              <Switch
                id="ioc-confidence-lowtrust"
                checked={flagLowTrustHighConfidence}
                onChange={(event) => setFlagLowTrustHighConfidence(event.target.checked)}
              />
            </div>
          </div>
        </div>
      }
      examples={["malicious.example,domain,misp,2026-02-24T10:30:00Z,4\n8.8.8.8,ipv4,osint,2026-02-10T00:00:00Z,1"]}
    />
  )
}
