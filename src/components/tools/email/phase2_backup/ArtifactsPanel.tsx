import { Copy, ShieldAlert, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Artifact {
    type: string;
    value: string;
    label?: string;
}

interface ArtifactsPanelProps {
    artifacts: Artifact[];
}

export function ArtifactsPanel({ artifacts }: ArtifactsPanelProps) {
    if (artifacts.length === 0) return null;

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    }

    const getThreatLinks = (type: string, value: string) => {
        const links = [];
        if (type === 'ip') {
            links.push({
                title: 'VirusTotal Lookup',
                url: `https://www.virustotal.com/gui/ip-address/${value}`,
                icon: ShieldAlert,
                color: 'text-red-500 hover:text-red-600'
            });
            links.push({
                title: 'IP Geolocation',
                url: `https://ipinfo.io/${value}`,
                icon: Globe,
                color: 'text-blue-500 hover:text-blue-600'
            });

        }
        // Extract domain from email for VT lookup
        if (type === 'email') {
            const domain = value.split('@')[1];
            if (domain) {
                links.push({
                    title: 'VirusTotal Domain',
                    url: `https://www.virustotal.com/gui/domain/${domain}`,
                    icon: ShieldAlert,
                    color: 'text-orange-500 hover:text-orange-600'
                });
            }
        }
        return links;
    }

    // Group by type
    const grouped: Record<string, Artifact[]> = {};
    artifacts.forEach(a => {
        if (!grouped[a.type]) grouped[a.type] = [];
        grouped[a.type].push(a);
    });

    return (
        <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
                Extracted Artifacts
                <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {artifacts.length}
                </span>
            </h3>

            <div className="grid grid-cols-1 gap-4">
                {Object.entries(grouped).map(([type, items]) => (
                    <div key={type} className="border rounded-md p-3 bg-muted/20">
                        <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3">{type}s</h4>
                        <div className="space-y-2">
                            {items.map((item, idx) => {
                                const links = getThreatLinks(item.type, item.value);
                                return (
                                    <div key={idx} className="flex items-center justify-between text-sm bg-background p-2 rounded border group">
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-mono break-all" title={item.value}>{item.value}</span>
                                            {item.label && <span className="text-[10px] text-muted-foreground truncate">{item.label}</span>}
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {links.map((link, i) => (
                                                <Button
                                                    key={i}
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    title={link.title}
                                                    onClick={() => window.open(link.url, '_blank')}
                                                >
                                                    <link.icon className={`h-3 w-3 ${link.color}`} />
                                                </Button>
                                            ))}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                title="Copy"
                                                onClick={() => copyToClipboard(item.value)}
                                            >
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
