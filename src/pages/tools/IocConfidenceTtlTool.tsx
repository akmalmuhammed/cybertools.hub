import { ToolTemplate } from "@/components/tools/ToolTemplate";
import {
  scoreIocConfidenceAndTtl,
  type IocConfidenceResult,
} from "@/lib/utils/ioc-confidence";

export default function IocConfidenceTtlTool() {
  const process = (input: string) => JSON.stringify(scoreIocConfidenceAndTtl(input));

  const renderOutput = (output: string) => {
    let parsed: IocConfidenceResult;
    try {
      parsed = JSON.parse(output) as IocConfidenceResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-4 gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Total</div>
            <div className="text-xl font-semibold">{parsed.summary.total}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">High</div>
            <div className="text-xl font-semibold">{parsed.summary.high}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Medium</div>
            <div className="text-xl font-semibold">{parsed.summary.medium}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Low</div>
            <div className="text-xl font-semibold">{parsed.summary.low}</div>
          </div>
        </div>

        <div className="space-y-2">
          {parsed.items.map((item) => (
            <div key={`${item.indicator}:${item.source}`} className="p-3 border rounded bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold truncate">{item.indicator}</div>
                <div className="text-sm">{item.confidence}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Type: {item.type} | Source: {item.source} | TTL: {item.ttlDays}d | Expires: {item.expiresAt}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="IOC Confidence + TTL Scorer"
      description="Apply deterministic confidence scoring and TTL decay windows to improve IOC feed quality and SOC actionability."
      actionLabel="Score IOCs"
      placeholder="malicious.example,domain,misp,2026-02-24T10:30:00Z,4"
      onProcess={process}
      renderOutput={renderOutput}
      examples={["malicious.example,domain,misp,2026-02-24T10:30:00Z,4\n8.8.8.8,ipv4,osint,2026-02-10T00:00:00Z,1"]}
    />
  );
}
