import { useState } from "react";
import { ToolTemplate } from "@/components/tools/ToolTemplate";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  runKevCvePrioritizer,
  type PrioritizationWeights,
  type VulnerabilityPrioritizationResult,
} from "@/lib/utils/kev-prioritizer";

function priorityColor(priority: string): string {
  if (priority === "P1") return "text-red-600 dark:text-red-400";
  if (priority === "P2") return "text-amber-600 dark:text-amber-400";
  if (priority === "P3") return "text-yellow-600 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}

export default function KevCvePrioritizerTool() {
  const [kevCatalogInput, setKevCatalogInput] = useState("");
  const [weightPreset, setWeightPreset] = useState<"balanced" | "kev-heavy" | "exploit-heavy" | "custom">("balanced");
  const [weights, setWeights] = useState<PrioritizationWeights>({
    kev: 1,
    exploit: 1,
    cvss: 1,
    epss: 1,
    asset: 1,
  });

  const applyWeightPreset = (preset: "balanced" | "kev-heavy" | "exploit-heavy" | "custom") => {
    setWeightPreset(preset);
    if (preset === "balanced") {
      setWeights({ kev: 1, exploit: 1, cvss: 1, epss: 1, asset: 1 });
      return;
    }
    if (preset === "kev-heavy") {
      setWeights({ kev: 1.4, exploit: 1, cvss: 0.9, epss: 1, asset: 1.1 });
      return;
    }
    if (preset === "exploit-heavy") {
      setWeights({ kev: 1.1, exploit: 1.5, cvss: 1, epss: 1.2, asset: 1 });
    }
  };

  const process = (input: string) => {
    const result = runKevCvePrioritizer(input, kevCatalogInput, weights);
    result.notes.push(
      `Scoring weights => KEV:${weights.kev.toFixed(2)} Exploit:${weights.exploit.toFixed(2)} CVSS:${weights.cvss.toFixed(2)} EPSS:${weights.epss.toFixed(2)} Asset:${weights.asset.toFixed(2)}.`,
    );
    return JSON.stringify(result);
  };

  const renderOutput = (output: string) => {
    if (!output) return null;

    let parsed: VulnerabilityPrioritizationResult;
    try {
      parsed = JSON.parse(output) as VulnerabilityPrioritizationResult;
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
            <div className="text-xs font-bold text-muted-foreground uppercase">P1</div>
            <div className="text-xl font-semibold text-red-600 dark:text-red-400">{parsed.summary.p1}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold text-muted-foreground uppercase">P2</div>
            <div className="text-xl font-semibold text-amber-600 dark:text-amber-400">{parsed.summary.p2}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold text-muted-foreground uppercase">P3</div>
            <div className="text-xl font-semibold text-yellow-600 dark:text-yellow-400">{parsed.summary.p3}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold text-muted-foreground uppercase">P4</div>
            <div className="text-xl font-semibold text-green-600 dark:text-green-400">{parsed.summary.p4}</div>
          </div>
        </div>

        <div className="space-y-2">
          {parsed.items.map((item) => (
            <div key={item.cve} className="p-3 border rounded bg-muted/20 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono font-semibold">{item.cve}</div>
                <div className={`font-semibold ${priorityColor(item.priority)}`}>
                  {item.priority} ({item.score})
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                CVSS: {item.cvss ?? "N/A"} | EPSS: {item.epss === null ? "N/A" : `${(item.epss * 100).toFixed(1)}%`} | Asset: {item.assetCriticality}
              </div>
              <div className="text-xs text-muted-foreground">
                Formula transparency: Score combines KEV, exploit signal, CVSS, EPSS, and asset criticality weights.
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
      toolName="KEV/CVE Prioritizer"
      description="Prioritize vulnerability lists client-side using KEV, NVD feed JSON ingest, CVSS, EPSS, exploit signals, and asset criticality."
      actionLabel="Prioritize CVEs"
      placeholder="CVE-2024-3094 cvss=10 epss=0.98 critical exploit (or paste NVD feed JSON)"
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Weight Profile</Label>
            <Tabs
              value={weightPreset}
              onValueChange={(value) => {
                if (value === "balanced" || value === "kev-heavy" || value === "exploit-heavy" || value === "custom") {
                  applyWeightPreset(value);
                }
              }}
              className="w-full"
            >
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="balanced">Balanced</TabsTrigger>
                <TabsTrigger value="kev-heavy">KEV Heavy</TabsTrigger>
                <TabsTrigger value="exploit-heavy">Exploit Heavy</TabsTrigger>
                <TabsTrigger value="custom">Custom</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid sm:grid-cols-5 gap-2">
            {([
              ["kev", "KEV"],
              ["exploit", "Exploit"],
              ["cvss", "CVSS"],
              ["epss", "EPSS"],
              ["asset", "Asset"],
            ] as Array<[keyof PrioritizationWeights, string]>).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input
                  value={weights[key]}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    if (Number.isFinite(parsed)) {
                      setWeightPreset("custom");
                      setWeights((prev) => ({ ...prev, [key]: Math.max(0, Math.min(2, parsed)) }));
                    }
                  }}
                />
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <Label>CISA KEV Catalog Input (optional)</Label>
            <Textarea
              value={kevCatalogInput}
              onChange={(event) => setKevCatalogInput(event.target.value)}
              placeholder="Paste KEV CVE IDs (or full KEV export text)..."
              className="min-h-[120px] font-mono text-xs"
            />
          </div>
        </div>
      }
      examples={[
        "CVE-2024-3094 cvss=10 epss=0.98 critical exploit\nCVE-2023-23397 cvss=9.8 epss=0.74 high",
        "{\"vulnerabilities\":[{\"cve\":{\"id\":\"CVE-2024-3094\",\"metrics\":{\"cvssMetricV31\":[{\"cvssData\":{\"baseScore\":10}}]},\"references\":[{\"url\":\"https://example.com/exploit\",\"tags\":[\"Exploit\"]}]}}]}",
        "cve,cvss,epss,kev,public_exploit,asset_criticality\nCVE-2024-12345,9.8,0.65,true,true,critical",
      ]}
    />
  );
}
