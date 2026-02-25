import { useMemo, useState } from "react";
import { ToolTemplate } from "@/components/tools/ToolTemplate";
import {
  runDnsToolkit,
  type DnsRecordType,
  type DnsToolkitResult,
} from "@/lib/utils/dns-toolkit";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const AVAILABLE_TYPES: DnsRecordType[] = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "CAA"];

export default function DnsToolkitTool() {
  const [selectedTypes, setSelectedTypes] = useState<Record<DnsRecordType, boolean>>({
    A: true,
    AAAA: true,
    CNAME: true,
    MX: true,
    TXT: true,
    NS: true,
    SOA: false,
    CAA: false,
  });
  const [timeoutMs, setTimeoutMs] = useState("6000");

  const enabledTypes = useMemo(
    () => AVAILABLE_TYPES.filter((type) => selectedTypes[type]),
    [selectedTypes],
  );

  const process = async (input: string) => {
    if (enabledTypes.length === 0) throw new Error("Select at least one DNS record type.");
    const result = await runDnsToolkit(input, enabledTypes, {
      timeoutMs: Number(timeoutMs) || 6000,
    });
    return JSON.stringify(result);
  };

  const renderOutput = (output: string) => {
    if (!output) return null;
    let parsed: DnsToolkitResult;
    try {
      parsed = JSON.parse(output) as DnsToolkitResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="p-3 border rounded bg-muted/20">
          <div className="text-xs font-bold text-muted-foreground uppercase">Domain</div>
          <div className="font-mono">{parsed.domain}</div>
        </div>

        {parsed.spf && (
          <div className="p-3 border rounded bg-muted/20 space-y-1">
            <h3 className="text-sm font-semibold">SPF</h3>
            <p className="text-xs font-mono break-all">{parsed.spf.record}</p>
            <p className="text-xs text-muted-foreground">
              HardFail: {parsed.spf.hasHardFail ? "Yes" : "No"} | SoftFail: {parsed.spf.hasSoftFail ? "Yes" : "No"}
            </p>
          </div>
        )}

        {parsed.dmarc && (
          <div className="p-3 border rounded bg-muted/20 space-y-1">
            <h3 className="text-sm font-semibold">DMARC</h3>
            <p className="text-xs font-mono break-all">{parsed.dmarc.record}</p>
            <p className="text-xs text-muted-foreground">
              Policy: {parsed.dmarc.policy ?? "N/A"} | Subdomain: {parsed.dmarc.subdomainPolicy ?? "N/A"} | Pct: {parsed.dmarc.pct ?? "N/A"}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Record Answers</h3>
          {parsed.queries.map((query) => (
            <div key={query.recordType} className="p-3 border rounded bg-muted/20">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{query.recordType}</span>
                <span className="text-xs text-muted-foreground uppercase">{query.status}</span>
              </div>
              {query.answers.length === 0 ? (
                <p className="text-xs text-muted-foreground">{query.error ?? "No answers."}</p>
              ) : (
                <ul className="text-xs space-y-1 font-mono">
                  {query.answers.map((answer, index) => (
                    <li key={`${query.recordType}-${index}`} className="break-all">
                      {answer.data} <span className="text-muted-foreground">(TTL {answer.ttl})</span>
                    </li>
                  ))}
                </ul>
              )}
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
      toolName="DNS Toolkit"
      description="Query DNS-over-HTTPS records (A/AAAA/CNAME/MX/TXT/NS/SOA/CAA) and parse SPF + DMARC posture."
      actionLabel="Resolve DNS"
      placeholder="example.com"
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Record Types</Label>
            <div className="grid grid-cols-4 gap-2 text-sm">
              {AVAILABLE_TYPES.map((type) => (
                <label key={type} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedTypes[type]}
                    onChange={(event) =>
                      setSelectedTypes((previous) => ({ ...previous, [type]: event.target.checked }))
                    }
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
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
      examples={["example.com", "openai.com", "cloudflare.com"]}
    />
  );
}
