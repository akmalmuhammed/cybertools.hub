import { ToolTemplate } from "@/components/tools/ToolTemplate";
import {
  mapLogsToSchemaHints,
  type SchemaMappingResult,
} from "@/lib/utils/log-schema-mapper";

export default function LogSchemaMapperTool() {
  const process = (input: string) => JSON.stringify(mapLogsToSchemaHints(input));

  const renderOutput = (output: string) => {
    let parsed: SchemaMappingResult;
    try {
      parsed = JSON.parse(output) as SchemaMappingResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="p-3 border rounded bg-muted/20 text-sm">
          Records parsed: <span className="font-semibold">{parsed.recordCount}</span> | Unmapped fields: <span className="font-semibold">{parsed.unmappedFields.length}</span>
        </div>

        <div className="space-y-2">
          {parsed.hints.map((hint) => (
            <div key={hint.rawField} className="p-3 border rounded bg-muted/20 text-xs space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{hint.rawField}</span>
                <span>{Math.round(hint.confidence * 100)}%</span>
              </div>
              <div>ECS: {hint.ecsField ?? "-"}</div>
              <div>OCSF: {hint.ocsfField ?? "-"}</div>
              <div className="text-muted-foreground">Samples: {hint.sampleValues.join(", ") || "-"}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="Log Schema Mapper"
      description="Map raw logs to ECS and OCSF schema hints to accelerate ingestion normalization and parser design."
      actionLabel="Map Schema"
      placeholder='timestamp=2026-02-25T11:20:00Z src_ip=10.10.5.5 dst_ip=8.8.8.8 user=akmal event_id=4624 process_name=powershell.exe'
      onProcess={process}
      renderOutput={renderOutput}
    />
  );
}
