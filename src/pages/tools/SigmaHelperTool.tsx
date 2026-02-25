import { ToolTemplate } from "@/components/tools/ToolTemplate";
import {
  lintAndTranslateSigmaRule,
  type SigmaLintResult,
} from "@/lib/utils/sigma-linter";

export default function SigmaHelperTool() {
  const process = (input: string) => JSON.stringify(lintAndTranslateSigmaRule(input));

  const renderOutput = (output: string) => {
    if (!output) return null;
    let parsed: SigmaLintResult;
    try {
      parsed = JSON.parse(output) as SigmaLintResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className={`p-3 border rounded ${parsed.valid ? "bg-green-500/10 border-green-600/30" : "bg-red-500/10 border-red-600/30"}`}>
          <div className="font-semibold">Lint Status: {parsed.valid ? "PASS" : "FAIL"}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Techniques: {parsed.attackCoverage.techniques} | Tactics: {parsed.attackCoverage.tactics}
          </div>
        </div>

        {parsed.errors.length > 0 && (
          <div className="p-3 border rounded bg-red-500/10 border-red-600/30">
            <h3 className="text-sm font-semibold mb-2">Errors</h3>
            <ul className="text-sm space-y-1">
              {parsed.errors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        {parsed.warnings.length > 0 && (
          <div className="p-3 border rounded bg-amber-500/10 border-amber-600/30">
            <h3 className="text-sm font-semibold mb-2">Warnings</h3>
            <ul className="text-sm space-y-1">
              {parsed.warnings.map((warning, index) => (
                <li key={index}>• {warning}</li>
              ))}
            </ul>
          </div>
        )}

        {parsed.translated && (
          <div className="space-y-2">
            <div className="p-3 border rounded bg-muted/20">
              <h3 className="text-sm font-semibold mb-1">KQL Helper</h3>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">{parsed.translated.kql}</pre>
            </div>
            <div className="p-3 border rounded bg-muted/20">
              <h3 className="text-sm font-semibold mb-1">Splunk Helper</h3>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">{parsed.translated.splunk}</pre>
            </div>
            <div className="p-3 border rounded bg-muted/20">
              <h3 className="text-sm font-semibold mb-1">Elastic Helper</h3>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">{parsed.translated.elastic}</pre>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="Sigma Rule Linter / Translator Helper"
      description="Lint Sigma YAML for syntax and ATT&CK tag completeness, then generate backend query helpers."
      actionLabel="Lint Sigma Rule"
      placeholder={"title: Suspicious PowerShell\nid: 11111111-1111-1111-1111-111111111111\nstatus: experimental\nlogsource:\n  product: windows\n  category: process_creation\ntags:\n  - attack.execution\n  - attack.t1059.001\ndetection:\n  selection:\n    Image|endswith: powershell.exe\n  condition: selection"}
      onProcess={process}
      renderOutput={renderOutput}
      examples={[
        "title: Test Rule\nlogsource:\n  product: windows\ndetection:\n  selection:\n    EventID: 1\n  condition: selection",
      ]}
    />
  );
}
