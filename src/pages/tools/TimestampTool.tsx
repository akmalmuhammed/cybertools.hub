import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { unixToDate, dateToUnix, getCurrentUnix } from "@/lib/utils/time"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { buildToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

function inspectTimestampFindings(unixSeconds: number): ToolFinding[] {
    const findings: ToolFinding[] = []
    const now = getCurrentUnix()
    const deltaDays = Math.abs(unixSeconds - now) / 86_400

    if (unixSeconds < 0) {
        findings.push({
            id: "timestamp-pre-epoch",
            severity: "low",
            confidence: 70,
            category: "timeline-analysis",
            title: "Pre-epoch timestamp detected",
            description: "Timestamp is before 1970-01-01 UTC. Confirm this is expected historical data.",
            remediation: "Verify source system time semantics and signed epoch handling.",
        })
    }

    if (deltaDays > 3650) {
        findings.push({
            id: "timestamp-outlier-range",
            severity: "medium",
            confidence: 75,
            category: "timeline-analysis",
            title: "Timestamp is more than 10 years from current date",
            description: "Large time drift can indicate milliseconds/seconds confusion or data quality issues.",
            remediation: "Validate whether upstream values are seconds or milliseconds before ingestion.",
        })
    }

    return findings
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

export default function TimestampTool() {
    const [mode, setMode] = useState<"auto" | "unix2date" | "date2unix">("auto")

    const handleModeChange = (value: string) => {
        if (value === "auto" || value === "unix2date" || value === "date2unix") {
            setMode(value)
        }
    }

    const process = (input: string) => {
        const trimmed = input.trim()
        const nowUnix = getCurrentUnix()

        // Auto-detection logic
        if (mode === "auto") {
            if (/^\d{1,13}$/.test(trimmed)) {
                // Likely a timestamp
                const ts = parseInt(trimmed, 10)
                const normalizedUnix = Math.abs(ts) >= 1_000_000_000_000 ? Math.floor(ts / 1000) : ts
                const converted = unixToDate(ts)
                if (converted === "Invalid Timestamp") throw new Error("Invalid timestamp")
                const findings = inspectTimestampFindings(normalizedUnix)
                const summary = createSummaryFromFindings({
                    title: "Timestamp converted to date",
                    text: "Numeric epoch input was converted to a human-readable datetime.",
                    findings,
                    metrics: {
                        unixSeconds: normalizedUnix,
                        deltaSecondsFromNow: Math.abs(normalizedUnix - nowUnix),
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
                                mode: "auto-unix2date",
                                input: trimmed,
                                unixSeconds: normalizedUnix,
                                convertedDate: converted,
                                convertedIsoUtc: toIsoFromUnix(normalizedUnix),
                            },
                        ],
                        recommendations: [
                            "Normalize all ingest pipelines to either seconds or milliseconds, not mixed formats.",
                            "Store UTC timestamps and render local time only at presentation layer.",
                        ],
                        raw: { mode: "auto-unix2date", input: trimmed, output: converted },
                    }),
                )
            } else {
                // Assume date string
                const ts = dateToUnix(trimmed)
                if (Number.isNaN(ts)) throw new Error("Invalid date format")
                const findings = inspectTimestampFindings(ts)
                if (!/[zZ]|[+-]\d{2}:\d{2}/.test(trimmed)) {
                    findings.push({
                        id: "timestamp-timezone-implicit",
                        severity: "low",
                        confidence: 66,
                        category: "timeline-analysis",
                        title: "Timezone not explicitly declared",
                        description: "Date input does not include explicit timezone information.",
                        remediation: "Use ISO-8601 with timezone (for example, 2026-02-26T14:30:00Z) to avoid ambiguity.",
                    })
                }

                const summary = createSummaryFromFindings({
                    title: "Date converted to Unix timestamp",
                    text: "Date-like input was normalized to Unix epoch seconds.",
                    findings,
                    metrics: {
                        unixSeconds: ts,
                        deltaSecondsFromNow: Math.abs(ts - nowUnix),
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
                                mode: "auto-date2unix",
                                input: trimmed,
                                unixSeconds: ts,
                                isoUtc: toIsoFromUnix(ts),
                            },
                        ],
                        recommendations: [
                            "Normalize ingest and export timestamps to ISO-8601 UTC for cross-system consistency.",
                            "Document timezone assumptions in incident timelines and forensic reports.",
                        ],
                        raw: { mode: "auto-date2unix", input: trimmed, output: ts.toString() },
                    }),
                )
            }
        }

        if (mode === "unix2date") {
            const ts = parseInt(trimmed, 10)
            if (isNaN(ts)) throw new Error("Invalid timestamp")
            const normalizedUnix = Math.abs(ts) >= 1_000_000_000_000 ? Math.floor(ts / 1000) : ts
            const converted = unixToDate(ts)
            if (converted === "Invalid Timestamp") throw new Error("Invalid timestamp")
            const findings = inspectTimestampFindings(normalizedUnix)
            const summary = createSummaryFromFindings({
                title: "Timestamp converted to date",
                text: "Unix timestamp was converted to analyst-readable date format.",
                findings,
                metrics: {
                    unixSeconds: normalizedUnix,
                    deltaSecondsFromNow: Math.abs(normalizedUnix - nowUnix),
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
                            mode: "unix2date",
                            input: trimmed,
                            unixSeconds: normalizedUnix,
                            convertedDate: converted,
                            convertedIsoUtc: toIsoFromUnix(normalizedUnix),
                        },
                    ],
                    recommendations: [
                        "Detect and normalize millisecond vs second epoch values at ingestion boundaries.",
                        "Use UTC for storage and explicit timezone conversion for analyst-facing views.",
                    ],
                    raw: { mode: "unix2date", input: trimmed, output: converted },
                }),
            )
        }

        if (mode === "date2unix") {
            const ts = dateToUnix(trimmed)
            if (Number.isNaN(ts)) throw new Error("Invalid date format")
            const findings = inspectTimestampFindings(ts)
            if (!/[zZ]|[+-]\d{2}:\d{2}/.test(trimmed)) {
                findings.push({
                    id: "timestamp-timezone-implicit",
                    severity: "low",
                    confidence: 66,
                    category: "timeline-analysis",
                    title: "Timezone not explicitly declared",
                    description: "Date input does not include explicit timezone information.",
                    remediation: "Use ISO-8601 with timezone (for example, 2026-02-26T14:30:00Z) to avoid ambiguity.",
                })
            }

            const summary = createSummaryFromFindings({
                title: "Date converted to Unix timestamp",
                text: "Date input converted to normalized epoch seconds.",
                findings,
                metrics: {
                    unixSeconds: ts,
                    deltaSecondsFromNow: Math.abs(ts - nowUnix),
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
                            mode: "date2unix",
                            input: trimmed,
                            unixSeconds: ts,
                            isoUtc: toIsoFromUnix(ts),
                        },
                    ],
                    recommendations: [
                        "Prefer timezone-explicit ISO-8601 values for all cross-team incident sharing.",
                        "Validate clock drift if values appear significantly out of expected range.",
                    ],
                    raw: { mode: "date2unix", input: trimmed, output: ts.toString() },
                }),
            )
        }

        return ""
    }

    return (
        <ToolTemplate
            toolName="Unix Timestamp Converter"
            description="Convert between Unix timestamps and integer dates. Supports various formats."
            actionLabel="Convert"
            controls={
                <div className="flex items-center gap-4">
                    <Tabs value={mode} onValueChange={handleModeChange} className="w-[300px]">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="auto">Auto</TabsTrigger>
                            <TabsTrigger value="unix2date">Unix to Date</TabsTrigger>
                            <TabsTrigger value="date2unix">Date to Unix</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            }
            onProcess={process}
            examples={[
                getCurrentUnix().toString(),
                "2023-01-01 12:00:00",
                "1672531200"
            ]}
        />
    )
}
