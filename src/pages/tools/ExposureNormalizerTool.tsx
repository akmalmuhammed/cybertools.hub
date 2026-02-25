import { ToolTemplate } from "@/components/tools/ToolTemplate";
import {
  normalizeExposureImports,
  type ExposureNormalizationResult,
} from "@/lib/utils/exposure-normalizer";

export default function ExposureNormalizerTool() {
  const process = (input: string) => JSON.stringify(normalizeExposureImports(input));

  const renderOutput = (output: string) => {
    let parsed: ExposureNormalizationResult;
    try {
      parsed = JSON.parse(output) as ExposureNormalizationResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-5 gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-xl font-semibold">{parsed.summary.total}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs text-muted-foreground">Hosts</div>
            <div className="text-xl font-semibold">{parsed.summary.hosts}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs text-muted-foreground">Open</div>
            <div className="text-xl font-semibold">{parsed.summary.open}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs text-muted-foreground">Filtered</div>
            <div className="text-xl font-semibold">{parsed.summary.filtered}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs text-muted-foreground">Closed</div>
            <div className="text-xl font-semibold">{parsed.summary.closed}</div>
          </div>
        </div>

        <div className="space-y-2">
          {parsed.records.slice(0, 30).map((record) => (
            <div key={`${record.host}:${record.port}:${record.protocol}:${record.source}`} className="p-3 border rounded bg-muted/20 text-xs">
              {record.host}:{record.port}/{record.protocol} | {record.service} | {record.status} | {record.source}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="External Exposure Import Normalizer"
      description="Normalize Nmap/Masscan/Shodan results into a single comparable exposure inventory."
      actionLabel="Normalize Exposure Data"
      placeholder="host,port,protocol,service,status,source\n192.168.1.10,22,tcp,ssh,open,nmap"
      onProcess={process}
      renderOutput={renderOutput}
      examples={["Host: 192.168.1.10 ()  Ports: 22/open/tcp//ssh///, 443/open/tcp//https///"]}
    />
  );
}
