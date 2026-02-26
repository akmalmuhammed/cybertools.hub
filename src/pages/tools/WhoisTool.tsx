import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { lookupWhois, type WhoisLookupResult } from "@/lib/utils/whois"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

function daysBetween(dateString: string | null): number | null {
    if (!dateString) return null
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return null
    return Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export default function WhoisTool() {
    const [timeoutMs, setTimeoutMs] = useState("6000")
    const [showNotices, setShowNotices] = useState(false)

    const process = async (input: string) => {
        const result = await lookupWhois(input, { timeoutMs: Number(timeoutMs) || 6000 })
        const findings: ToolFinding[] = []
        const data = result.data

        const domainAgeDays = daysBetween(data.createdAt)
        if (domainAgeDays !== null) {
            const age = Math.abs(domainAgeDays)
            if (age <= 30) {
                findings.push({
                    id: "whois-new-domain",
                    severity: "high",
                    confidence: 85,
                    category: "threat-intel-context",
                    title: "Recently registered domain",
                    description: `Domain was registered ${age} days ago.`,
                    remediation: "Apply heightened monitoring and verification controls for newly created domains.",
                })
            } else if (age <= 180) {
                findings.push({
                    id: "whois-young-domain",
                    severity: "medium",
                    confidence: 73,
                    category: "threat-intel-context",
                    title: "Young domain age profile",
                    description: `Domain registration age is ${age} days.`,
                    remediation: "Correlate with brand-abuse and mail-auth posture before trust decisions.",
                })
            }
        }

        const daysToExpiry = daysBetween(data.expiresAt)
        if (typeof daysToExpiry === "number") {
            if (daysToExpiry <= 14) {
                findings.push({
                    id: "whois-expiring-soon",
                    severity: "high",
                    confidence: 82,
                    category: "external-exposure",
                    title: "Domain expires within 14 days",
                    description: `Domain is set to expire in ${daysToExpiry} days.`,
                    remediation: "Review renewal status and monitor for domain hijack or lapse risk.",
                })
            } else if (daysToExpiry <= 45) {
                findings.push({
                    id: "whois-expiring-window",
                    severity: "medium",
                    confidence: 70,
                    category: "external-exposure",
                    title: "Domain expiration window approaching",
                    description: `Domain expires in ${daysToExpiry} days.`,
                    remediation: "Validate ownership and ensure renewal controls are in place.",
                })
            }
        }

        if (!data.registrar) {
            findings.push({
                id: "whois-registrar-missing",
                severity: "low",
                confidence: 68,
                category: "data-quality",
                title: "Registrar data unavailable",
                description: "RDAP response did not provide registrar identity.",
                remediation: "Cross-check registry or secondary intelligence sources.",
            })
        }

        if (data.dnssec !== "signed") {
            findings.push({
                id: "whois-dnssec-not-signed",
                severity: "medium",
                confidence: 74,
                category: "network-hardening",
                title: "DNSSEC not signed",
                description: "Domain is unsigned or DNSSEC status is unknown.",
                remediation: "Enable and validate DNSSEC signing for anti-spoofing resilience.",
            })
        }

        const holdStatuses = data.status.filter((status) => /hold/i.test(status))
        if (holdStatuses.length > 0) {
            findings.push({
                id: "whois-domain-hold-status",
                severity: "high",
                confidence: 86,
                category: "threat-intel-context",
                title: "Domain hold status present",
                description: `Observed hold status values: ${holdStatuses.join(", ")}`,
                remediation: "Investigate domain ownership and abuse/compliance implications.",
            })
        }

        const summary = createSummaryFromFindings({
            title: "WHOIS/RDAP lookup completed",
            text: `Resolved registration metadata for ${data.domain}.`,
            findings,
            metrics: {
                statusCount: data.status.length,
                nameserverCount: data.nameservers.length,
                noticesCount: data.notices.length,
                hasRegistrar: data.registrar ? 1 : 0,
                dnssecSigned: data.dnssec === "signed" ? 1 : 0,
            },
            baseScore: 94,
        })

        return JSON.stringify(
            buildToolResultEnvelope({
                toolName: "Whois Lookup",
                summary,
                findings,
                evidence: [
                    {
                        query: result.query,
                        source: result.source,
                        ...data,
                    },
                ],
                recommendations: [
                    "Correlate domain age, hold states, and mail-auth posture before allowlisting.",
                    "Track expiration windows for high-dependency domains to avoid service and takeover risk.",
                    "Use DNSSEC signing where possible for stronger domain integrity.",
                ],
                raw: { whois: result },
            }),
        )
    }

    const renderOutput = (output: string) => {
        if (!output) return null
        const envelope = parseToolResultEnvelope(output, "Whois Lookup")
        const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
            ? (envelope.raw as Record<string, unknown>)
            : null
        const payload = raw?.whois as WhoisLookupResult | undefined
        if (!payload) return null
        const data = payload.data

        return (
            <div className="space-y-4">
                <div className="grid gap-2">
                    <div className="p-3 border rounded bg-muted/20">
                        <span className="block text-xs font-bold text-muted-foreground uppercase">Domain</span>
                        <span className="font-mono">{data.domain}</span>
                    </div>
                    <div className="p-3 border rounded bg-muted/20">
                        <span className="block text-xs font-bold text-muted-foreground uppercase">Registrar</span>
                        <span>{data.registrar || "Unknown"}</span>
                    </div>
                    <div className="p-3 border rounded bg-muted/20">
                        <span className="block text-xs font-bold text-muted-foreground uppercase">Dates</span>
                        <div className="text-sm space-y-1 mt-1">
                            <div><span className="font-medium">Created:</span> {data.createdAt || "N/A"}</div>
                            <div><span className="font-medium">Updated:</span> {data.updatedAt || "N/A"}</div>
                            <div><span className="font-medium">Expires:</span> {data.expiresAt || "N/A"}</div>
                        </div>
                    </div>
                    <div className="p-3 border rounded bg-muted/20">
                        <span className="block text-xs font-bold text-muted-foreground uppercase">DNSSEC</span>
                        <span>{data.dnssec || "Unknown"}</span>
                    </div>
                </div>

                {Array.isArray(data.status) && data.status.length > 0 && (
                    <div className="p-3 border rounded bg-muted/20">
                        <h3 className="text-sm font-semibold mb-2">Status</h3>
                        <ul className="text-sm text-muted-foreground space-y-1">
                            {data.status.map((status: string, idx: number) => (
                                <li key={idx}>• {status}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {Array.isArray(data.nameservers) && data.nameservers.length > 0 && (
                    <div className="p-3 border rounded bg-muted/20">
                        <h3 className="text-sm font-semibold mb-2">Name Servers</h3>
                        <ul className="font-mono text-sm space-y-1">
                            {data.nameservers.map((ns: string) => (
                                <li key={ns}>{ns}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {showNotices && data.notices.length > 0 && (
                    <div className="p-3 border rounded bg-muted/20">
                        <h3 className="text-sm font-semibold mb-2">RDAP Notices</h3>
                        <ul className="text-xs text-muted-foreground space-y-1">
                            {data.notices.map((notice, index) => (
                                <li key={index}>• {notice}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        )
    }

    return (
        <ToolTemplate
            toolName="Whois Lookup"
            description="Query domain registration details via RDAP with enterprise-focused ownership and lifecycle risk scoring."
            actionLabel="Lookup"
            placeholder="example.com"
            onProcess={process}
            renderOutput={renderOutput}
            controls={
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                        <Label>Timeout (ms)</Label>
                        <Input
                            value={timeoutMs}
                            onChange={(event) => setTimeoutMs(event.target.value)}
                            placeholder="6000"
                        />
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
                        <Label htmlFor="whois-show-notices" className="text-sm">Show RDAP notices in output</Label>
                        <Switch
                            id="whois-show-notices"
                            checked={showNotices}
                            onChange={(event) => setShowNotices(event.target.checked)}
                        />
                    </div>
                </div>
            }
            examples={["example.com", "openai.com", "cloudflare.com"]}
        />
    )
}
