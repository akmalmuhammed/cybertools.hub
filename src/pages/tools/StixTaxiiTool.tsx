import { useState } from "react";
import { ToolTemplate } from "@/components/tools/ToolTemplate";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  compareStixBundles,
  exportStixBundle,
  parseStixOrTaxii,
  validateStixBundle,
  type StixBundleComparison,
  type StixValidationResult,
} from "@/lib/utils/stix-taxii";

type StixUtilityMode = "validate" | "compare" | "export";

interface ValidatePayload {
  mode: "validate";
  validation: StixValidationResult;
  bundlePreview: {
    id: string;
    specVersion: string;
    objectCount: number;
  };
}

interface ComparePayload {
  mode: "compare";
  comparison: StixBundleComparison;
}

interface ExportPayload {
  mode: "export";
  objectCount: number;
  bundleJson: string;
}

type StixUtilityOutput = ValidatePayload | ComparePayload | ExportPayload;

export default function StixTaxiiTool() {
  const [mode, setMode] = useState<StixUtilityMode>("validate");
  const [secondaryInput, setSecondaryInput] = useState("");
  const [expectedVersion, setExpectedVersion] = useState("2.1");

  const process = (input: string): string => {
    if (mode === "validate") {
      const bundle = parseStixOrTaxii(input);
      const validation = validateStixBundle(bundle, expectedVersion || "2.1");
      const payload: ValidatePayload = {
        mode: "validate",
        validation,
        bundlePreview: {
          id: bundle.id,
          specVersion: bundle.spec_version,
          objectCount: bundle.objects.length,
        },
      };
      return JSON.stringify(payload);
    }

    if (mode === "compare") {
      const before = parseStixOrTaxii(input);
      const after = parseStixOrTaxii(secondaryInput);
      const comparison = compareStixBundles(before, after);
      const payload: ComparePayload = {
        mode: "compare",
        comparison,
      };
      return JSON.stringify(payload);
    }

    const bundle = parseStixOrTaxii(input);
    const bundleJson = exportStixBundle(bundle.objects, { specVersion: expectedVersion || "2.1" });
    const payload: ExportPayload = {
      mode: "export",
      objectCount: bundle.objects.length,
      bundleJson,
    };
    return JSON.stringify(payload);
  };

  const renderOutput = (output: string) => {
    if (!output) return null;
    let parsed: StixUtilityOutput;
    try {
      parsed = JSON.parse(output) as StixUtilityOutput;
    } catch {
      return null;
    }

    if (parsed.mode === "validate") {
      return (
        <div className="space-y-4">
          <div className="p-3 border rounded bg-muted/20 space-y-1">
            <div className="text-xs uppercase font-bold text-muted-foreground">Bundle</div>
            <div className="text-sm font-mono break-all">{parsed.bundlePreview.id}</div>
            <div className="text-xs text-muted-foreground">spec_version={parsed.bundlePreview.specVersion} | objects={parsed.bundlePreview.objectCount}</div>
          </div>

          <div className={`p-3 border rounded ${parsed.validation.valid ? "bg-green-500/10 border-green-600/30" : "bg-red-500/10 border-red-600/30"}`}>
            <div className="font-semibold">Validation: {parsed.validation.valid ? "PASS" : "FAIL"}</div>
            <div className="text-xs text-muted-foreground mt-1">Objects checked: {parsed.validation.objectCount}</div>
          </div>

          {parsed.validation.errors.length > 0 && (
            <div className="p-3 border rounded bg-red-500/10 border-red-600/30">
              <h3 className="text-sm font-semibold mb-2">Errors</h3>
              <ul className="text-sm space-y-1">
                {parsed.validation.errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {parsed.validation.warnings.length > 0 && (
            <div className="p-3 border rounded bg-amber-500/10 border-amber-600/30">
              <h3 className="text-sm font-semibold mb-2">Warnings</h3>
              <ul className="text-sm space-y-1">
                {parsed.validation.warnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    if (parsed.mode === "compare") {
      return (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-4 gap-2">
            <div className="p-3 border rounded bg-muted/20">
              <div className="text-xs uppercase font-bold text-muted-foreground">Added</div>
              <div className="text-xl font-semibold text-green-600 dark:text-green-400">{parsed.comparison.added.length}</div>
            </div>
            <div className="p-3 border rounded bg-muted/20">
              <div className="text-xs uppercase font-bold text-muted-foreground">Removed</div>
              <div className="text-xl font-semibold text-red-600 dark:text-red-400">{parsed.comparison.removed.length}</div>
            </div>
            <div className="p-3 border rounded bg-muted/20">
              <div className="text-xs uppercase font-bold text-muted-foreground">Changed</div>
              <div className="text-xl font-semibold text-amber-600 dark:text-amber-400">{parsed.comparison.changed.length}</div>
            </div>
            <div className="p-3 border rounded bg-muted/20">
              <div className="text-xs uppercase font-bold text-muted-foreground">Unchanged</div>
              <div className="text-xl font-semibold">{parsed.comparison.unchanged}</div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Before={parsed.comparison.summary.before} objects | After={parsed.comparison.summary.after} objects
          </div>

          {["added", "removed", "changed"].map((section) => {
            const values =
              section === "added"
                ? parsed.comparison.added
                : section === "removed"
                  ? parsed.comparison.removed
                  : parsed.comparison.changed;
            if (values.length === 0) return null;
            return (
              <div key={section} className="p-3 border rounded bg-muted/20">
                <h3 className="text-sm font-semibold mb-2 capitalize">{section}</h3>
                <pre className="text-xs font-mono whitespace-pre-wrap break-all">{values.join("\n")}</pre>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="p-3 border rounded bg-muted/20 text-sm">Exported local bundle with {parsed.objectCount} object(s).</div>
        <pre className="text-xs font-mono whitespace-pre-wrap break-all p-3 border rounded bg-muted/20">{parsed.bundleJson}</pre>
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="STIX 2.1 / TAXII Utility"
      description="Parse STIX/TAXII JSON, validate schema hygiene, compare bundles, and export normalized local bundles."
      actionLabel={mode === "validate" ? "Validate Bundle" : mode === "compare" ? "Compare Bundles" : "Export Bundle"}
      placeholder='{"type":"bundle","spec_version":"2.1","id":"bundle--...","objects":[]}'
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="stix-mode">Mode</Label>
            <select
              id="stix-mode"
              className="w-full rounded border bg-background px-2 py-2 text-sm"
              value={mode}
              onChange={(event) => setMode(event.target.value as StixUtilityMode)}
            >
              <option value="validate">Parse + Validate</option>
              <option value="compare">Compare two bundles</option>
              <option value="export">Export normalized bundle</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="stix-spec">Expected spec_version</Label>
            <input
              id="stix-spec"
              className="w-full rounded border bg-background px-2 py-2 text-sm"
              value={expectedVersion}
              onChange={(event) => setExpectedVersion(event.target.value)}
            />
          </div>

          {mode === "compare" && (
            <div className="space-y-1">
              <Label>Second bundle / TAXII payload</Label>
              <Textarea
                className="min-h-[120px] font-mono text-xs"
                value={secondaryInput}
                onChange={(event) => setSecondaryInput(event.target.value)}
                placeholder='{"type":"bundle","spec_version":"2.1","id":"bundle--...","objects":[]}'
              />
            </div>
          )}
        </div>
      }
      examples={[
        "{\"type\":\"bundle\",\"spec_version\":\"2.1\",\"id\":\"bundle--11111111-1111-4111-8111-111111111111\",\"objects\":[{\"type\":\"indicator\",\"spec_version\":\"2.1\",\"id\":\"indicator--11111111-1111-4111-8111-111111111111\",\"pattern\":\"[ipv4-addr:value = '8.8.8.8']\",\"pattern_type\":\"stix\"}]}"
      ]}
    />
  );
}
