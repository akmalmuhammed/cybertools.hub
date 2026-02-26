import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { type IpLookupResult, lookupIpIntel } from "@/lib/utils/ip-intel"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

export default function IpLookupTool() {
    const [includeRdap, setIncludeRdap] = useState(true)
    const [timeoutMs, setTimeoutMs] = useState("6000")

    const process = async (input: string) => {
        const data = await lookupIpIntel(input, includeRdap, Number(timeoutMs) || 6000)
        const findings: ToolFinding[] = []

        if (data.classification.scope === "public") {
            findings.push({
                id: "ip-public-address",
                severity: "medium",
                confidence: 72,
                category: "external-exposure",
                title: "Publicly routable IP",
                description: "Indicator belongs to public address space and may be externally reachable.",
                remediation: "Validate exposure necessity and correlate with ASN/geolocation abuse context.",
            })
        }

        if (data.classification.scope === "private" || data.classification.scope === "reserved") {
            findings.push({
                id: "ip-non-public-scope",
                severity: "low",
                confidence: 77,
                category: "data-quality",
                title: "Non-public IP scope detected",
                description: `${data.classification.type} address may be internal, documentation, or reserved space.`,
                remediation: "Confirm this indicator is expected before escalating external threat context.",
            })
        }

        if (includeRdap && data.source === "local") {
            findings.push({
                id: "ip-rdap-unavailable",
                severity: "low",
                confidence: 65,
                category: "intel-coverage",
                title: "RDAP enrichment unavailable",
                description: "Lookup fell back to local-only classification due to RDAP failure or timeout.",
                remediation: "Retry with longer timeout or validate network egress to RDAP endpoints.",
            })
        }

        if (data.rdap?.country && data.classification.scope === "public") {
            findings.push({
                id: "ip-geo-context",
                severity: "info",
                confidence: 62,
                category: "threat-intel-context",
                title: "Country context available",
                description: `RDAP reports country code ${data.rdap.country}.`,
                remediation: "Use geo context alongside abuse and behavioral telemetry, not as a sole block signal.",
            })
        }

        const summary = createSummaryFromFindings({
            title: "IP analysis completed",
            text: `Resolved ${data.ip} (${data.version}) with ${data.source === "rdap" ? "RDAP + local" : "local-only"} context.`,
            findings,
            metrics: {
                hasRdap: data.rdap ? 1 : 0,
                noteCount: data.notes.length,
                publicScope: data.classification.scope === "public" ? 1 : 0,
            },
            baseScore: 95,
        })

        return JSON.stringify(
            buildToolResultEnvelope({
                toolName: "IP Lookup",
                summary,
                findings,
                evidence: [
                    {
                        ...data,
                    },
                ],
                recommendations: [
                    "Correlate public IP indicators with flow logs, service inventories, and abuse telemetry.",
                    "Treat reserved/private IP indicators as context-sensitive, not immediate external threats.",
                    "Use RDAP data as enrichment, then validate with active incident evidence.",
                ],
                raw: { ipLookup: data },
            }),
        )
    }

    const renderOutput = (output: string) => {
        if (!output) return null
        const envelope = parseToolResultEnvelope(output, "IP Lookup")
        const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
            ? (envelope.raw as Record<string, unknown>)
            : null
        const data = raw?.ipLookup as IpLookupResult | undefined
        if (!data) return null

        return (
            <div className="space-y-4">
                <div className="grid gap-2">
                    <div className="p-3 border rounded bg-muted/20">
                        <span className="block text-xs font-bold text-muted-foreground uppercase">IP</span>
                        <span className="font-mono">{data.ip}</span>
                    </div>
                    <div className="p-3 border rounded bg-muted/20">
                        <span className="block text-xs font-bold text-muted-foreground uppercase">Version</span>
                        <span>{data.version}</span>
                    </div>
                    <div className="p-3 border rounded bg-muted/20">
                        <span className="block text-xs font-bold text-muted-foreground uppercase">Classification</span>
                        <span>{data.classification?.type} ({data.classification?.scope})</span>
                        <p className="text-xs text-muted-foreground mt-1">{data.classification?.description}</p>
                    </div>
                    <div className="p-3 border rounded bg-muted/20">
                        <span className="block text-xs font-bold text-muted-foreground uppercase">Data Source</span>
                        <span>{data.source === "rdap" ? "RDAP + Local" : "Local Classification Only"}</span>
                    </div>
                </div>

                {data.rdap && (
                    <div className="p-3 border rounded bg-muted/20 space-y-2">
                        <h3 className="text-sm font-semibold">RDAP Details</h3>
                        <div className="text-sm space-y-1">
                            {data.rdap.name && <div><span className="font-medium">Network:</span> {data.rdap.name}</div>}
                            {data.rdap.handle && <div><span className="font-medium">Handle:</span> {data.rdap.handle}</div>}
                            {data.rdap.country && <div><span className="font-medium">Country:</span> {data.rdap.country}</div>}
                            {data.rdap.startAddress && data.rdap.endAddress && (
                                <div><span className="font-medium">Range:</span> {data.rdap.startAddress} - {data.rdap.endAddress}</div>
                            )}
                        </div>
                    </div>
                )}

                {Array.isArray(data.notes) && data.notes.length > 0 && (
                    <div className="p-3 border rounded bg-muted/20">
                        <h3 className="text-sm font-semibold mb-2">Notes</h3>
                        <ul className="text-sm text-muted-foreground space-y-1">
                            {data.notes.map((note: string, idx: number) => (
                                <li key={idx}>• {note}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        )
    }

    return (
        <ToolTemplate
            toolName="IP Lookup"
            description="Analyze IP indicators with classification context, optional RDAP enrichment, and triage-oriented risk findings."
            actionLabel="Lookup"
            placeholder="8.8.8.8 or 2001:4860:4860::8888"
            onProcess={process}
            renderOutput={renderOutput}
            controls={
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
                        <Label htmlFor="ip-include-rdap" className="text-sm">Include RDAP enrichment</Label>
                        <Switch
                            id="ip-include-rdap"
                            checked={includeRdap}
                            onChange={(event) => setIncludeRdap(event.target.checked)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>Timeout (ms)</Label>
                        <Input
                            value={timeoutMs}
                            onChange={(event) => setTimeoutMs(event.target.value)}
                            placeholder="6000"
                        />
                    </div>
                </div>
            }
            examples={["8.8.8.8", "10.0.0.1", "2001:4860:4860::8888"]}
        />
    )
}
