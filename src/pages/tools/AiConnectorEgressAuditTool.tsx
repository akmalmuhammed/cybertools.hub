import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToolTemplate } from "@/components/tools/ToolTemplate";
import { auditAiConnectorEgress, type AiEgressAuditResult } from "@/lib/utils/ai-egress-audit";

function severityColor(severity: string): string {
  if (severity === "critical") return "text-red-700 dark:text-red-400";
  if (severity === "high") return "text-red-600 dark:text-red-300";
  if (severity === "medium") return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}

export default function AiConnectorEgressAuditTool() {
  const [allowedDomainsInput, setAllowedDomainsInput] = useState("");
  const [strictMode, setStrictMode] = useState(true);

  const process = (input: string) => {
    const allowedDomains = allowedDomainsInput
      .split(/\r?\n|,/)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);

    const result = auditAiConnectorEgress(input, {
      allowedDomains,
      strictMode,
    });
    result.notes.push(`Strict mode: ${strictMode ? "enabled" : "disabled"}.`);
    return JSON.stringify(result);
  };

  const renderOutput = (output: string) => {
    if (!output) return null;
    let parsed: AiEgressAuditResult;
    try {
      parsed = JSON.parse(output) as AiEgressAuditResult;
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
            <div className="text-xs uppercase font-bold text-muted-foreground">Critical</div>
            <div className="text-xl font-semibold text-red-700 dark:text-red-400">{parsed.summary.critical}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase font-bold text-muted-foreground">High</div>
            <div className="text-xl font-semibold text-red-600 dark:text-red-300">{parsed.summary.high}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase font-bold text-muted-foreground">Medium</div>
            <div className="text-xl font-semibold text-amber-600 dark:text-amber-400">{parsed.summary.medium}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase font-bold text-muted-foreground">Low</div>
            <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">{parsed.summary.low}</div>
          </div>
        </div>

        <div className="space-y-2">
          {parsed.findings.map((finding, index) => (
            <div key={`${finding.destination}-${index}`} className="rounded-lg border bg-muted/20 p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-sm break-all">{finding.destination}</div>
                <div className={`text-xs uppercase font-semibold ${severityColor(finding.severity)}`}>
                  {finding.severity}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">{finding.reason}</div>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all border rounded bg-background/70 p-2">
                {finding.evidence}
              </pre>
            </div>
          ))}
        </div>

        <div className="rounded-lg border bg-muted/20 p-3">
          <h3 className="text-sm font-semibold mb-2">Audit Notes</h3>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {parsed.notes.map((note) => (
              <li key={note}>- {note}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="AI Connector Egress Audit"
      description="Review outbound connector payloads and destinations for policy and data-loss risk."
      actionLabel="Audit Egress Payloads"
      placeholder="connector=slack destination=https://hooks.example.com payload=token=abcd1234 email=alice@example.com"
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ai-egress-allowed">Allowed Destination Domains (one per line)</Label>
            <Textarea
              id="ai-egress-allowed"
              value={allowedDomainsInput}
              onChange={(event) => setAllowedDomainsInput(event.target.value)}
              className="min-h-[90px] text-xs font-mono"
              placeholder={"api.openai.com\nslack.com\nstorage.example.com"}
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="ai-egress-strict">Strict mode (tighter destination + sharing checks)</Label>
            <Switch
              id="ai-egress-strict"
              checked={strictMode}
              onChange={(event) => setStrictMode(event.target.checked)}
            />
          </div>
        </div>
      }
      examples={[
        "destination=https://hooks.slack.com payload=user=alice@example.com ssn=123-45-6789",
        "connector=crm destination=https://partner.example.net payload=api_key=ABCD1234",
      ]}
    />
  );
}

