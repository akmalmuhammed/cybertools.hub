import { ToolTemplate } from "@/components/tools/ToolTemplate";
import {
  mapMispToStixBundle,
  type MispStixMapperResult,
} from "@/lib/utils/misp-stix-mapper";

export default function MispStixMapperTool() {
  const process = (input: string) => JSON.stringify(mapMispToStixBundle(input));

  const renderOutput = (output: string) => {
    let parsed: MispStixMapperResult;
    try {
      parsed = JSON.parse(output) as MispStixMapperResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Attributes</div>
            <div className="text-xl font-semibold">{parsed.summary.attributes}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Mapped</div>
            <div className="text-xl font-semibold">{parsed.summary.mapped}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Unsupported</div>
            <div className="text-xl font-semibold">{parsed.summary.unsupported}</div>
          </div>
        </div>

        {parsed.warnings.length > 0 && (
          <div className="p-3 border rounded bg-amber-500/10 border-amber-600/30">
            <div className="font-semibold text-sm mb-2">Warnings</div>
            <ul className="text-xs text-muted-foreground space-y-1">
              {parsed.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        <pre className="min-h-[220px] p-4 rounded-lg bg-background border overflow-auto text-xs font-mono whitespace-pre-wrap break-all">
          {JSON.stringify(parsed.bundle, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="MISP/STIX Mapper & Consistency Checker"
      description="Convert simplified MISP exports into STIX bundles and validate mapping consistency for threat intel exchange."
      actionLabel="Map to STIX"
      placeholder={`{
  "Event": {
    "Attribute": [
      { "type": "ip-dst", "value": "8.8.8.8" },
      { "type": "domain", "value": "malicious.example" }
    ]
  }
}`}
      onProcess={process}
      renderOutput={renderOutput}
    />
  );
}
