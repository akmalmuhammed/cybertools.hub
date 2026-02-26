import { ToolTemplate } from "@/components/tools/ToolTemplate"
import ReactMarkdown from 'react-markdown'
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

interface MarkdownStats {
    headingCount: number
    linkCount: number
    imageCount: number
    codeFenceCount: number
    charCount: number
}

function buildMarkdownStats(input: string): MarkdownStats {
    const headingCount = (input.match(/^#{1,6}\s+/gm) ?? []).length
    const linkCount = (input.match(/\[[^\]]+\]\([^)]+\)/g) ?? []).length
    const imageCount = (input.match(/!\[[^\]]*\]\([^)]+\)/g) ?? []).length
    const codeFenceCount = Math.floor((input.match(/```/g) ?? []).length / 2)

    return {
        headingCount,
        linkCount,
        imageCount,
        codeFenceCount,
        charCount: input.length,
    }
}

function inspectMarkdownFindings(input: string): ToolFinding[] {
    const findings: ToolFinding[] = []

    if (/\[[^\]]+\]\(\s*javascript:[^)]+\)/i.test(input)) {
        findings.push({
            id: "markdown-javascript-link",
            severity: "high",
            confidence: 91,
            category: "content-safety",
            title: "javascript: link detected",
            description: "Markdown content contains JavaScript URI links, which are unsafe in many render paths.",
            remediation: "Reject javascript: links and allow-list trusted schemes such as https/mailto.",
        })
    }

    if (/<(script|iframe|object|embed)\b/i.test(input)) {
        findings.push({
            id: "markdown-inline-html",
            severity: "medium",
            confidence: 82,
            category: "content-safety",
            title: "Inline active HTML detected",
            description: "Markdown includes active HTML elements that may execute or embed remote content.",
            remediation: "Strip unsafe tags or render with strict HTML sanitization policies.",
        })
    }

    if (input.length > 20_000) {
        findings.push({
            id: "markdown-large-payload",
            severity: "low",
            confidence: 64,
            category: "workflow-limit",
            title: "Large markdown payload",
            description: "Large document size can impact rendering performance and review speed.",
            remediation: "Split large runbooks into sections and version them as separate artifacts.",
        })
    }

    return findings
}

export default function MarkdownTool() {
    const process = (input: string) => {
        const stats = buildMarkdownStats(input)
        const findings = inspectMarkdownFindings(input)
        const summary = createSummaryFromFindings({
            title: "Markdown preview generated",
            text: "Markdown content was parsed for preview with basic content-safety checks.",
            findings,
            metrics: {
                headingCount: stats.headingCount,
                linkCount: stats.linkCount,
                imageCount: stats.imageCount,
                codeFenceCount: stats.codeFenceCount,
                charCount: stats.charCount,
            },
            baseScore: 97,
        })

        return JSON.stringify(
            buildToolResultEnvelope({
                toolName: "Markdown Preview",
                summary,
                findings,
                evidence: [
                    {
                        ...stats,
                    },
                ],
                recommendations: [
                    "Sanitize untrusted markdown before rendering in shared portals.",
                    "Avoid javascript: links and active inline HTML in collaborative documentation.",
                    "Use sectioned runbooks for large documents to improve analyst review speed.",
                ],
                raw: { markdown: input },
            }),
        )
    }

    const renderOutput = (output: string) => {
        if (!output) return null
        const envelope = parseToolResultEnvelope(output, "Markdown Preview")
        const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
            ? (envelope.raw as Record<string, unknown>)
            : null
        const markdown = typeof raw?.markdown === "string" ? raw.markdown : output

        return (
            <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="rounded-md border border-border/60 bg-background/70 px-2 py-1.5">
                        <div className="text-muted-foreground uppercase">Headings</div>
                        <div className="font-semibold">{envelope.summary.metrics?.headingCount ?? 0}</div>
                    </div>
                    <div className="rounded-md border border-border/60 bg-background/70 px-2 py-1.5">
                        <div className="text-muted-foreground uppercase">Links</div>
                        <div className="font-semibold">{envelope.summary.metrics?.linkCount ?? 0}</div>
                    </div>
                    <div className="rounded-md border border-border/60 bg-background/70 px-2 py-1.5">
                        <div className="text-muted-foreground uppercase">Images</div>
                        <div className="font-semibold">{envelope.summary.metrics?.imageCount ?? 0}</div>
                    </div>
                    <div className="rounded-md border border-border/60 bg-background/70 px-2 py-1.5">
                        <div className="text-muted-foreground uppercase">Code Blocks</div>
                        <div className="font-semibold">{envelope.summary.metrics?.codeFenceCount ?? 0}</div>
                    </div>
                </div>
                <div className="prose dark:prose-invert max-w-none p-4 overflow-y-auto max-h-[500px] border rounded-md">
                    <ReactMarkdown>{markdown}</ReactMarkdown>
                </div>
            </div>
        )
    }

    return (
        <ToolTemplate
            toolName="Markdown Preview"
            description="Live preview for Markdown text."
            actionLabel="Preview"
            placeholder="# Hello World\n\n**Bold text** and *italic*."
            onProcess={process}
            renderOutput={renderOutput}
            examples={["# Title\n\nBody text with [link](https://example.com)."]}
        />
    )
}
