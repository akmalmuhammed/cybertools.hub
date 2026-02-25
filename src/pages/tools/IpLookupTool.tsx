import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { IpLookupResult, lookupIpIntel } from "@/lib/utils/ip-intel"

export default function IpLookupTool() {
    const process = async (input: string) => {
        const data = await lookupIpIntel(input, true)
        return JSON.stringify(data)
    }

    const renderOutput = (output: string) => {
        if (!output) return null

        let data: IpLookupResult
        try {
            data = JSON.parse(output)
        } catch {
            return null
        }

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
            description="Analyze an IP (IPv4/IPv6), classify address type, and optionally query RDAP (external network request)."
            actionLabel="Lookup"
            placeholder="8.8.8.8 or 2001:4860:4860::8888"
            onProcess={process}
            renderOutput={renderOutput}
            examples={["8.8.8.8", "10.0.0.1", "2001:4860:4860::8888"]}
        />
    )
}
