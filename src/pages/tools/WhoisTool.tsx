import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { lookupWhois, WhoisLookupResult } from "@/lib/utils/whois"

export default function WhoisTool() {
    const process = async (input: string) => {
        const result = await lookupWhois(input)
        return JSON.stringify(result)
    }

    const renderOutput = (output: string) => {
        if (!output) return null

        let parsed: WhoisLookupResult
        try {
            parsed = JSON.parse(output)
        } catch {
            return null
        }

        const data = parsed.data

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
            </div>
        )
    }

    return (
        <ToolTemplate
            toolName="Whois Lookup"
            description="Query domain registration details via RDAP. Input domains are sent to external RDAP services."
            actionLabel="Lookup"
            placeholder="example.com"
            onProcess={process}
            renderOutput={renderOutput}
            examples={["example.com", "openai.com", "cloudflare.com"]}
        />
    )
}
