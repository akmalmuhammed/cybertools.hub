import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { assessPorts, PortAssessment, PortAssessmentReport } from "@/lib/utils/port-intel"

export default function PortCheckerTool() {
    const process = async (input: string) => {
        const result = await assessPorts(input, { probeWebPorts: true })
        return JSON.stringify(result)
    }

    const renderOutput = (output: string) => {
        if (!output) return null

        let report: PortAssessmentReport
        try {
            report = JSON.parse(output)
        } catch {
            return null
        }

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
            description="Assess common ports and probe HTTP(S)-compatible ports from your browser (sends requests to target host)."
            actionLabel="Scan Ports"
            placeholder="example.com 80,443,8080"
            onProcess={process}
            renderOutput={renderOutput}
            examples={["example.com", "192.168.1.1", "localhost"]}
        />
    )
}
