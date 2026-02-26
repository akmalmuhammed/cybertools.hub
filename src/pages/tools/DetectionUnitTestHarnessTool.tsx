import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import {
  runDetectionUnitHarness,
  type DetectionUnitHarnessResult,
  type DetectionUnitCaseResult,
} from "@/lib/utils/detection-unit-test"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

export default function DetectionUnitTestHarnessTool() {
  const [minimumPassRate, setMinimumPassRate] = useState("90")
  const [maxAllowedFailures, setMaxAllowedFailures] = useState("0")
  const [minimumFixtureCount, setMinimumFixtureCount] = useState("2")
  const [requirePositiveAndNegativeFixtures, setRequirePositiveAndNegativeFixtures] = useState(true)
  const [failOnAnyMismatch, setFailOnAnyMismatch] = useState(true)
  const [flagSingleSelectorRules, setFlagSingleSelectorRules] = useState(false)

  const process = (input: string) => {
    const harness = runDetectionUnitHarness(input)
    const findings: ToolFinding[] = []

    const passRateFloor = Math.max(0, Math.min(100, Number(minimumPassRate) || 90))
    const failureLimit = Math.max(0, Number(maxAllowedFailures) || 0)
    const fixtureFloor = Math.max(1, Number(minimumFixtureCount) || 2)

    if (harness.total < fixtureFloor) {
      findings.push({
        id: "detection-harness-fixture-count-low",
        severity: "medium",
        confidence: 78,
        category: "test-coverage",
        title: "Fixture count below policy baseline",
        description: `Harness executed ${harness.total} fixture(s), minimum required is ${fixtureFloor}.`,
        remediation: "Add more deterministic fixtures covering benign and malicious variants.",
      })
    }

    if (harness.passRate < passRateFloor) {
      findings.push({
        id: "detection-harness-pass-rate-low",
        severity: harness.passRate < Math.max(50, passRateFloor - 20) ? "high" : "medium",
        confidence: 84,
        category: "test-quality",
        title: "Pass rate below threshold",
        description: `Pass rate is ${harness.passRate}% and minimum required is ${passRateFloor}%.`,
        remediation: "Fix selector logic or fixture expectations before deployment.",
      })
    }

    if (harness.failed > failureLimit) {
      findings.push({
        id: "detection-harness-failures-over-limit",
        severity: harness.failed > failureLimit + 2 ? "high" : "medium",
        confidence: 82,
        category: "release-gate",
        title: "Failed fixture count exceeds threshold",
        description: `${harness.failed} failure(s) observed; maximum allowed is ${failureLimit}.`,
        remediation: "Resolve failing fixtures and rerun harness before promoting rule revisions.",
      })
    }

    if (failOnAnyMismatch && harness.failed > 0) {
      findings.push({
        id: "detection-harness-mismatch-blocker",
        severity: "high",
        confidence: 86,
        category: "release-gate",
        title: "Fixture mismatch present under strict mode",
        description: `${harness.failed} fixture(s) mismatched expected behavior.`,
        remediation: "Treat all mismatches as blockers until the rule and fixtures are aligned.",
      })
    }

    if (requirePositiveAndNegativeFixtures) {
      const hasPositive = harness.results.some((item) => item.expectMatch)
      const hasNegative = harness.results.some((item) => !item.expectMatch)
      if (!hasPositive || !hasNegative) {
        findings.push({
          id: "detection-harness-unbalanced-fixtures",
          severity: "medium",
          confidence: 76,
          category: "test-coverage",
          title: "Fixture set missing positive/negative balance",
          description: `Positive fixtures=${hasPositive ? "yes" : "no"}, negative fixtures=${hasNegative ? "yes" : "no"}.`,
          remediation: "Include both expected matches and expected non-matches to prevent blind spots.",
        })
      }
    }

    if (flagSingleSelectorRules && harness.notes.some((note) => note.toLowerCase().includes("condition"))) {
      findings.push({
        id: "detection-harness-condition-review",
        severity: "low",
        confidence: 68,
        category: "rule-complexity",
        title: "Condition expression should be reviewed",
        description: harness.notes.join(" "),
        remediation: "Validate that condition logic is resilient to schema and parser variance.",
      })
    }

    if (harness.total > 0 && harness.failed === 0 && harness.passRate === 100) {
      findings.push({
        id: "detection-harness-perfect-pass",
        severity: "info",
        confidence: 70,
        category: "quality-signal",
        title: "All fixtures passed",
        description: "Rule behavior matched expected outcomes across all fixtures.",
        remediation: "Run cross-backend validation and schema-variant tests before production release.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "Detection unit harness completed",
      text: `Pass rate ${harness.passRate}% (${harness.passed}/${harness.total}), failures=${harness.failed}.`,
      findings,
      metrics: {
        total: harness.total,
        passed: harness.passed,
        failed: harness.failed,
        passRate: harness.passRate,
      },
      baseScore: harness.passRate,
    })

    const evidenceRows = harness.results.map((item) => ({
      label: item.label,
      expectMatch: item.expectMatch,
      actualMatch: item.actualMatch,
      passed: item.passed,
    }))

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "Detection Rule Unit Test Harness",
        summary,
        findings,
        evidence: evidenceRows,
        recommendations: [
          "Gate rule promotion on pass-rate and failure thresholds, not ad hoc testing.",
          "Maintain fixture balance (positive/negative) and schema variants for robust validation.",
          "Track harness regression history per rule ID across release cycles.",
        ],
        raw: {
          harness,
          config: {
            passRateFloor,
            failureLimit,
            fixtureFloor,
            requirePositiveAndNegativeFixtures,
            failOnAnyMismatch,
            flagSingleSelectorRules,
          },
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null
    const envelope = parseToolResultEnvelope(output, "Detection Rule Unit Test Harness")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null
    const parsed = raw?.harness as DetectionUnitHarnessResult | undefined
    const config = raw?.config && typeof raw.config === "object" && raw.config !== null
      ? (raw.config as Record<string, unknown>)
      : null

    if (!parsed) return null

    return (
      <div className="space-y-4">
        <div className="p-3 border rounded bg-muted/20">
          <div className="text-sm font-semibold">{parsed.ruleTitle ?? "Untitled Rule"}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Pass Rate: {parsed.passRate}% ({parsed.passed}/{parsed.total})
            {config && <> | Target: {String(config.passRateFloor ?? "90")}%</>}
          </div>
        </div>

        <div className="space-y-2">
          {parsed.results.map((item: DetectionUnitCaseResult) => (
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
    )
  }

  return (
    <ToolTemplate
      toolName="Detection Rule Unit Test Harness"
      description="Validate detection logic with fixture-based policy gates, pass-rate baselines, and release-readiness findings."
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
      controls={
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Minimum pass rate (%)</Label>
              <Input
                value={minimumPassRate}
                onChange={(event) => setMinimumPassRate(event.target.value)}
                placeholder="90"
              />
            </div>
            <div className="space-y-1">
              <Label>Max allowed failures</Label>
              <Input
                value={maxAllowedFailures}
                onChange={(event) => setMaxAllowedFailures(event.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Minimum fixture count</Label>
            <Input
              value={minimumFixtureCount}
              onChange={(event) => setMinimumFixtureCount(event.target.value)}
              placeholder="2"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="detection-require-balance" className="text-sm">Require positive and negative fixtures</Label>
              <Switch
                id="detection-require-balance"
                checked={requirePositiveAndNegativeFixtures}
                onChange={(event) => setRequirePositiveAndNegativeFixtures(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="detection-fail-any-mismatch" className="text-sm">Fail on any mismatch</Label>
              <Switch
                id="detection-fail-any-mismatch"
                checked={failOnAnyMismatch}
                onChange={(event) => setFailOnAnyMismatch(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 sm:col-span-2">
              <Label htmlFor="detection-flag-selector" className="text-sm">Flag condition notes for review</Label>
              <Switch
                id="detection-flag-selector"
                checked={flagSingleSelectorRules}
                onChange={(event) => setFlagSingleSelectorRules(event.target.checked)}
              />
            </div>
          </div>
        </div>
      }
    />
  )
}
