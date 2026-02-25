import { ToolTemplate } from "@/components/tools/ToolTemplate";
import {
  analyzeCorsPolicy,
  type CorsAnalysisResult,
} from "@/lib/utils/cors-policy";

export default function CorsPolicyAnalyzerTool() {
  const process = (input: string) => JSON.stringify(analyzeCorsPolicy(input));

  const renderOutput = (output: string) => {
    let parsed: CorsAnalysisResult;
    try {
      parsed = JSON.parse(output) as CorsAnalysisResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="p-3 border rounded bg-muted/20">
          <div className="text-xs uppercase text-muted-foreground">CORS Risk Score</div>
          <div className="text-2xl font-semibold">{parsed.score}</div>
        </div>

        <div className="space-y-2">
          {parsed.findings.map((finding) => (
            <div key={`${finding.issue}:${finding.severity}`} className="p-3 border rounded bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{finding.issue}</div>
                <div className="text-xs uppercase">{finding.severity}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{finding.evidence}</div>
              <div className="text-xs text-muted-foreground">{finding.recommendation}</div>
            </div>
          ))}
        </div>

        <pre className="min-h-[140px] p-4 rounded-lg bg-background border overflow-auto text-xs font-mono whitespace-pre-wrap break-all">
          {JSON.stringify(parsed.normalizedHeaders, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="CORS Policy Analyzer"
      description="Analyze CORS response headers and explain browser security risk from origin and credential policy choices."
      actionLabel="Analyze CORS"
      placeholder="Access-Control-Allow-Origin: *\nAccess-Control-Allow-Credentials: true\nAccess-Control-Allow-Methods: GET,POST,PUT,DELETE"
      onProcess={process}
      renderOutput={renderOutput}
    />
  );
}
