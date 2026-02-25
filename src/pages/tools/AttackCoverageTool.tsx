import { ToolTemplate } from "@/components/tools/ToolTemplate";
import {
  buildAttackCoverageHeatmap,
  type AttackCoverageResult,
} from "@/lib/utils/attack-coverage";

export default function AttackCoverageTool() {
  const process = (input: string) => JSON.stringify(buildAttackCoverageHeatmap(input));

  const renderOutput = (output: string) => {
    let parsed: AttackCoverageResult;
    try {
      parsed = JSON.parse(output) as AttackCoverageResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Rules</div>
            <div className="text-xl font-semibold">{parsed.totalRules}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Mapped</div>
            <div className="text-xl font-semibold">{parsed.mappedRules}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Coverage Score</div>
            <div className="text-xl font-semibold">{parsed.coverageScore}%</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">Top ATT&CK Tactics</div>
          {parsed.tactics.slice(0, 10).map((tactic) => (
            <div key={tactic.tactic} className="flex items-center justify-between p-2 border rounded bg-muted/20 text-sm">
              <span>{tactic.tactic}</span>
              <span>{tactic.count}</span>
            </div>
          ))}
        </div>

        {parsed.gaps.length > 0 && (
          <div className="p-3 border rounded bg-amber-500/10 border-amber-600/30">
            <div className="text-sm font-semibold mb-2">Coverage Gaps</div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {parsed.gaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="ATT&CK Coverage Heatmap"
      description="Compute tactic and technique coverage from rule metadata to identify detection blind spots."
      actionLabel="Build Coverage"
      placeholder={`[
  {
    "title": "Suspicious PowerShell",
    "tags": ["attack.execution", "attack.t1059.001"]
  }
]`}
      onProcess={process}
      renderOutput={renderOutput}
    />
  );
}
