import { useState } from "react";
import { ToolTemplate, type ToolProcessContext } from "@/components/tools/ToolTemplate";
import {
  enrichBulkReputation,
  type BulkReputationResult,
  type ReputationProvider,
} from "@/lib/utils/reputation";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

function riskColor(level: "low" | "medium" | "high"): string {
  if (level === "high") return "text-red-600 dark:text-red-400";
  if (level === "medium") return "text-amber-600 dark:text-amber-400";
  return "text-green-600 dark:text-green-400";
}

export default function ReputationEnricherTool() {
  const [provider, setProvider] = useState<ReputationProvider>("none");
  const [providerProxyUrl, setProviderProxyUrl] = useState("");
  const [includeRdap, setIncludeRdap] = useState(true);
  const [timeoutMs, setTimeoutMs] = useState("8000");

  const handleProviderChange = (value: string) => {
    if (value === "none" || value === "abuseipdb" || value === "virustotal") {
      setProvider(value);
    }
  };

  const process = async (input: string, context: ToolProcessContext) => {
    const effectiveProvider = context.localOnly ? "none" : provider;

    const result = await enrichBulkReputation(input, {
      provider: effectiveProvider,
      providerProxyUrl: providerProxyUrl.trim() || undefined,
      includeRdap,
      timeoutMs: Number(timeoutMs) || 8000,
    });
    if (context.localOnly && provider !== "none") {
      result.notes.push("Local-only run mode forced provider=none to prevent outbound enrichment calls.");
    }
    return JSON.stringify(result);
  };

  const renderOutput = (output: string) => {
    if (!output) return null;
    let parsed: BulkReputationResult;
    try {
      parsed = JSON.parse(output) as BulkReputationResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-4 gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold text-muted-foreground uppercase">Total</div>
            <div className="text-xl font-semibold">{parsed.summary.total}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold text-muted-foreground uppercase">High</div>
            <div className="text-xl font-semibold text-red-600 dark:text-red-400">{parsed.summary.high}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold text-muted-foreground uppercase">Medium</div>
            <div className="text-xl font-semibold text-amber-600 dark:text-amber-400">{parsed.summary.medium}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold text-muted-foreground uppercase">Low</div>
            <div className="text-xl font-semibold text-green-600 dark:text-green-400">{parsed.summary.low}</div>
          </div>
        </div>

        <div className="space-y-2">
          {parsed.items.map((item) => (
            <div
              key={`${item.indicator.type}-${item.indicator.value}`}
              className="p-3 border rounded bg-muted/20 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-sm break-all">
                  {item.indicator.value} <span className="text-xs text-muted-foreground">({item.indicator.type})</span>
                </div>
                <div className={`font-semibold uppercase ${riskColor(item.riskLevel)}`}>
                  {item.riskLevel} ({item.riskScore})
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Sources: {item.sources.join(", ")}
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                {item.details.map((detail, index) => (
                  <li key={index}>• {detail}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {parsed.notes.length > 0 && (
          <div className="p-3 border rounded bg-muted/20">
            <h3 className="text-sm font-semibold mb-2">Notes</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              {parsed.notes.map((note, index) => (
                <li key={index}>• {note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="Bulk Domain/IP Reputation Enricher"
      description="Enrich domain/IP indicators in bulk with local scoring, RDAP metadata, and optional provider signals via your own proxy endpoint."
      actionLabel="Enrich Indicators"
      placeholder="Paste domains and IPs (one per line or mixed text)..."
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Provider</Label>
            <Tabs value={provider} onValueChange={handleProviderChange} className="w-full">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="none">Local/RDAP</TabsTrigger>
                <TabsTrigger value="abuseipdb">AbuseIPDB</TabsTrigger>
                <TabsTrigger value="virustotal">VirusTotal</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {provider !== "none" && (
            <div className="space-y-1">
              <Label>Provider Proxy URL</Label>
              <Input
                value={providerProxyUrl}
                onChange={(event) => setProviderProxyUrl(event.target.value)}
                placeholder="https://your-proxy.example/reputation"
              />
              <p className="text-xs text-muted-foreground">
                Use your backend proxy. Direct provider API-key calls are intentionally disabled client-side.
              </p>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="reputation-rdap">Include RDAP enrichment</Label>
              <Switch
                id="reputation-rdap"
                checked={includeRdap}
                onChange={(event) => setIncludeRdap(event.target.checked)}
              />
            </div>
            <div className="space-y-1">
              <Label>Timeout (ms)</Label>
              <Input
                value={timeoutMs}
                onChange={(event) => setTimeoutMs(event.target.value)}
                placeholder="8000"
              />
            </div>
          </div>
        </div>
      }
      examples={[
        "8.8.8.8\n1.1.1.1\nexample.com\nlogin.example.org",
        "Observed indicators: 203.0.113.10, api.example.com, malware.test",
      ]}
    />
  );
}
