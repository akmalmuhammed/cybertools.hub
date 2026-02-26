import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import {
  simulateAlertDeduplication,
  type AlertDedupeResult,
  type AlertDedupeGroup,
} from "@/lib/utils/alert-dedupe"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

export default function AlertDeduplicationTool() {
  const [windowMinutes, setWindowMinutes] = useState("20")
  const [minimumReductionRate, setMinimumReductionRate] = useState("30")
  const [stormGroupCountThreshold, setStormGroupCountThreshold] = useState("10")
  const [highSeverityEscalationThreshold, setHighSeverityEscalationThreshold] = useState("5")
  const [maxEvidenceRows, setMaxEvidenceRows] = useState("300")
  const [flagMissingTimestamps, setFlagMissingTimestamps] = useState(true)
  const [enforceHighReductionGate, setEnforceHighReductionGate] = useState(false)

  const process = (input: string) => {
    const dedupeWindow = Math.max(1, Number(windowMinutes) || 20)
    const reductionTarget = Math.max(0, Math.min(100, Number(minimumReductionRate) || 30))
    const stormThreshold = Math.max(2, Number(stormGroupCountThreshold) || 10)
    const highSeverityThreshold = Math.max(1, Number(highSeverityEscalationThreshold) || 5)
    const evidenceLimit = Math.max(20, Math.min(2000, Number(maxEvidenceRows) || 300))

    const dedupe = simulateAlertDeduplication(input, {
      windowMinutes: dedupeWindow,
    })

    const findings: ToolFinding[] = []

    if (dedupe.totalAlerts === 0) {
      findings.push({
        id: "alert-dedupe-no-alerts",
        severity: "info",
        confidence: 74,
        category: "input-quality",
        title: "No alert records parsed",
        description: "Input did not contain parseable alert records.",
        remediation: "Provide JSON array, NDJSON, or CSV alert rows with expected fields.",
      })
    }

    if (dedupe.totalAlerts > 0) {
      if (dedupe.reductionRate < reductionTarget) {
        findings.push({
          id: "alert-dedupe-below-target",
          severity: dedupe.reductionRate < Math.max(5, reductionTarget - 15) ? "high" : "medium",
          confidence: 80,
          category: "soc-efficiency",
          title: "Deduplication rate below target",
          description: `Observed reduction ${dedupe.reductionRate}% is below target ${reductionTarget}%.`,
          remediation: "Review fingerprint strategy and add context keys to collapse repetitive noise.",
        })
      } else {
        findings.push({
          id: "alert-dedupe-target-met",
          severity: "info",
          confidence: 70,
          category: "soc-efficiency",
          title: "Deduplication target achieved",
          description: `Reduction ${dedupe.reductionRate}% meets/exceeds target ${reductionTarget}%.`,
          remediation: "Monitor trend stability and tune thresholds for rule families with recurring alert storms.",
        })
      }
    }

    if (enforceHighReductionGate && dedupe.reductionRate < 50 && dedupe.totalAlerts >= 20) {
      findings.push({
        id: "alert-dedupe-high-gate-failed",
        severity: "high",
        confidence: 83,
        category: "release-gate",
        title: "High-efficiency deduplication gate failed",
        description: "Policy requires >=50% reduction for high-volume datasets and this run did not meet it.",
        remediation: "Adjust dedupe window/fingerprint features before promoting rules into production triage flows.",
      })
    }

    const stormGroups = dedupe.groups.filter((group) => group.count >= stormThreshold)
    if (stormGroups.length > 0) {
      findings.push({
        id: "alert-dedupe-storm-groups",
        severity: stormGroups.length > 3 ? "high" : "medium",
        confidence: 78,
        category: "alert-storm",
        title: "High-volume alert storm groups detected",
        description: `${stormGroups.length} dedupe group(s) exceed count threshold ${stormThreshold}.`,
        remediation: "Tune noisy rules and add suppressions/aggregation for repeat entity-rule combinations.",
      })
    }

    const escalatedHighSeverityGroups = dedupe.groups.filter(
      (group) => (group.severity === "critical" || group.severity === "high") && group.count >= highSeverityThreshold,
    )
    if (escalatedHighSeverityGroups.length > 0) {
      findings.push({
        id: "alert-dedupe-high-severity-repeat",
        severity: "high",
        confidence: 84,
        category: "incident-priority",
        title: "Repeated high-severity alert clusters",
        description: `${escalatedHighSeverityGroups.length} high/critical group(s) exceed repetition threshold ${highSeverityThreshold}.`,
        remediation: "Escalate these entities/rules for incident triage and containment readiness.",
      })
    }

    if (flagMissingTimestamps) {
      const missingTimestampGroups = dedupe.groups.filter((group) => !group.firstSeen || !group.lastSeen)
      if (missingTimestampGroups.length > 0) {
        findings.push({
          id: "alert-dedupe-missing-timestamps",
          severity: "low",
          confidence: 69,
          category: "data-quality",
          title: "Groups with incomplete time metadata",
          description: `${missingTimestampGroups.length} group(s) lacked firstSeen/lastSeen timestamp completeness.`,
          remediation: "Ensure upstream alert sources populate stable timestamps for timeline fidelity.",
        })
      }
    }

    if (dedupe.totalAlerts > 0 && dedupe.uniqueAlerts === dedupe.totalAlerts) {
      findings.push({
        id: "alert-dedupe-no-collapse",
        severity: "low",
        confidence: 72,
        category: "dedupe-effectiveness",
        title: "No dedupe collapse achieved",
        description: "Each alert remained unique under current window/fingerprint settings.",
        remediation: "Increase dedupe window or include additional stable dimensions for clustering.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "Alert deduplication simulation completed",
      text: `Processed ${dedupe.totalAlerts} alert(s), reduced to ${dedupe.uniqueAlerts} unique group(s) (${dedupe.reductionRate}% reduction).`,
      findings,
      metrics: {
        totalAlerts: dedupe.totalAlerts,
        uniqueAlerts: dedupe.uniqueAlerts,
        reducedCount: dedupe.reducedCount,
        reductionRate: dedupe.reductionRate,
        stormGroups: stormGroups.length,
      },
      baseScore: 94,
    })

    const evidenceRows = dedupe.groups.map((group) => ({
      fingerprint: group.fingerprint,
      count: group.count,
      severity: group.severity,
      sampleTitle: group.sampleTitle,
      sampleEntity: group.sampleEntity,
      firstSeen: group.firstSeen,
      lastSeen: group.lastSeen,
    }))

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "Alert Deduplication Simulator",
        summary,
        findings,
        evidence: evidenceRows.slice(0, evidenceLimit),
        recommendations: [
          "Treat dedupe reduction and storm-group counts as operational SOC efficiency SLOs.",
          "Escalate repeated high-severity clusters even when noise reduction is strong.",
          "Continuously tune dedupe window and fingerprint strategy against real alert behavior.",
        ],
        raw: {
          alertDedupe: dedupe,
          config: {
            dedupeWindow,
            reductionTarget,
            stormThreshold,
            highSeverityThreshold,
            evidenceLimit,
            flagMissingTimestamps,
            enforceHighReductionGate,
          },
          evidenceTruncated: evidenceRows.length > evidenceLimit,
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null
    const envelope = parseToolResultEnvelope(output, "Alert Deduplication Simulator")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null
    const parsed = raw?.alertDedupe as AlertDedupeResult | undefined
    const config = raw?.config && typeof raw.config === "object" && raw.config !== null
      ? (raw.config as Record<string, unknown>)
      : null

    if (!parsed) return null

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-4 gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Total</div>
            <div className="text-xl font-semibold">{parsed.totalAlerts}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Unique</div>
            <div className="text-xl font-semibold">{parsed.uniqueAlerts}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Reduced</div>
            <div className="text-xl font-semibold">{parsed.reducedCount}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Reduction</div>
            <div className="text-xl font-semibold">{parsed.reductionRate}%</div>
          </div>
        </div>

        {config && (
          <div className="text-xs text-muted-foreground">
            Dedupe window: {String(config.dedupeWindow ?? "20")}m | Target reduction: {String(config.reductionTarget ?? "30")}% | Storm threshold: {String(config.stormThreshold ?? "10")}
          </div>
        )}

        <div className="space-y-2">
          {parsed.groups.slice(0, 20).map((group: AlertDedupeGroup) => (
            <div key={group.fingerprint} className="p-3 border rounded bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold truncate">{group.sampleTitle}</div>
                <div className="text-xs px-2 py-1 rounded border">{group.count}x</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Entity: {group.sampleEntity} | Severity: {group.severity}
              </div>
              <div className="text-xs text-muted-foreground">
                {group.firstSeen ?? "-"} to {group.lastSeen ?? "-"}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <ToolTemplate
      toolName="Alert Deduplication Simulator"
      description="Cluster repetitive alerts with enterprise thresholds for SOC efficiency, storm detection, and escalation governance."
      actionLabel="Simulate Deduplication"
      placeholder='{"timestamp":"2026-02-25T01:00:00Z","ruleId":"win-powershell","entity":"host-01","title":"Suspicious PowerShell","severity":"high"}'
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Dedupe window (minutes)</Label>
              <Input
                value={windowMinutes}
                onChange={(event) => setWindowMinutes(event.target.value)}
                placeholder="20"
              />
            </div>
            <div className="space-y-1">
              <Label>Minimum reduction target (%)</Label>
              <Input
                value={minimumReductionRate}
                onChange={(event) => setMinimumReductionRate(event.target.value)}
                placeholder="30"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Alert-storm group count threshold</Label>
              <Input
                value={stormGroupCountThreshold}
                onChange={(event) => setStormGroupCountThreshold(event.target.value)}
                placeholder="10"
              />
            </div>
            <div className="space-y-1">
              <Label>High-severity escalation threshold</Label>
              <Input
                value={highSeverityEscalationThreshold}
                onChange={(event) => setHighSeverityEscalationThreshold(event.target.value)}
                placeholder="5"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Max evidence rows</Label>
            <Input
              value={maxEvidenceRows}
              onChange={(event) => setMaxEvidenceRows(event.target.value)}
              placeholder="300"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="alert-dedupe-missing-ts" className="text-sm">Flag missing timestamps</Label>
              <Switch
                id="alert-dedupe-missing-ts"
                checked={flagMissingTimestamps}
                onChange={(event) => setFlagMissingTimestamps(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="alert-dedupe-high-gate" className="text-sm">Enforce &gt;=50% reduction on large sets</Label>
              <Switch
                id="alert-dedupe-high-gate"
                checked={enforceHighReductionGate}
                onChange={(event) => setEnforceHighReductionGate(event.target.checked)}
              />
            </div>
          </div>
        </div>
      }
      examples={[
        '{"timestamp":"2026-02-25T01:00:00Z","ruleId":"win-powershell","entity":"host-01","title":"Suspicious PowerShell","severity":"high"}\n{"timestamp":"2026-02-25T01:04:00Z","ruleId":"win-powershell","entity":"host-01","title":"Suspicious PowerShell","severity":"high"}',
      ]}
    />
  )
}
