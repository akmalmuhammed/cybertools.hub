import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { assessPorts, type PortAssessment, type PortAssessmentReport } from "@/lib/utils/port-intel"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

export default function PortCheckerTool() {
    const [probeWebPorts, setProbeWebPorts] = useState(true)
    const [timeoutMs, setTimeoutMs] = useState("3500")

    const process = async (input: string) => {
        const report = await assessPorts(input, {
            probeWebPorts,
            timeoutMs: Number(timeoutMs) || 3500,
        })

        const findings: ToolFinding[] = []
        report.results.forEach((row) => {
            if (row.state === "reachable" && row.severity === "high") {
                findings.push({
                    id: `port-${row.port}-reachable-high`,
                    severity: "high",
                    confidence: 87,
                    category: "attack-surface",
                    title: `High-risk service reachable on ${row.port}/${row.service}`,
                    description: row.message,
                    remediation: row.recommendation,
                })
            } else if (row.state === "reachable" && row.severity === "medium") {
                findings.push({
                    id: `port-${row.port}-reachable-medium`,
                    severity: "medium",
                    confidence: 78,
                    category: "attack-surface",
                    title: `Medium-risk service reachable on ${row.port}/${row.service}`,
                    description: row.message,
                    remediation: row.recommendation,
                })
            } else if (row.state === "timeout") {
                findings.push({
                    id: `port-${row.port}-timeout`,
                    severity: "low",
                    confidence: 63,
                    category: "visibility-gap",
                    title: `Reachability unknown (timeout) on ${row.port}`,
                    description: row.message,
                    remediation: "Retry from controlled network vantage points and validate firewall telemetry.",
                })
            }
        })

        if (!probeWebPorts) {
            findings.push({
                id: "port-probe-disabled",
                severity: "info",
                confidence: 70,
                category: "workflow-mode",
                title: "Active web probing disabled",
                description: "Results are intelligence-only without active reachability checks.",
                remediation: "Enable probing when authorized and when outbound checks are expected.",
            })
        }

        const summary = createSummaryFromFindings({
            title: "Port assessment completed",
            text: `Assessed ${report.ports.length} port(s) for host ${report.host}.`,
            findings,
            metrics: {
                totalPorts: report.ports.length,
                reachable: report.results.filter((row) => row.state === "reachable").length,
                highSeverityPorts: report.results.filter((row) => row.severity === "high").length,
                unsupportedChecks: report.results.filter((row) => row.state === "not_supported").length,
            },
            baseScore: 92,
        })

        return JSON.stringify(
            buildToolResultEnvelope({
                toolName: "Port Checker",
                summary,
                findings,
                evidence: report.results.map((row) => ({
                    host: report.host,
                    ...row,
                })),
                recommendations: [
                    "Restrict high-risk services (SMB/RDP/DB) from public exposure unless explicitly required.",
                    "Validate browser-based probe results with server-side scanners and firewall logs.",
                    "Track exposure drift across recurring scans to catch newly reachable ports.",
                ],
                raw: { portReport: report },
            }),
        )
    }

    const renderOutput = (output: string) => {
        if (!output) return null
        const envelope = parseToolResultEnvelope(output, "Port Checker")
        const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
            ? (envelope.raw as Record<string, unknown>)
            : null
        const report = raw?.portReport as PortAssessmentReport | undefined
        if (!report) return null

        return (
            <div className="space-y-4">
                <div className="p-3 border rounded bg-muted/20">
                    <span className="block text-xs font-bold text-muted-foreground uppercase">Host</span>
                    <span className="font-mono">{report.host}</span>
                </div>

                <div className="overflow-x-auto border rounded-md">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-muted-foreground">
                            <tr>
                                <th className="text-left p-2">Port</th>
                                <th className="text-left p-2">Service</th>
                                <th className="text-left p-2">State</th>
                                <th className="text-left p-2">Severity</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(report.results || []).map((row: PortAssessment) => (
                                <tr key={row.port} className="border-t">
                                    <td className="p-2 font-mono">{row.port}</td>
                                    <td className="p-2">{row.service}</td>
                                    <td className="p-2">{row.state}</td>
                                    <td className="p-2">{row.severity}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="space-y-2">
                    {(report.results || []).map((row: PortAssessment) => (
                        <div key={`rec-${row.port}`} className="p-3 border rounded bg-muted/20">
                            <div className="font-medium">
                                {row.port}/{row.service} - {row.state}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{row.message}</p>
                            <p className="text-sm mt-1">{row.recommendation}</p>
                        </div>
                    ))}
                </div>

                {Array.isArray(report.notes) && report.notes.length > 0 && (
                    <div className="p-3 border rounded bg-muted/20">
                        <h3 className="text-sm font-semibold mb-2">Limitations</h3>
                        <ul className="text-sm text-muted-foreground space-y-1">
                            {report.notes.map((note: string, idx: number) => (
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
            toolName="Port Checker"
            description="Assess exposure for common ports with controlled browser-compatible probing and enterprise triage findings."
            actionLabel="Scan Ports"
            placeholder="example.com 80,443,8080"
            onProcess={process}
            renderOutput={renderOutput}
            controls={
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
                        <Label htmlFor="port-probe-web" className="text-sm">Probe HTTP(S)-compatible ports</Label>
                        <Switch
                            id="port-probe-web"
                            checked={probeWebPorts}
                            onChange={(event) => setProbeWebPorts(event.target.checked)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>Probe timeout (ms)</Label>
                        <Input
                            value={timeoutMs}
                            onChange={(event) => setTimeoutMs(event.target.value)}
                            placeholder="3500"
                        />
                    </div>
                </div>
            }
            examples={["example.com", "192.168.1.1", "localhost", "api.example.com 443,8443"]}
        />
    )
}
