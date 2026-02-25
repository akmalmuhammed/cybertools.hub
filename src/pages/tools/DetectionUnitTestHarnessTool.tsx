import { ToolTemplate } from "@/components/tools/ToolTemplate";
import {
  runDetectionUnitHarness,
  type DetectionUnitHarnessResult,
} from "@/lib/utils/detection-unit-test";

export default function DetectionUnitTestHarnessTool() {
  const process = (input: string) => JSON.stringify(runDetectionUnitHarness(input));

  const renderOutput = (output: string) => {
    let parsed: DetectionUnitHarnessResult;
    try {
      parsed = JSON.parse(output) as DetectionUnitHarnessResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="p-3 border rounded bg-muted/20">
          <div className="text-sm font-semibold">{parsed.ruleTitle ?? "Untitled Rule"}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Pass Rate: {parsed.passRate}% ({parsed.passed}/{parsed.total})
          </div>
        </div>

        <div className="space-y-2">
          {parsed.results.map((item) => (
            <div
              key={item.label}
              className={`p-3 border rounded ${item.passed ? "bg-green-500/10 border-green-600/30" : "bg-red-500/10 border-red-600/30"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{item.label}</div>
                <div className="text-xs">{item.passed ? "PASS" : "FAIL"}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Expected: {String(item.expectMatch)} | Actual: {String(item.actualMatch)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="Detection Rule Unit Test Harness"
      description="Validate Sigma-like detection logic against deterministic fixtures before production deployment."
      actionLabel="Run Unit Tests"
      placeholder={`{
  "rule": "title: Suspicious PowerShell\\ndetection:\\n  selection:\\n    Image|contains: powershell\\n  condition: selection",
  "fixtures": [
    { "label": "powershell hit", "event": { "Image": "C:\\\\Windows\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe" }, "expectMatch": true },
    { "label": "benign cmd", "event": { "Image": "cmd.exe" }, "expectMatch": false }
  ]
}`}
      onProcess={process}
      renderOutput={renderOutput}
    />
  );
}
