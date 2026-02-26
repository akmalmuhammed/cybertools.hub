import { useState } from "react";
import { ToolTemplate } from "@/components/tools/ToolTemplate";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
  const [profile, setProfile] = useState<"strict" | "balanced" | "pattern-only">("balanced");
  const [suppressionInput, setSuppressionInput] = useState("");

  const process = (input: string) => {
    const entropyThreshold = profile === "strict" ? 3.8 : 4.2;
    const entropyEnabled = profile === "pattern-only" ? false : enableEntropyScan;
    const result = scanSecrets(input, {
      enableEntropyScan: entropyEnabled,
      entropyThreshold,
    });

    const suppressions = suppressionInput
      .split(/\r?\n/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    if (suppressions.length > 0) {
      result.findings = result.findings.filter((finding) => {
        const type = finding.type.toLowerCase();
        return !suppressions.some((entry) => type.includes(entry));
      });
      result.summary = {
        total: result.findings.length,
        critical: result.findings.filter((finding) => finding.severity === "critical").length,
        high: result.findings.filter((finding) => finding.severity === "high").length,
        medium: result.findings.filter((finding) => finding.severity === "medium").length,
        low: result.findings.filter((finding) => finding.severity === "low").length,
      };
      result.notes.push(`Suppression rules applied: ${suppressions.length}.`);
    }

    result.notes.push(`Detector profile: ${profile}.`);
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
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Detector Profile</Label>
            <Tabs
              value={profile}
              onValueChange={(value) => {
                if (value === "strict" || value === "balanced" || value === "pattern-only") {
                  setProfile(value);
                }
              }}
              className="w-full"
            >
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="strict">Strict</TabsTrigger>
                <TabsTrigger value="balanced">Balanced</TabsTrigger>
                <TabsTrigger value="pattern-only">Pattern Only</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="secrets-entropy">Enable entropy-based token detection</Label>
            <Switch
              id="secrets-entropy"
              checked={enableEntropyScan}
              onChange={(event) => setEnableEntropyScan(event.target.checked)}
              disabled={profile === "pattern-only"}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="secrets-suppressions">Suppression Rules (finding types, one per line)</Label>
            <Textarea
              id="secrets-suppressions"
              value={suppressionInput}
              onChange={(event) => setSuppressionInput(event.target.value)}
              className="min-h-[90px] text-xs font-mono"
              placeholder={"high-entropy token\njwt"}
            />
          </div>
        </div>
      }
      examples={[
        "AKIA_EXAMPLE_PLACEHOLDER\nDatabase password is in vault.",
        "ghp_example_token_placeholder\nBearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def",
      ]}
    />
  );
}
