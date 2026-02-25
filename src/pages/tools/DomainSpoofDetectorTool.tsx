import { useState } from "react";
import { ToolTemplate } from "@/components/tools/ToolTemplate";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeDomainSpoofBatch,
  type DomainSpoofBatchResult,
} from "@/lib/utils/domain-spoof";

function riskColor(risk: string): string {
  if (risk === "critical") return "text-red-700 dark:text-red-400";
  if (risk === "high") return "text-red-600 dark:text-red-300";
  if (risk === "medium") return "text-amber-600 dark:text-amber-400";
  return "text-green-600 dark:text-green-400";
}

export default function DomainSpoofDetectorTool() {
  const [brandInput, setBrandInput] = useState("");
  const [ageHintsInput, setAgeHintsInput] = useState("");

  const process = (input: string) =>
    JSON.stringify(
      analyzeDomainSpoofBatch(input, {
        brandInput,
        ageHintsInput,
      }),
    );

  const renderOutput = (output: string) => {
    if (!output) return null;
    let parsed: DomainSpoofBatchResult;
    try {
      parsed = JSON.parse(output) as DomainSpoofBatchResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-5 gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold uppercase text-muted-foreground">Total</div>
            <div className="text-xl font-semibold">{parsed.summary.total}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold uppercase text-muted-foreground">Critical</div>
            <div className="text-xl font-semibold text-red-700 dark:text-red-400">{parsed.summary.critical}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold uppercase text-muted-foreground">High</div>
            <div className="text-xl font-semibold text-red-600 dark:text-red-300">{parsed.summary.high}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold uppercase text-muted-foreground">Medium</div>
            <div className="text-xl font-semibold text-amber-600 dark:text-amber-400">{parsed.summary.medium}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold uppercase text-muted-foreground">Low</div>
            <div className="text-xl font-semibold text-green-600 dark:text-green-400">{parsed.summary.low}</div>
          </div>
        </div>

        <div className="space-y-2">
          {parsed.items.map((item) => (
            <div key={item.domain} className="p-3 border rounded bg-muted/20 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono font-semibold">{item.domain}</div>
                <div className={`font-semibold uppercase ${riskColor(item.risk)}`}>
                  {item.risk} ({item.score})
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Age: {item.ageDays === null ? "unknown" : `${item.ageDays}d`} | Brands: {item.matchedBrands.length > 0 ? item.matchedBrands.join(", ") : "none"}
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
      toolName="Domain Spoof Detector"
      description="Detect likely domain spoofing and brand abuse using homoglyph/confusable heuristics and registrar-age signals."
      actionLabel="Analyze Domains"
      placeholder="paypaI.com\nраураl.com\nlogin-microsoft-secure[.]zip"
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Brand keywords (optional, comma/newline)</Label>
            <Textarea
              value={brandInput}
              onChange={(event) => setBrandInput(event.target.value)}
              placeholder="microsoft, google, okta, yourbrand"
              className="min-h-[100px] font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label>Registrar age hints (optional: domain,date)</Label>
            <Textarea
              value={ageHintsInput}
              onChange={(event) => setAgeHintsInput(event.target.value)}
              placeholder="example.com,2026-01-18"
              className="min-h-[100px] font-mono text-xs"
            />
          </div>
        </div>
      }
      examples={[
        "раураl.com\npaypal-login-secure.zip\naccounts-google-auth.com",
        "m1crosoft-support.top\nokta-verify-login.click",
      ]}
    />
  );
}
