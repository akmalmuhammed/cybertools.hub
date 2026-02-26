import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { encodeURL, decodeURL } from "@/lib/utils/encoders"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { buildToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

function inspectUrlFindings(candidate: string): ToolFinding[] {
    const findings: ToolFinding[] = []
    const trimmed = candidate.trim()
    if (!trimmed) return findings

    const protocolMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/)
    const protocol = protocolMatch?.[1]?.toLowerCase()

    if (protocol === "javascript" || protocol === "data") {
        findings.push({
            id: "url-dangerous-scheme",
            severity: "high",
            confidence: 88,
            category: "link-safety",
            title: "Potentially dangerous URL scheme detected",
            description: `Detected ${protocol}: scheme. Validate before sharing or rendering this link.`,
            remediation: "Prefer https:// URLs for user-facing links and block script/data schemes in untrusted contexts.",
        })
    }

    if (/%0d|%0a/i.test(trimmed)) {
        findings.push({
            id: "url-encoded-crlf",
            severity: "medium",
            confidence: 78,
            category: "input-safety",
            title: "Encoded CRLF characters present",
            description: "URL contains encoded line break characters that can be abused in header-splitting chains.",
            remediation: "Reject or sanitize CRLF payloads in redirect and header construction paths.",
        })
    }

    try {
        const parsed = new URL(trimmed)
        if (parsed.username || parsed.password) {
            findings.push({
                id: "url-embedded-credentials",
                severity: "medium",
                confidence: 90,
                category: "credential-exposure",
                title: "Embedded URL credentials found",
                description: "Username/password are embedded directly in the URL authority component.",
                remediation: "Move credentials to secure secret storage and authenticated request headers.",
            })
        }

        if (parsed.hostname.includes("xn--")) {
            findings.push({
                id: "url-punycode-host",
                severity: "low",
                confidence: 68,
                category: "identity-abuse",
                title: "Punycode hostname detected",
                description: "Internationalized hostname may require spoofing review in phishing-sensitive workflows.",
                remediation: "Validate expected domain ownership and monitor for homoglyph abuse.",
            })
        }
    } catch {
        if (trimmed.includes("://")) {
            findings.push({
                id: "url-parse-anomaly",
                severity: "low",
                confidence: 60,
                category: "data-quality",
                title: "URL parsing anomaly",
                description: "Input resembles a URL but could not be parsed as a standard absolute URL.",
                remediation: "Normalize and validate URL components before downstream automation.",
            })
        }
    }

    return findings
}

export default function UrlTool() {
    const [mode, setMode] = useState<"encode" | "decode">("encode")

    const handleModeChange = (value: string) => {
        if (value === "encode" || value === "decode") {
            setMode(value)
        }
    }

    const process = (input: string) => {
        const output = mode === "encode" ? encodeURL(input) : decodeURL(input)
        const inspectionTarget = mode === "decode" ? output : input
        const findings = inspectUrlFindings(inspectionTarget)
        const summary = createSummaryFromFindings({
            title: "URL transformation completed",
            text: mode === "encode"
                ? "URL encoding completed for safe transport and logging contexts."
                : "URL decoding completed for analyst inspection and triage.",
            findings,
            metrics: {
                inputChars: input.length,
                outputChars: output.length,
                changed: output === input ? 0 : 1,
            },
            baseScore: 98,
        })

        const recommendations = [
            "Normalize URLs before deduplication and reputation matching.",
            "Block dangerous schemes (javascript/data) in user-controllable redirect flows.",
            "Avoid storing credentials inside URL authority fields.",
        ]

        return JSON.stringify(
            buildToolResultEnvelope({
                toolName: "URL Encoder/Decoder",
                summary,
                findings,
                evidence: [
                    {
                        mode,
                        input,
                        output,
                        inspectedTarget: inspectionTarget,
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
            toolName="URL Encoder/Decoder"
            description="Encode and decode URLs to handle special characters safely."
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
                "https://example.com/search?q=hello world",
                "https%3A%2F%2Fexample.com%2Fsearch%3Fq%3Dhello%20world"
            ]}
        />
    )
}
