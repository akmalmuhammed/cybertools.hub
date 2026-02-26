import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { encodeHTML, decodeHTML } from "@/lib/utils/encoders"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { buildToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

function inspectHtmlFindings(html: string): ToolFinding[] {
    const findings: ToolFinding[] = []
    const lowered = html.toLowerCase()

    if (!html.trim()) return findings

    if (/<script\b/i.test(html)) {
        findings.push({
            id: "html-script-tag",
            severity: "high",
            confidence: 92,
            category: "xss-risk",
            title: "Script tag content detected",
            description: "Decoded payload contains <script> tags that can execute in unsafe render paths.",
            remediation: "Sanitize or strip active script content before rendering untrusted HTML.",
        })
    }

    if (/\son[a-z]+\s*=/i.test(html)) {
        findings.push({
            id: "html-inline-handler",
            severity: "medium",
            confidence: 86,
            category: "xss-risk",
            title: "Inline event handlers detected",
            description: "Decoded payload includes inline event attributes (e.g., onerror, onclick).",
            remediation: "Disallow inline handlers and enforce CSP with nonce/hash-based script policies.",
        })
    }

    if (lowered.includes("javascript:")) {
        findings.push({
            id: "html-javascript-uri",
            severity: "high",
            confidence: 90,
            category: "xss-risk",
            title: "javascript: URI detected",
            description: "Payload includes javascript: URI scheme which is unsafe in clickable contexts.",
            remediation: "Reject javascript: URIs and allow-list only http/https/mailto where required.",
        })
    }

    if (/<iframe\b/i.test(html)) {
        findings.push({
            id: "html-iframe",
            severity: "low",
            confidence: 70,
            category: "content-security",
            title: "Embedded iframe detected",
            description: "Payload contains iframe markup which should be reviewed for trust boundaries.",
            remediation: "Restrict iframe sources and apply sandbox policies when embedding external content.",
        })
    }

    return findings
}

export default function HtmlEncoderTool() {
    const [mode, setMode] = useState<"encode" | "decode">("encode")

    const handleModeChange = (value: string) => {
        if (value === "encode" || value === "decode") {
            setMode(value)
        }
    }

    const process = (input: string) => {
        const output = mode === "encode" ? encodeHTML(input) : decodeHTML(input)
        const analysisTarget = mode === "decode" ? output : input
        const findings = inspectHtmlFindings(analysisTarget)

        if (mode === "encode" && /[<>'"&]/.test(input) && findings.length === 0) {
            findings.push({
                id: "html-characters-encoded",
                severity: "info",
                confidence: 72,
                category: "xss-risk",
                title: "Potentially unsafe characters were encoded",
                description: "Input contained HTML control characters and was encoded to safer entities.",
                remediation: "Keep output encoded when displaying untrusted content in HTML contexts.",
            })
        }

        const summary = createSummaryFromFindings({
            title: "HTML transformation completed",
            text: mode === "encode"
                ? "HTML entities encoded for safer rendering and transport."
                : "HTML entities decoded for analyst inspection and content review.",
            findings,
            metrics: {
                inputChars: input.length,
                outputChars: output.length,
                changed: output === input ? 0 : 1,
            },
            baseScore: 98,
        })

        const recommendations = [
            "Always encode untrusted content before injecting into HTML templates.",
            "Use strict CSP and avoid inline JavaScript/event handlers.",
            "Review decoded payloads before rendering in browser-like contexts.",
        ]

        return JSON.stringify(
            buildToolResultEnvelope({
                toolName: "HTML Encoder",
                summary,
                findings,
                evidence: [
                    {
                        mode,
                        input,
                        output,
                        analysisTarget,
                        changed: output !== input,
                    },
                ],
                recommendations,
                raw: { mode, input, output },
            }),
        )
    }

    return (
        <ToolTemplate
            toolName="HTML Encoder"
            description="Encode and decode HTML entities to prevent XSS."
            actionLabel={mode === "encode" ? "Encode" : "Decode"}
            controls={
                <Tabs value={mode} onValueChange={handleModeChange} className="w-[200px]">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="encode">Encode</TabsTrigger>
                        <TabsTrigger value="decode">Decode</TabsTrigger>
                    </TabsList>
                </Tabs>
            }
            onProcess={process}
            examples={[
                "<script>alert('xss')</script>",
                "&lt;div&gt;Hello&lt;/div&gt;"
            ]}
        />
    )
}
