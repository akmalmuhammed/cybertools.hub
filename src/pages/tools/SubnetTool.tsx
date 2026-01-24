import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { calculateSubnet } from "@/lib/utils/network"
import { CopyButton } from "@/components/features/CopyButton"

export default function SubnetTool() {
    const process = (input: string) => {
        const parts = input.split('/');
        const ip = parts[0].trim();
        let cidr = parts.length > 1 ? parseInt(parts[1]) : 24; // Default to /24 if not specified

        if (isNaN(cidr)) cidr = 24

        const info = calculateSubnet(ip, cidr)
        return JSON.stringify(info)
    }

    const renderOutput = (output: string) => {
        if (!output) return null
        let info
        try {
            info = JSON.parse(output)
        } catch {
            return null
        }

        const rows = [
            { label: "IP Address", value: info.ip },
            { label: "Network Address", value: info.networkAddress },
            { label: "Usable Host Range", value: `${info.firstHost} - ${info.lastHost}` },
            { label: "Broadcast Address", value: info.broadcastAddress },
            { label: "Total Hosts", value: info.totalHosts.toLocaleString() },
            { label: "Usable Hosts", value: info.usableHosts.toLocaleString() },
            { label: "Subnet Mask", value: info.netmask },
            { label: "CIDR Notation", value: `/${info.cidr}` },
        ]

        return (
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {rows.map((row) => (
                        <div key={row.label} className="p-4 rounded-lg bg-muted/50 border border-border">
                            <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">{row.label}</div>
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-sm">{row.value}</span>
                                <CopyButton text={row.value.toString()} className="h-6 w-6" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <ToolTemplate
            toolName="Subnet Calculator"
            description="Calculate subnet range, broadcast address, and host information."
            actionLabel="Calculate"
            onProcess={process}
            renderOutput={renderOutput}
            placeholder="192.168.1.1/24"
            examples={[
                "192.168.0.1/24",
                "10.0.0.0/8",
                "172.16.0.1/16"
            ]}
        />
    )
}
