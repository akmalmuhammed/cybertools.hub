import { useState } from "react";
import { ToolTemplate } from "@/components/tools/ToolTemplate";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  correlateIocSources,
  type IocCorrelationResult,
} from "@/lib/utils/ioc-correlator";

export default function IocCorrelatorTool() {
  const [sourceB, setSourceB] = useState("");
  const [includePrivateIps, setIncludePrivateIps] = useState(false);

  const process = (sourceA: string) =>
    JSON.stringify(
      correlateIocSources(sourceA, sourceB, {
        includePrivateIps,
      }),
    );

  const renderOutput = (output: string) => {
    if (!output) return null;
    let parsed: IocCorrelationResult;
    try {
      parsed = JSON.parse(output) as IocCorrelationResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold text-muted-foreground uppercase">Shared</div>
            <div className="text-xl font-semibold">{parsed.summary.shared}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold text-muted-foreground uppercase">Only Source A</div>
            <div className="text-xl font-semibold">{parsed.summary.uniqueSourceA}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold text-muted-foreground uppercase">Only Source B</div>
            <div className="text-xl font-semibold">{parsed.summary.uniqueSourceB}</div>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          Overlap: {parsed.summary.overlapPercent}% (A={parsed.summary.totalSourceA}, B={parsed.summary.totalSourceB})
        </div>

        <div className="space-y-2">
          {parsed.byType
            .filter(
              (bucket) =>
                bucket.shared.length > 0 ||
                bucket.onlySourceA.length > 0 ||
                bucket.onlySourceB.length > 0,
            )
            .map((bucket) => (
              <div key={bucket.type} className="p-3 border rounded bg-muted/20 space-y-2">
                <h3 className="text-sm font-semibold uppercase">{bucket.type}</h3>
                {bucket.shared.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-green-600 dark:text-green-400">Shared</div>
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">{bucket.shared.join("\n")}</pre>
                  </div>
                )}
                {bucket.onlySourceA.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">Only A</div>
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">{bucket.onlySourceA.join("\n")}</pre>
                  </div>
                )}
                {bucket.onlySourceB.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">Only B</div>
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">{bucket.onlySourceB.join("\n")}</pre>
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="IOC Correlator"
      description="Compare two IOC datasets, identify overlap, and surface indicators unique to each source."
      actionLabel="Correlate"
      placeholder="Paste source A indicators, logs, or notes..."
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Source B</Label>
            <Textarea
              value={sourceB}
              onChange={(event) => setSourceB(event.target.value)}
              placeholder="Paste source B indicators..."
              className="min-h-[140px] font-mono text-sm"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="ioc-correlator-private">Include private/reserved IPs</Label>
            <Switch
              id="ioc-correlator-private"
              checked={includePrivateIps}
              onChange={(event) => setIncludePrivateIps(event.target.checked)}
            />
          </div>
        </div>
      }
      examples={[
        "https://a.example.com\n8.8.8.8\nCVE-2024-1111",
        "https://a.example.com\n1.1.1.1\nCVE-2024-1111",
      ]}
    />
  );
}
