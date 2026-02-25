import { ToolTemplate } from "@/components/tools/ToolTemplate";
import {
  simulateAlertDeduplication,
  type AlertDedupeResult,
} from "@/lib/utils/alert-dedupe";

export default function AlertDeduplicationTool() {
  const process = (input: string) => JSON.stringify(simulateAlertDeduplication(input));

  const renderOutput = (output: string) => {
    let parsed: AlertDedupeResult;
    try {
      parsed = JSON.parse(output) as AlertDedupeResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-4 gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Total</div>
            <div className="text-xl font-semibold">{parsed.totalAlerts}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Unique</div>
            <div className="text-xl font-semibold">{parsed.uniqueAlerts}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Reduced</div>
            <div className="text-xl font-semibold">{parsed.reducedCount}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Reduction</div>
            <div className="text-xl font-semibold">{parsed.reductionRate}%</div>
          </div>
        </div>

        <div className="space-y-2">
          {parsed.groups.slice(0, 20).map((group) => (
            <div key={group.fingerprint} className="p-3 border rounded bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold truncate">{group.sampleTitle}</div>
                <div className="text-xs px-2 py-1 rounded border">{group.count}x</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Entity: {group.sampleEntity} | Severity: {group.severity}
              </div>
              <div className="text-xs text-muted-foreground">
                {group.firstSeen ?? "-"} to {group.lastSeen ?? "-"}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="Alert Deduplication Simulator"
      description="Cluster repetitive alerts into deterministic buckets to estimate SOC false-positive reduction and triage savings."
      actionLabel="Simulate Deduplication"
      placeholder={'{"timestamp":"2026-02-25T01:00:00Z","ruleId":"win-powershell","entity":"host-01","title":"Suspicious PowerShell","severity":"high"}'}
      onProcess={process}
      renderOutput={renderOutput}
      examples={[
        '{"timestamp":"2026-02-25T01:00:00Z","ruleId":"win-powershell","entity":"host-01","title":"Suspicious PowerShell","severity":"high"}\n{"timestamp":"2026-02-25T01:04:00Z","ruleId":"win-powershell","entity":"host-01","title":"Suspicious PowerShell","severity":"high"}',
      ]}
    />
  );
}
