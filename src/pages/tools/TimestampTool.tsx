import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { unixToDate, dateToUnix, getCurrentUnix } from "@/lib/utils/time"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { buildToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

interface TimestampPolicyConfig {
  maxPastDays: number
  maxFutureDays: number
  maxAbsoluteUnix: number
  maxAllowedDriftHours: number
  rejectPreEpoch: boolean
  requireTimezoneForDateInputs: boolean
  rejectMillisecondsInput: boolean
}

function toIsoFromUnix(unixSeconds: number): string {
  try {
    const date = new Date(unixSeconds * 1000)
    if (Number.isNaN(date.getTime())) return "Invalid Date"
    return date.toISOString()
  } catch {
    return "Invalid Date"
  }
}

function evaluateTimestampPolicy(params: {
  unixSeconds: number
  originalInput: string
  sourceMode: "auto-unix2date" | "auto-date2unix" | "unix2date" | "date2unix"
  policy: TimestampPolicyConfig
  wasMillisecondCandidate: boolean
}): ToolFinding[] {
  const findings: ToolFinding[] = []
  const now = getCurrentUnix()
  const deltaSeconds = params.unixSeconds - now
  const deltaDays = Math.abs(deltaSeconds) / 86_400

  if (params.unixSeconds < 0) {
    findings.push({
      id: "timestamp-pre-epoch",
      severity: params.policy.rejectPreEpoch ? "high" : "low",
      confidence: 78,
      category: "timeline-analysis",
      title: "Pre-epoch timestamp detected",
      description: "Timestamp is before 1970-01-01 UTC. Confirm this is expected historical data.",
      remediation: "Verify source system semantics and signed epoch handling before ingestion.",
    })
  }

  if (params.policy.rejectPreEpoch && params.unixSeconds < 0) {
    findings.push({
      id: "timestamp-pre-epoch-policy-block",
      severity: "high",
      confidence: 90,
      category: "policy-gate",
      title: "Pre-epoch values violate policy",
      description: "Negative Unix timestamps are blocked by configured policy.",
      remediation: "Only process post-epoch timestamps or disable strict pre-epoch rejection.",
    })
  }

  if (params.unixSeconds > params.policy.maxAbsoluteUnix) {
    findings.push({
      id: "timestamp-absolute-range-exceeded",
      severity: "high",
      confidence: 88,
      category: "timeline-analysis",
      title: "Timestamp exceeds absolute maximum",
      description: `Unix value ${params.unixSeconds} exceeds allowed maximum ${params.policy.maxAbsoluteUnix}.`,
      remediation: "Validate upstream unit conversions and timestamp source quality.",
    })
  }

  if (deltaSeconds < -params.policy.maxPastDays * 86_400) {
    findings.push({
      id: "timestamp-too-far-in-past",
      severity: "medium",
      confidence: 82,
      category: "timeline-analysis",
      title: "Timestamp is older than policy window",
      description: `Timestamp is ${deltaDays.toFixed(1)} days from now, exceeding past window ${params.policy.maxPastDays} days.`,
      remediation: "Review retention and source replay assumptions for historical events.",
    })
  }

  if (deltaSeconds > params.policy.maxFutureDays * 86_400) {
    findings.push({
      id: "timestamp-too-far-in-future",
      severity: "high",
      confidence: 84,
      category: "clock-drift",
      title: "Timestamp is beyond future policy window",
      description: `Timestamp is ${deltaDays.toFixed(1)} days from now, exceeding future window ${params.policy.maxFutureDays} days.`,
      remediation: "Validate source clock synchronization and timezone conversion logic.",
    })
  }

  if (Math.abs(deltaSeconds) > params.policy.maxAllowedDriftHours * 3600) {
    findings.push({
      id: "timestamp-drift-threshold",
      severity: "medium",
      confidence: 79,
      category: "clock-drift",
      title: "Timestamp drift exceeds threshold",
      description: `Observed drift ${Math.round(Math.abs(deltaSeconds) / 3600)} hour(s) exceeds ${params.policy.maxAllowedDriftHours} hour policy.`,
      remediation: "Enforce NTP synchronization and timezone normalization at ingestion boundaries.",
    })
  }

  if (
    params.policy.requireTimezoneForDateInputs
    && (params.sourceMode === "auto-date2unix" || params.sourceMode === "date2unix")
    && !/[zZ]|[+-]\d{2}:\d{2}/.test(params.originalInput)
  ) {
    findings.push({
      id: "timestamp-timezone-required",
      severity: "high",
      confidence: 87,
      category: "timezone-governance",
      title: "Timezone-explicit date required by policy",
      description: "Date input did not include explicit timezone information.",
      remediation: "Use ISO-8601 timestamps with timezone (e.g., 2026-02-26T14:30:00Z).",
    })
  }

  if (params.wasMillisecondCandidate) {
    findings.push({
      id: "timestamp-millisecond-detected",
      severity: params.policy.rejectMillisecondsInput ? "high" : "low",
      confidence: 75,
      category: "unit-normalization",
      title: "Millisecond epoch input detected",
      description: "Input appears to be epoch milliseconds and was normalized to seconds.",
      remediation: "Standardize on epoch seconds in APIs and ingestion contracts.",
    })
  }

  if (params.policy.rejectMillisecondsInput && params.wasMillisecondCandidate) {
    findings.push({
      id: "timestamp-millisecond-policy-block",
      severity: "high",
      confidence: 89,
      category: "policy-gate",
      title: "Millisecond epoch values violate policy",
      description: "Strict mode blocks millisecond epoch values to prevent mixed-unit ingestion.",
      remediation: "Convert to seconds before processing when strict mode is enabled.",
    })
  }

  return findings
}

export default function TimestampTool() {
  const [mode, setMode] = useState<"auto" | "unix2date" | "date2unix">("auto")
  const [maxPastDaysInput, setMaxPastDaysInput] = useState("3650")
  const [maxFutureDaysInput, setMaxFutureDaysInput] = useState("365")
  const [maxAbsoluteUnixInput, setMaxAbsoluteUnixInput] = useState("4102444800")
  const [maxDriftHoursInput, setMaxDriftHoursInput] = useState("24")
  const [rejectPreEpoch, setRejectPreEpoch] = useState(false)
  const [requireTimezoneForDateInputs, setRequireTimezoneForDateInputs] = useState(true)
  const [rejectMillisecondsInput, setRejectMillisecondsInput] = useState(false)

  const handleModeChange = (value: string) => {
    if (value === "auto" || value === "unix2date" || value === "date2unix") {
      setMode(value)
    }
  }

  const process = (input: string) => {
    const trimmed = input.trim()
    const nowUnix = getCurrentUnix()
    const policy: TimestampPolicyConfig = {
      maxPastDays: Math.max(0, Number(maxPastDaysInput) || 3650),
      maxFutureDays: Math.max(0, Number(maxFutureDaysInput) || 365),
      maxAbsoluteUnix: Math.max(0, Number(maxAbsoluteUnixInput) || 4102444800),
      maxAllowedDriftHours: Math.max(1, Number(maxDriftHoursInput) || 24),
      rejectPreEpoch,
      requireTimezoneForDateInputs,
      rejectMillisecondsInput,
    }

    let sourceMode: "auto-unix2date" | "auto-date2unix" | "unix2date" | "date2unix"
    let normalizedUnix: number
    let output: string
    let wasMillisecondCandidate = false

    if (mode === "auto") {
      if (/^-?\d{1,16}$/.test(trimmed)) {
        const ts = Number.parseInt(trimmed, 10)
        wasMillisecondCandidate = Math.abs(ts) >= 1_000_000_000_000
        normalizedUnix = wasMillisecondCandidate ? Math.floor(ts / 1000) : ts
        output = unixToDate(ts)
        if (output === "Invalid Timestamp") throw new Error("Invalid timestamp")
        sourceMode = "auto-unix2date"
      } else {
        const ts = dateToUnix(trimmed)
        if (Number.isNaN(ts)) throw new Error("Invalid date format")
        normalizedUnix = ts
        output = ts.toString()
        sourceMode = "auto-date2unix"
      }
    } else if (mode === "unix2date") {
      const ts = Number.parseInt(trimmed, 10)
      if (Number.isNaN(ts)) throw new Error("Invalid timestamp")
      wasMillisecondCandidate = Math.abs(ts) >= 1_000_000_000_000
      normalizedUnix = wasMillisecondCandidate ? Math.floor(ts / 1000) : ts
      output = unixToDate(ts)
      if (output === "Invalid Timestamp") throw new Error("Invalid timestamp")
      sourceMode = "unix2date"
    } else {
      const ts = dateToUnix(trimmed)
      if (Number.isNaN(ts)) throw new Error("Invalid date format")
      normalizedUnix = ts
      output = ts.toString()
      sourceMode = "date2unix"
    }

    const findings = evaluateTimestampPolicy({
      unixSeconds: normalizedUnix,
      originalInput: trimmed,
      sourceMode,
      policy,
      wasMillisecondCandidate,
    })

    if (findings.length === 0) {
      findings.push({
        id: "timestamp-policy-pass",
        severity: "info",
        confidence: 72,
        category: "timeline-analysis",
        title: "Timestamp conversion passed policy checks",
        description: "No drift, range, or timezone policy issues detected for this conversion.",
        remediation: "Retain UTC normalization and unit consistency checks in ingestion workflows.",
      })
    }

    const summaryTitle = sourceMode.endsWith("unix2date")
      ? "Timestamp converted to date"
      : "Date converted to Unix timestamp"

    const summaryText = sourceMode.endsWith("unix2date")
      ? "Epoch input was converted to analyst-readable datetime with policy validation."
      : "Date input was normalized to Unix epoch seconds with policy validation."

    const summary = createSummaryFromFindings({
      title: summaryTitle,
      text: summaryText,
      findings,
      metrics: {
        unixSeconds: normalizedUnix,
        deltaSecondsFromNow: Math.abs(normalizedUnix - nowUnix),
        millisecondInput: wasMillisecondCandidate ? 1 : 0,
      },
      baseScore: 99,
    })

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "Unix Timestamp Converter",
        summary,
        findings,
        evidence: [
          {
            mode: sourceMode,
            input: trimmed,
            unixSeconds: normalizedUnix,
            output,
            isoUtc: toIsoFromUnix(normalizedUnix),
            millisecondInput: wasMillisecondCandidate,
          },
        ],
        recommendations: [
          "Normalize all ingest pipelines to one epoch unit (seconds) before persistence.",
          "Use timezone-explicit ISO-8601 strings for cross-team investigations.",
          "Set drift monitoring thresholds to detect clock-sync failures quickly.",
        ],
        raw: {
          mode: sourceMode,
          input: trimmed,
          output,
          unixSeconds: normalizedUnix,
          policy,
        },
      }),
    )
  }

  return (
    <ToolTemplate
      toolName="Unix Timestamp Converter"
      description="Convert timestamps with policy gates for drift windows, timezone requirements, and unit-consistency controls."
      actionLabel="Convert"
      controls={
        <div className="space-y-3">
          <Tabs value={mode} onValueChange={handleModeChange} className="w-[320px] max-w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="auto">Auto</TabsTrigger>
              <TabsTrigger value="unix2date">Unix to Date</TabsTrigger>
              <TabsTrigger value="date2unix">Date to Unix</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Max past window (days)</Label>
              <Input value={maxPastDaysInput} onChange={(event) => setMaxPastDaysInput(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Max future window (days)</Label>
              <Input value={maxFutureDaysInput} onChange={(event) => setMaxFutureDaysInput(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Max absolute Unix seconds</Label>
              <Input value={maxAbsoluteUnixInput} onChange={(event) => setMaxAbsoluteUnixInput(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Max drift (hours)</Label>
              <Input value={maxDriftHoursInput} onChange={(event) => setMaxDriftHoursInput(event.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="timestamp-reject-pre-epoch">Reject pre-epoch timestamps</Label>
              <Switch
                id="timestamp-reject-pre-epoch"
                checked={rejectPreEpoch}
                onChange={(event) => setRejectPreEpoch(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="timestamp-require-timezone">Require timezone for date inputs</Label>
              <Switch
                id="timestamp-require-timezone"
                checked={requireTimezoneForDateInputs}
                onChange={(event) => setRequireTimezoneForDateInputs(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="timestamp-reject-ms">Reject millisecond epoch inputs</Label>
              <Switch
                id="timestamp-reject-ms"
                checked={rejectMillisecondsInput}
                onChange={(event) => setRejectMillisecondsInput(event.target.checked)}
              />
            </div>
          </div>
        </div>
      }
      onProcess={process}
      examples={[
        getCurrentUnix().toString(),
        "2026-02-26T14:30:00Z",
        "1672531200",
      ]}
    />
  )
}
