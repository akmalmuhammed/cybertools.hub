import { ToolTemplate } from "@/components/tools/ToolTemplate";
import {
  analyzeIamPolicy,
  type IamPolicyAnalysisResult,
} from "@/lib/utils/iam-policy-analyzer";

export default function IamPolicyAnalyzerTool() {
  const process = (input: string) => JSON.stringify(analyzeIamPolicy(input));

  const renderOutput = (output: string) => {
    let parsed: IamPolicyAnalysisResult;
    try {
      parsed = JSON.parse(output) as IamPolicyAnalysisResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-5 gap-2">
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">Findings</div><div className="text-xl font-semibold">{parsed.summary.totalFindings}</div></div>
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">Critical</div><div className="text-xl font-semibold">{parsed.summary.critical}</div></div>
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">High</div><div className="text-xl font-semibold">{parsed.summary.high}</div></div>
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">Medium</div><div className="text-xl font-semibold">{parsed.summary.medium}</div></div>
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">Low</div><div className="text-xl font-semibold">{parsed.summary.low}</div></div>
        </div>

        <div className="space-y-2">
          {parsed.findings.map((finding, index) => (
            <div key={`${finding.issue}:${index}`} className="p-3 border rounded bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{finding.issue}</div>
                <div className="text-xs uppercase">{finding.platform} · {finding.severity}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{finding.evidence}</div>
              <div className="text-xs text-muted-foreground">{finding.recommendation}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="IAM Policy Analyzer"
      description="Lint AWS/Azure/GCP policy JSON for wildcard privilege and risky identity grants."
      actionLabel="Analyze IAM Policy"
      placeholder={`{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "*",
      "Resource": "*"
    }
  ]
}`}
      onProcess={process}
      renderOutput={renderOutput}
    />
  );
}
