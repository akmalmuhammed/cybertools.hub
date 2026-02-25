import { useState } from "react";
import { ToolTemplate } from "@/components/tools/ToolTemplate";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  diffLockfileRisk,
  type LockfileRiskDiffResult,
} from "@/lib/utils/lockfile-risk-diff";

export default function LockfileRiskDiffTool() {
  const [afterInput, setAfterInput] = useState("");
  const [namespaces, setNamespaces] = useState("@acme,@corp");

  const process = (beforeInput: string) =>
    JSON.stringify(diffLockfileRisk(beforeInput, afterInput, namespaces));

  const renderOutput = (output: string) => {
    let parsed: LockfileRiskDiffResult;
    try {
      parsed = JSON.parse(output) as LockfileRiskDiffResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-4 gap-2">
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">Total</div><div className="text-xl font-semibold">{parsed.summary.total}</div></div>
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">Added</div><div className="text-xl font-semibold">{parsed.summary.added}</div></div>
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">Updated</div><div className="text-xl font-semibold">{parsed.summary.updated}</div></div>
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">High Risk</div><div className="text-xl font-semibold">{parsed.summary.high}</div></div>
        </div>

        <div className="space-y-2">
          {parsed.items.map((item) => (
            <div key={`${item.package}:${item.change}`} className="p-3 border rounded bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{item.package}</div>
                <div className="text-xs uppercase">{item.change} · {item.risk}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {item.beforeVersion ?? "-"} → {item.afterVersion ?? "-"}
              </div>
              <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                {item.reasons.map((reason, index) => (
                  <li key={`${item.package}:${index}`}>{reason}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="Lockfile Risk Diff + Dependency Confusion Heuristics"
      description="Diff dependency lock states and prioritize suspicious package-introduction risk."
      actionLabel="Diff Lockfiles"
      placeholder='{"dependencies":{"left-pad":{"version":"1.1.0"}}}'
      onProcess={process}
      renderOutput={renderOutput}
      controls={(
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>After lockfile input</Label>
            <Textarea
              value={afterInput}
              onChange={(event) => setAfterInput(event.target.value)}
              placeholder='{"dependencies":{"left-pad":{"version":"1.2.0"},"acme-utils":{"version":"1.0.0"}}}'
              className="min-h-[140px] font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label>Internal namespace hints (comma-separated)</Label>
            <Input
              value={namespaces}
              onChange={(event) => setNamespaces(event.target.value)}
              placeholder="@acme,@corp"
            />
          </div>
        </div>
      )}
    />
  );
}
