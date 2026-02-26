import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import {
  composeIncidentTimeline,
  type TimelineCompositionResult,
  type TimelineEvent,
} from "@/lib/utils/event-timeline"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

function computeCustomGaps(events: TimelineEvent[], thresholdMinutes: number): Array<{ from: string; to: string; gapMinutes: number }> {
  const gaps: Array<{ from: string; to: string; gapMinutes: number }> = []

  for (let index = 1; index < events.length; index += 1) {
    const previous = events[index - 1]
    const current = events[index]
    const diffMs = new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime()
    const diffMinutes = diffMs / (1000 * 60)
    if (diffMinutes >= thresholdMinutes) {
      gaps.push({
        from: previous.timestamp,
        to: current.timestamp,
        gapMinutes: Math.round(diffMinutes * 100) / 100,
      })
    }
  }

  return gaps
}

export default function EventTimelineTool() {
  const [gapThresholdMinutes, setGapThresholdMinutes] = useState("30")
  const [maxDurationMinutes, setMaxDurationMinutes] = useState("240")
  const [maxCriticalEvents, setMaxCriticalEvents] = useState("1")
  const [requireMultiSourceCoverage, setRequireMultiSourceCoverage] = useState(true)
  const [minimumSources, setMinimumSources] = useState("2")
  const [maxEvidenceRows, setMaxEvidenceRows] = useState("300")

  const process = (input: string) => {
    const timeline = composeIncidentTimeline(input)
    const findings: ToolFinding[] = []

    const gapThreshold = Math.max(1, Number(gapThresholdMinutes) || 30)
    const durationLimit = Math.max(1, Number(maxDurationMinutes) || 240)
    const criticalLimit = Math.max(0, Number(maxCriticalEvents) || 1)
    const sourceFloor = Math.max(1, Number(minimumSources) || 2)
    const evidenceLimit = Math.max(20, Math.min(2000, Number(maxEvidenceRows) || 300))

    const customGaps = computeCustomGaps(timeline.events, gapThreshold)
    const uniqueSources = new Set(timeline.events.map((event) => event.source)).size
    const infoOnlyRatio = timeline.summary.total > 0 ? timeline.summary.info / timeline.summary.total : 0

    if (timeline.summary.total === 0) {
      findings.push({
        id: "timeline-no-events",
        severity: "info",
        confidence: 75,
        category: "input-quality",
        title: "No timeline events parsed",
        description: "Input format did not produce timeline events.",
        remediation: "Provide JSON array, NDJSON, or CSV events with valid timestamps.",
      })
    }

    if (timeline.summary.critical > criticalLimit) {
      findings.push({
        id: "timeline-critical-over-limit",
        severity: timeline.summary.critical > criticalLimit + 2 ? "critical" : "high",
        confidence: 86,
        category: "incident-severity",
        title: "Critical event count exceeds threshold",
        description: `Critical events=${timeline.summary.critical}, policy limit=${criticalLimit}.`,
        remediation: "Escalate response priority and activate critical incident workflow.",
      })
    }

    if (customGaps.length > 0) {
      const longestGap = Math.max(...customGaps.map((gap) => gap.gapMinutes))
      findings.push({
        id: "timeline-detection-gaps",
        severity: longestGap >= gapThreshold * 2 ? "high" : "medium",
        confidence: 79,
        category: "visibility-gap",
        title: "Timeline visibility gaps detected",
        description: `${customGaps.length} gap(s) exceed ${gapThreshold} minutes (longest=${longestGap.toFixed(2)}m).`,
        remediation: "Investigate telemetry blind spots and improve event collection coverage during gap windows.",
      })
    }

    if (timeline.summary.durationMinutes > durationLimit) {
      findings.push({
        id: "timeline-duration-over-limit",
        severity: timeline.summary.durationMinutes > durationLimit * 2 ? "high" : "medium",
        confidence: 77,
        category: "dwell-time",
        title: "Incident duration exceeds threshold",
        description: `Timeline duration ${timeline.summary.durationMinutes} minutes exceeds limit ${durationLimit}.`,
        remediation: "Review containment speed and add earlier detection/response checkpoints.",
      })
    }

    if (requireMultiSourceCoverage && timeline.summary.total > 0 && uniqueSources < sourceFloor) {
      findings.push({
        id: "timeline-source-coverage-low",
        severity: "medium",
        confidence: 74,
        category: "evidence-diversity",
        title: "Timeline has limited source diversity",
        description: `Unique sources=${uniqueSources}, minimum required=${sourceFloor}.`,
        remediation: "Correlate with additional telemetry sources (EDR/SIEM/network/identity) for stronger confidence.",
      })
    }

    if (infoOnlyRatio >= 0.8 && timeline.summary.total >= 5) {
      findings.push({
        id: "timeline-info-dominant",
        severity: "low",
        confidence: 68,
        category: "signal-quality",
        title: "Timeline severity profile is mostly informational",
        description: `${Math.round(infoOnlyRatio * 100)}% of events are informational severity.`,
        remediation: "Validate severity mapping rules so high-impact events are not under-classified.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "Event timeline composition completed",
      text: `Composed ${timeline.summary.total} event(s) across ${uniqueSources} source(s) over ${timeline.summary.durationMinutes} minutes.`,
      findings,
      metrics: {
        totalEvents: timeline.summary.total,
        critical: timeline.summary.critical,
        high: timeline.summary.high,
        medium: timeline.summary.medium,
        low: timeline.summary.low,
        info: timeline.summary.info,
        uniqueSources,
        customGaps: customGaps.length,
      },
      baseScore: 93,
    })

    const evidenceRows = timeline.events.map((event) => ({
      timestamp: event.timestamp,
      source: event.source,
      summary: event.summary,
      severity: event.severity,
      offsetMinutes: event.offsetMinutes,
    }))

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "Event Timeline Composer",
        summary,
        findings,
        evidence: evidenceRows.slice(0, evidenceLimit),
        recommendations: [
          "Track timeline gaps as explicit visibility risks and map them to telemetry owners.",
          "Correlate incident timelines across multiple sources to improve reconstruction confidence.",
          "Set duration/critical thresholds as escalation triggers in incident runbooks.",
        ],
        raw: {
          timeline,
          config: {
            gapThreshold,
            durationLimit,
            criticalLimit,
            requireMultiSourceCoverage,
            sourceFloor,
            evidenceLimit,
          },
          customGaps,
          evidenceTruncated: evidenceRows.length > evidenceLimit,
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null
    const envelope = parseToolResultEnvelope(output, "Event Timeline Composer")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null
    const parsed = raw?.timeline as TimelineCompositionResult | undefined
    const config = raw?.config && typeof raw.config === "object" && raw.config !== null
      ? (raw.config as Record<string, unknown>)
      : null
    const customGaps = Array.isArray(raw?.customGaps) ? raw.customGaps : []

    if (!parsed) return null

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Events</div>
            <div className="text-xl font-semibold">{parsed.summary.total}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Duration</div>
            <div className="text-xl font-semibold">{parsed.summary.durationMinutes}m</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Gaps</div>
            <div className="text-xl font-semibold">{customGaps.length}</div>
          </div>
        </div>

        {config && (
          <div className="text-xs text-muted-foreground">
            Gap threshold: {String(config.gapThreshold ?? "30")}m | Duration limit: {String(config.durationLimit ?? "240")}m | Critical limit: {String(config.criticalLimit ?? "1")}
          </div>
        )}

        <div className="space-y-2">
          {parsed.events.map((event: TimelineEvent) => (
            <div key={`${event.timestamp}:${event.summary}`} className="p-3 border rounded bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{event.summary}</div>
                <div className="text-xs">{event.severity}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {event.timestamp} | {event.source} | +{event.offsetMinutes}m
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <ToolTemplate
      toolName="Event Timeline Composer"
      description="Normalize incident events into timeline evidence with gap, dwell-time, and source-coverage governance findings."
      actionLabel="Compose Timeline"
      placeholder='{"timestamp":"2026-02-25T12:00:00Z","source":"EDR","summary":"Initial detection","severity":"high"}'
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Gap threshold (minutes)</Label>
              <Input
                value={gapThresholdMinutes}
                onChange={(event) => setGapThresholdMinutes(event.target.value)}
                placeholder="30"
              />
            </div>
            <div className="space-y-1">
              <Label>Max timeline duration (minutes)</Label>
              <Input
                value={maxDurationMinutes}
                onChange={(event) => setMaxDurationMinutes(event.target.value)}
                placeholder="240"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Max critical events before escalation</Label>
              <Input
                value={maxCriticalEvents}
                onChange={(event) => setMaxCriticalEvents(event.target.value)}
                placeholder="1"
              />
            </div>
            <div className="space-y-1">
              <Label>Minimum telemetry sources</Label>
              <Input
                value={minimumSources}
                onChange={(event) => setMinimumSources(event.target.value)}
                placeholder="2"
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

          <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
            <Label htmlFor="timeline-require-multisource" className="text-sm">Require multi-source coverage</Label>
            <Switch
              id="timeline-require-multisource"
              checked={requireMultiSourceCoverage}
              onChange={(event) => setRequireMultiSourceCoverage(event.target.checked)}
            />
          </div>
        </div>
      }
      examples={[
        '{"timestamp":"2026-02-25T12:00:00Z","source":"EDR","summary":"Initial detection","severity":"high"}\n{"timestamp":"2026-02-25T12:43:00Z","source":"SIEM","summary":"Credential abuse follow-on","severity":"critical"}',
      ]}
    />
  )
}
