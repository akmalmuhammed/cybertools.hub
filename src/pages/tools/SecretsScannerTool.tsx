import { useState } from "react";
import { ToolTemplate } from "@/components/tools/ToolTemplate";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  scanSecrets,
  type SecretScanResult,
} from "@/lib/utils/secret-scanner";

function severityColor(severity: string): string {
  if (severity === "critical") return "text-red-700 dark:text-red-400";
  if (severity === "high") return "text-red-600 dark:text-red-300";
  if (severity === "medium") return "text-amber-600 dark:text-amber-400";
  return "text-green-600 dark:text-green-400";
}

export default function SecretsScannerTool() {
  const [enableEntropyScan, setEnableEntropyScan] = useState(true);

  const process = (input: string) => {
    const result = scanSecrets(input, {
      enableEntropyScan,
    });
    return JSON.stringify(result);
  };

  const renderOutput = (output: string) => {
    if (!output) return null;
    let parsed: SecretScanResult;
    try {
      parsed = JSON.parse(output) as SecretScanResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-5 gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold text-muted-foreground uppercase">Total</div>
            <div className="text-xl font-semibold">{parsed.summary.total}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold text-muted-foreground uppercase">Critical</div>
            <div className="text-xl font-semibold text-red-700 dark:text-red-400">{parsed.summary.critical}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold text-muted-foreground uppercase">High</div>
            <div className="text-xl font-semibold text-red-600 dark:text-red-300">{parsed.summary.high}</div>
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
          {parsed.findings.map((finding, index) => (
            <div key={`${finding.type}-${finding.start}-${index}`} className="p-3 border rounded bg-muted/20 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{finding.type}</div>
                <div className={`font-semibold uppercase ${severityColor(finding.severity)}`}>
                  {finding.severity}
                </div>
              </div>
              <div className="text-xs font-mono break-all">{finding.maskedValue}</div>
              <div className="text-xs text-muted-foreground">
                Confidence: {finding.confidence} | Offset: {finding.start}-{finding.end}
              </div>
              <div className="text-xs text-muted-foreground">{finding.recommendation}</div>
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
      toolName="Secrets Scanner"
      description="Client-side scanner for exposed credentials, tokens, key blocks, and high-entropy secrets."
      actionLabel="Scan for Secrets"
      placeholder="Paste logs, configs, source snippets, or chat transcripts..."
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="secrets-entropy">Enable entropy-based token detection</Label>
          <Switch
            id="secrets-entropy"
            checked={enableEntropyScan}
            onChange={(event) => setEnableEntropyScan(event.target.checked)}
          />
        </div>
      }
      examples={[
        "AKIA_EXAMPLE_PLACEHOLDER\nDatabase password is in vault.",
        "ghp_example_token_placeholder\nBearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def",
      ]}
    />
  );
}
