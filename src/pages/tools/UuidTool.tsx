import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { generateUUID } from "@/lib/utils/crypto"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default function UuidTool() {
    const process = () => {
        const uuid = generateUUID()
        const findings: ToolFinding[] = []

        if (!UUID_V4_PATTERN.test(uuid)) {
            findings.push({
                id: "uuid-format-check-failed",
                severity: "high",
                confidence: 98,
                category: "identifier-generation",
                title: "Generated value failed UUID v4 format validation",
                description: "The generated identifier does not match RFC4122 UUID v4 structure.",
                remediation: "Block downstream automation and validate random UUID implementation.",
            })
        }

        const summary = createSummaryFromFindings({
            title: "UUID generated",
            text: "Generated a UUID v4 identifier suitable for correlation and non-secret entity tracking.",
            findings,
            metrics: {
                length: uuid.length,
                hyphenCount: (uuid.match(/-/g) ?? []).length,
            },
            baseScore: 100,
        })

        return JSON.stringify(
            buildToolResultEnvelope({
                toolName: "UUID Generator",
                summary,
                findings,
                evidence: [
                    {
                        uuid,
                        version: 4,
                        generatedAt: new Date().toISOString(),
                        validV4: UUID_V4_PATTERN.test(uuid),
                    },
                ],
                recommendations: [
                    "Use UUIDs as non-secret identifiers, not as authentication tokens.",
                    "Record generation timestamp when UUIDs are used in incident timelines.",
                ],
                raw: { uuid },
            }),
        )
    }

    const renderOutput = (output: string) => {
        if (!output) return null
        const envelope = parseToolResultEnvelope(output, "UUID Generator")
        const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
            ? (envelope.raw as Record<string, unknown>)
            : null
        const uuid = typeof raw?.uuid === "string"
            ? raw.uuid
            : typeof envelope.evidence[0]?.uuid === "string"
                ? envelope.evidence[0].uuid
                : output

        return (
            <div className="flex flex-col justify-center items-center h-full gap-4">
                <div className="text-3xl font-mono font-bold text-primary break-all text-center p-4">
                    {uuid}
                </div>
                <p className="text-muted-foreground">UUID v4 (Random)</p>
            </div>
        )
    }

    return (
        <ToolTemplate
            toolName="UUID Generator"
            description="Generate standard UUID v4 identifiers."
            actionLabel="Generate New UUID"
            placeholder="Click Generate to create a new UUID"
            requiresInput={false}
            onProcess={process}
            renderOutput={renderOutput}
        />
    )
}
