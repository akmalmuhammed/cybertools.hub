import { ToolTemplate } from "@/components/tools/ToolTemplate";
import {
  analyzeOpenApiAuthzGaps,
  type OpenApiAuthzResult,
} from "@/lib/utils/openapi-authz-gap";

export default function OpenApiAuthzGapTool() {
  const process = (input: string) => JSON.stringify(analyzeOpenApiAuthzGaps(input));

  const renderOutput = (output: string) => {
    let parsed: OpenApiAuthzResult;
    try {
      parsed = JSON.parse(output) as OpenApiAuthzResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-4 gap-2">
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">Ops</div><div className="text-xl font-semibold">{parsed.summary.operations}</div></div>
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">Unsecured</div><div className="text-xl font-semibold">{parsed.summary.unsecured}</div></div>
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">Weak Scope</div><div className="text-xl font-semibold">{parsed.summary.weakScoped}</div></div>
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">API Key Query</div><div className="text-xl font-semibold">{parsed.summary.riskyApiKeyQuery}</div></div>
        </div>

        <div className="space-y-2">
          {parsed.findings.map((finding, index) => (
            <div key={`${finding.path}:${finding.method}:${index}`} className="p-3 border rounded bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{finding.method} {finding.path}</div>
                <div className="text-xs uppercase">{finding.severity}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{finding.issue}</div>
              <div className="text-xs text-muted-foreground">{finding.recommendation}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="OpenAPI AuthZ Gap Analyzer"
      description="Find authorization gaps and over-broad scope patterns in OpenAPI contracts."
      actionLabel="Analyze OpenAPI"
      placeholder={`{
  "openapi": "3.0.3",
  "paths": {
    "/admin/users": {
      "get": { "responses": { "200": { "description": "ok" } } }
    }
  }
}`}
      onProcess={process}
      renderOutput={renderOutput}
    />
  );
}
