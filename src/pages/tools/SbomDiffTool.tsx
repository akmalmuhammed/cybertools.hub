import { useState } from "react";
import { ToolTemplate } from "@/components/tools/ToolTemplate";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  diffSboms,
  type SbomDiffResult,
} from "@/lib/utils/sbom-diff";

function riskColor(risk: string): string {
  if (risk === "critical") return "text-red-700 dark:text-red-400";
  if (risk === "high") return "text-red-600 dark:text-red-300";
  if (risk === "medium") return "text-amber-600 dark:text-amber-400";
  return "text-green-600 dark:text-green-400";
}

export default function SbomDiffTool() {
  const [sbomAfterInput, setSbomAfterInput] = useState("");
  const [vulnerabilityInput, setVulnerabilityInput] = useState("");

  const process = (beforeInput: string) =>
    JSON.stringify(diffSboms(beforeInput, sbomAfterInput, vulnerabilityInput));

  const renderOutput = (output: string) => {
    if (!output) return null;
    let parsed: SbomDiffResult;
    try {
      parsed = JSON.parse(output) as SbomDiffResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-5 gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase font-bold text-muted-foreground">Total</div>
            <div className="text-xl font-semibold">{parsed.summary.total}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase font-bold text-muted-foreground">Added</div>
            <div className="text-xl font-semibold text-blue-600 dark:text-blue-400">{parsed.summary.added}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase font-bold text-muted-foreground">Removed</div>
            <div className="text-xl font-semibold text-slate-600 dark:text-slate-300">{parsed.summary.removed}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase font-bold text-muted-foreground">Upgraded</div>
            <div className="text-xl font-semibold text-green-600 dark:text-green-400">{parsed.summary.upgraded}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase font-bold text-muted-foreground">Downgraded</div>
            <div className="text-xl font-semibold text-red-600 dark:text-red-400">{parsed.summary.downgraded}</div>
          </div>
        </div>

        <div className="space-y-2">
          {parsed.items.map((item) => (
            <div key={`${item.component}:${item.change}:${item.beforeVersion ?? ""}:${item.afterVersion ?? ""}`} className="p-3 border rounded bg-muted/20 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{item.component}</div>
                <div className={`font-semibold uppercase ${riskColor(item.risk)}`}>{item.risk}</div>
              </div>
              <div className="text-xs text-muted-foreground">
                Change: {item.change} | {item.beforeVersion ?? "-"} → {item.afterVersion ?? "-"}
              </div>
              <div className="text-xs text-muted-foreground">
                Vulnerabilities: {item.vulnerabilities.length > 0 ? item.vulnerabilities.map((vuln) => `${vuln.cve} (${vuln.severity})`).join(", ") : "none"}
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                {item.reasons.map((reason, index) => (
                  <li key={index}>• {reason}</li>
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
      toolName="SBOM Diff & Risk Triage"
      description="Compare CycloneDX/SPDX SBOMs and prioritize changed components with vulnerability-aware triage."
      actionLabel="Diff SBOMs"
      placeholder='{"bomFormat":"CycloneDX","components":[{"name":"openssl","version":"3.0.12"}]}'
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Target SBOM (after)</Label>
            <Textarea
              value={sbomAfterInput}
              onChange={(event) => setSbomAfterInput(event.target.value)}
              placeholder='{"bomFormat":"CycloneDX","components":[{"name":"openssl","version":"3.0.13"}]}'
              className="min-h-[140px] font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label>Vulnerability hints (optional: component,cve,severity)</Label>
            <Textarea
              value={vulnerabilityInput}
              onChange={(event) => setVulnerabilityInput(event.target.value)}
              placeholder="openssl,CVE-2024-5535,high"
              className="min-h-[100px] font-mono text-xs"
            />
          </div>
        </div>
      }
      examples={[
        '{"bomFormat":"CycloneDX","components":[{"name":"openssl","version":"3.0.12"},{"name":"curl","version":"8.5.0"}]}',
      ]}
    />
  );
}
