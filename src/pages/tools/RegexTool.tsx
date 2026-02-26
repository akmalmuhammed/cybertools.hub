import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

interface RegexMatchEvidence {
    index: number
    value: string
    length: number
    groups: string[]
}

interface RegexRawPayload {
    pattern: string
    flags: string
    input: string
    matches: RegexMatchEvidence[]
}

function hasBacktrackingRisk(pattern: string): boolean {
    return /(\([^)]*[+*][^)]*\)[+*])|(\.\*){2,}|(\[[^\]]+\][+*][^)]*[+*])/.test(pattern)
}

export default function RegexTool() {
    const [pattern, setPattern] = useState("")
    const [flags, setFlags] = useState("g")

    const process = (input: string) => {
        const trimmedPattern = pattern.trim()
        if (!trimmedPattern) throw new Error("Please enter a regex pattern")

        let compiledRegex: RegExp
        try {
            compiledRegex = new RegExp(trimmedPattern, flags)
        } catch {
            throw new Error("Invalid regex pattern or flags")
        }

        const iteratorFlags = flags.includes("g") ? flags : `${flags}g`
        const iteratorRegex = new RegExp(trimmedPattern, iteratorFlags)
        const matches: RegexMatchEvidence[] = []

        let match: RegExpExecArray | null
        let safety = 0
        while ((match = iteratorRegex.exec(input)) !== null && safety < 2000 && matches.length < 750) {
            safety += 1
            matches.push({
                index: match.index,
                value: match[0],
                length: match[0].length,
                groups: match.slice(1).map((group) => group ?? ""),
            })

            if (match[0].length === 0) {
                iteratorRegex.lastIndex += 1
            }
        }

        const findings: ToolFinding[] = []
        const riskyPattern = hasBacktrackingRisk(trimmedPattern)
        if (riskyPattern) {
            findings.push({
                id: "regex-backtracking-risk",
                severity: input.length > 5000 ? "high" : "medium",
                confidence: 79,
                category: "performance-risk",
                title: "Potential catastrophic backtracking pattern",
                description: "Pattern includes nested quantifier structures that can degrade matching performance on crafted input.",
                remediation: "Prefer bounded quantifiers, atomic-like grouping alternatives, or anchored expressions.",
            })
        }

        if (!flags.includes("g")) {
            findings.push({
                id: "regex-global-flag-missing",
                severity: "info",
                confidence: 67,
                category: "coverage",
                title: "Global flag not enabled",
                description: "Processing still enumerated matches with a global iterator for export, but the configured flags omit g.",
                remediation: "Enable g when you need full-match enumeration in production parsing workflows.",
            })
        }

        if (matches.length === 0) {
            findings.push({
                id: "regex-no-match",
                severity: "low",
                confidence: 76,
                category: "query-quality",
                title: "No matches detected",
                description: "Pattern compiled successfully but no substrings matched the provided sample.",
                remediation: "Validate anchors, character classes, and case-sensitivity flags against real payloads.",
            })
        }

        if (matches.length >= 750) {
            findings.push({
                id: "regex-match-cap",
                severity: "low",
                confidence: 73,
                category: "workflow-limit",
                title: "Match export cap reached",
                description: "Match collection was truncated at 750 results to keep local rendering responsive.",
                remediation: "Narrow your pattern or chunk large inputs for full-fidelity evidence capture.",
            })
        }

        const uniqueMatches = new Set(matches.map((item) => item.value)).size
        const sampleMatch = input.match(compiledRegex)?.[0] ?? ""

        const summary = createSummaryFromFindings({
            title: "Regex evaluation completed",
            text: "Pattern was compiled and evaluated with structured evidence for operational export.",
            findings,
            metrics: {
                inputChars: input.length,
                matchCount: matches.length,
                uniqueMatches,
                sampleMatchLength: sampleMatch.length,
            },
            baseScore: 97,
        })

        const raw: RegexRawPayload = {
            pattern: trimmedPattern,
            flags,
            input,
            matches,
        }

        return JSON.stringify(
            buildToolResultEnvelope({
                toolName: "Regex Tester",
                summary,
                findings,
                evidence: matches.map((item, index) => ({
                    sequence: index + 1,
                    index: item.index,
                    value: item.value,
                    length: item.length,
                    groups: item.groups.join(" | "),
                })),
                recommendations: [
                    "Use representative production samples to validate regex precision and recall.",
                    "Review backtracking risk before deploying patterns in request-path validation.",
                    "Version-control pattern changes with known-good fixture inputs.",
                ],
                raw,
            }),
        )
    }

    const renderOutput = (output: string) => {
        if (!output) return null

        const envelope = parseToolResultEnvelope(output, "Regex Tester")
        const rawRecord = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
            ? (envelope.raw as Record<string, unknown>)
            : null

        const raw = rawRecord as RegexRawPayload | null
        const sourceText = typeof raw?.input === "string" ? raw.input : ""
        const executedPattern = typeof raw?.pattern === "string" ? raw.pattern : pattern
        const executedFlags = typeof raw?.flags === "string" ? raw.flags : flags
        const matches = Array.isArray(raw?.matches)
            ? raw.matches
                .filter((item): item is RegexMatchEvidence => (
                    typeof item === "object"
                    && item !== null
                    && typeof item.index === "number"
                    && typeof item.value === "string"
                ))
                .sort((a, b) => a.index - b.index)
            : []

        if (!sourceText) {
            return <div className="text-sm text-muted-foreground">Run the matcher to render highlighted evidence.</div>
        }

        const highlightedParts: JSX.Element[] = []
        let cursor = 0
        matches.forEach((item, index) => {
            const start = Math.max(0, item.index)
            const end = Math.min(sourceText.length, item.index + Math.max(0, item.value.length))

            if (start > cursor) {
                highlightedParts.push(<span key={`text-${cursor}`}>{sourceText.slice(cursor, start)}</span>)
            }

            if (end > start) {
                highlightedParts.push(
                    <span
                        key={`match-${index}-${start}`}
                        className="bg-yellow-500/30 text-yellow-500 font-bold rounded px-0.5 border border-yellow-500/50"
                    >
                        {sourceText.slice(start, end)}
                    </span>,
                )
                cursor = end
            } else {
                highlightedParts.push(
                    <span
                        key={`zero-${index}-${start}`}
                        className="inline-flex items-center rounded border border-yellow-500/50 bg-yellow-500/20 px-1 text-[10px] text-yellow-500"
                    >
                        ∅
                    </span>,
                )
            }
        })

        if (cursor < sourceText.length) {
            highlightedParts.push(<span key={`tail-${cursor}`}>{sourceText.slice(cursor)}</span>)
        }

        return (
            <div className="flex flex-col gap-4 h-full">
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Pattern: <span className="font-mono text-foreground">{executedPattern}</span>
                    {" | "}
                    Flags: <span className="font-mono text-foreground">{executedFlags || "(none)"}</span>
                    {" | "}
                    Matches: <span className="font-semibold text-foreground">{matches.length}</span>
                </div>

                <div className="p-4 rounded-md bg-muted/50 font-mono text-sm whitespace-pre-wrap break-all min-h-[220px] border border-border">
                    {highlightedParts.length > 0 ? highlightedParts : sourceText}
                </div>
            </div>
        )
    }

    return (
        <ToolTemplate
            toolName="Regex Tester"
            description="Test regular expressions with match evidence, performance-risk hints, and highlighted output."
            actionLabel="Evaluate Pattern"
            examples={[
                "GET /api/v1/users/42?admin=true HTTP/1.1",
                "alice@example.com bob@example.org root@internal.local",
                "Alert IDs: A-1001, A-1002, B-2150",
            ]}
            initialInput="Hello 123 World 456"
            controls={
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={pattern}
                            onChange={(event) => setPattern(event.target.value)}
                            placeholder="Pattern (e.g. \\d+)"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        />
                        <input
                            type="text"
                            value={flags}
                            onChange={(event) => setFlags(event.target.value)}
                            placeholder="gmi"
                            className="flex h-10 w-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Enter pattern + flags, then evaluate. Findings and evidence export include match offsets and captured groups.
                    </p>
                </div>
            }
            onProcess={process}
            renderOutput={renderOutput}
        />
    )
}
