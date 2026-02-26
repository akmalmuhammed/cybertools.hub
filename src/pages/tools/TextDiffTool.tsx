import { useState } from "react"
import type { Change } from "diff"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { Textarea } from "@/components/ui/textarea"
import { diffText } from "@/lib/utils/text"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

interface DiffRawPayload {
    before: string
    after: string
    diffs: Change[]
}

export default function TextDiffTool() {
    const [text2, setText2] = useState("")

    const process = (input: string) => {
        const diffs = diffText(input, text2)
        const metrics = diffs.reduce(
            (acc, segment) => {
                const length = segment.value.length
                if (segment.added) {
                    acc.addedSegments += 1
                    acc.addedChars += length
                } else if (segment.removed) {
                    acc.removedSegments += 1
                    acc.removedChars += length
                } else {
                    acc.unchangedSegments += 1
                    acc.unchangedChars += length
                }
                return acc
            },
            {
                addedSegments: 0,
                removedSegments: 0,
                unchangedSegments: 0,
                addedChars: 0,
                removedChars: 0,
                unchangedChars: 0,
            },
        )

        const findings: ToolFinding[] = []
        if (metrics.addedSegments === 0 && metrics.removedSegments === 0) {
            findings.push({
                id: "diff-no-change",
                severity: "info",
                confidence: 95,
                category: "change-review",
                title: "No content differences detected",
                description: "Compared payloads are identical.",
                remediation: "Proceed with baseline confirmation or compare alternate revisions.",
            })
        }

        if (metrics.removedChars > metrics.addedChars * 3 && metrics.removedChars > 200) {
            findings.push({
                id: "diff-heavy-deletion",
                severity: "medium",
                confidence: 80,
                category: "change-risk",
                title: "Large deletion delta detected",
                description: "Removed content substantially exceeds additions, which may indicate accidental truncation.",
                remediation: "Validate change intent and approvals before applying this revision.",
            })
        }

        if (metrics.addedChars + metrics.removedChars > 4000) {
            findings.push({
                id: "diff-large-change-window",
                severity: "low",
                confidence: 69,
                category: "review-workflow",
                title: "High-volume text change",
                description: "Large change set may benefit from chunked review and owner sign-off.",
                remediation: "Split and review changes by section to improve traceability.",
            })
        }

        const summary = createSummaryFromFindings({
            title: "Text diff computed",
            text: "Before/after inputs were compared and normalized into change segments.",
            findings,
            metrics: {
                addedSegments: metrics.addedSegments,
                removedSegments: metrics.removedSegments,
                unchangedSegments: metrics.unchangedSegments,
                addedChars: metrics.addedChars,
                removedChars: metrics.removedChars,
            },
            baseScore: 97,
        })

        const raw: DiffRawPayload = {
            before: input,
            after: text2,
            diffs,
        }

        return JSON.stringify(
            buildToolResultEnvelope({
                toolName: "Text Diff",
                summary,
                findings,
                evidence: diffs.slice(0, 600).map((segment, index) => ({
                    sequence: index + 1,
                    type: segment.added ? "added" : segment.removed ? "removed" : "context",
                    chars: segment.value.length,
                    preview: segment.value.slice(0, 140),
                })),
                recommendations: [
                    "Review high-volume deletions with change owner confirmation before rollout.",
                    "Use section-based diffs for large files to improve analyst review quality.",
                    "Attach approved diff evidence to release and incident records.",
                ],
                raw,
            }),
        )
    }

    const renderOutput = (output: string) => {
        if (!output) return null

        const envelope = parseToolResultEnvelope(output, "Text Diff")
        const rawRecord = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
            ? (envelope.raw as Record<string, unknown>)
            : null

        const diffs = Array.isArray(rawRecord?.diffs) ? (rawRecord.diffs as Change[]) : []
        if (diffs.length === 0) {
            return (
                <div className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                    No diff segments to render.
                </div>
            )
        }

        return (
            <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="rounded-md border border-border/60 bg-background/70 px-2 py-1.5">
                        <div className="text-muted-foreground uppercase">Added Segments</div>
                        <div className="font-semibold">{envelope.summary.metrics?.addedSegments ?? 0}</div>
                    </div>
                    <div className="rounded-md border border-border/60 bg-background/70 px-2 py-1.5">
                        <div className="text-muted-foreground uppercase">Removed Segments</div>
                        <div className="font-semibold">{envelope.summary.metrics?.removedSegments ?? 0}</div>
                    </div>
                    <div className="rounded-md border border-border/60 bg-background/70 px-2 py-1.5">
                        <div className="text-muted-foreground uppercase">Added Chars</div>
                        <div className="font-semibold">{envelope.summary.metrics?.addedChars ?? 0}</div>
                    </div>
                    <div className="rounded-md border border-border/60 bg-background/70 px-2 py-1.5">
                        <div className="text-muted-foreground uppercase">Removed Chars</div>
                        <div className="font-semibold">{envelope.summary.metrics?.removedChars ?? 0}</div>
                    </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-md font-mono text-sm whitespace-pre-wrap border border-border min-h-[300px]">
                    {diffs.map((segment, index) => {
                        const tone = segment.added
                            ? "bg-emerald-500/25 text-emerald-700 dark:text-emerald-300"
                            : segment.removed
                                ? "bg-red-500/25 text-red-700 dark:text-red-300"
                                : "text-foreground"

                        return (
                            <span key={`${index}-${segment.value.length}`} className={tone}>
                                {segment.value}
                            </span>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <ToolTemplate
            toolName="Text Diff"
            description="Compare two text snippets with structured change evidence and review-risk hints."
            actionLabel="Compare"
            placeholder="Original text..."
            controls={
                <div className="space-y-2 mb-4">
                    <label className="text-sm font-medium">Modified Text</label>
                    <Textarea
                        value={text2}
                        onChange={(event) => setText2(event.target.value)}
                        placeholder="Modified text..."
                        className="min-h-[150px] font-mono"
                    />
                </div>
            }
            onProcess={process}
            renderOutput={renderOutput}
        />
    )
}
