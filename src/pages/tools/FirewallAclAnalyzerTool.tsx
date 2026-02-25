import { ToolTemplate } from "@/components/tools/ToolTemplate";
import {
  analyzeFirewallAcl,
  type FirewallAnalysisResult,
} from "@/lib/utils/firewall-acl-analyzer";

export default function FirewallAclAnalyzerTool() {
  const process = (input: string) => JSON.stringify(analyzeFirewallAcl(input));

  const renderOutput = (output: string) => {
    let parsed: FirewallAnalysisResult;
    try {
      parsed = JSON.parse(output) as FirewallAnalysisResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-5 gap-2">
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">Rules</div><div className="text-xl font-semibold">{parsed.summary.totalRules}</div></div>
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">Duplicates</div><div className="text-xl font-semibold">{parsed.summary.duplicate}</div></div>
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">Shadowed</div><div className="text-xl font-semibold">{parsed.summary.shadowed}</div></div>
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">Conflicts</div><div className="text-xl font-semibold">{parsed.summary.conflict}</div></div>
          <div className="p-3 border rounded bg-muted/20"><div className="text-xs">Over-Permissive</div><div className="text-xl font-semibold">{parsed.summary.overPermissive}</div></div>
        </div>

        <div className="space-y-2">
          {parsed.findings.map((finding, index) => (
            <div key={`${finding.type}:${index}`} className="p-3 border rounded bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{finding.message}</div>
                <div className="text-xs uppercase">{finding.severity}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Type: {finding.type} | Lines: {finding.lines.join(", ")}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{finding.message}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="Firewall/ACL Rule Conflict Analyzer"
      description="Detect duplicate, shadowed, conflicting, and overly permissive ACL/firewall rules."
      actionLabel="Analyze Rules"
      placeholder="allow tcp any any 443\ndeny tcp any 10.0.0.0/24 443\nallow any any any any"
      onProcess={process}
      renderOutput={renderOutput}
    />
  );
}
