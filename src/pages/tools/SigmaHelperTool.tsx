import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import {
  lintAndTranslateSigmaRule,
  type SigmaLintResult,
} from "@/lib/utils/sigma-linter"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

export default function SigmaHelperTool() {
  const [requireTechniqueTags, setRequireTechniqueTags] = useState(true)
  const [requireTacticTags, setRequireTacticTags] = useState(true)
  const [minTechniqueTags, setMinTechniqueTags] = useState("1")
  const [minTacticTags, setMinTacticTags] = useState("1")
  const [requireRuleId, setRequireRuleId] = useState(true)
  const [requireTranslatorOutput, setRequireTranslatorOutput] = useState(true)
  const [maxWarnings, setMaxWarnings] = useState("3")

  const process = (input: string) => {
    const sigma = lintAndTranslateSigmaRule(input)
    const findings: ToolFinding[] = []

    const minimumTechniques = Math.max(0, Number(minTechniqueTags) || 1)
    const minimumTactics = Math.max(0, Number(minTacticTags) || 1)
    const warningThreshold = Math.max(0, Number(maxWarnings) || 3)

    sigma.errors.forEach((error, index) => {
      findings.push({
        id: `sigma-error-${index + 1}`,
        severity: error.toLowerCase().includes("yaml") ? "critical" : "high",
        confidence: 90,
        category: "rule-validity",
        title: error,
        description: error,
        remediation: "Fix structural rule errors before backend translation or deployment.",
      })
    })

    sigma.warnings.forEach((warning, index) => {
      const lower = warning.toLowerCase()
      const isCoverage = lower.includes("att&ck")
      const isRuleIdWarning = lower.includes("rule id")
      findings.push({
        id: `sigma-warning-${index + 1}`,
        severity: isCoverage || isRuleIdWarning ? "medium" : "low",
        confidence: 76,
        category: "rule-hygiene",
        title: warning,
        description: warning,
        remediation: "Address warnings to improve ATT&CK traceability and change-control quality.",
      })
    })

    if (requireTechniqueTags && sigma.attackCoverage.techniques < minimumTechniques) {
      findings.push({
        id: "sigma-technique-coverage-low",
        severity: sigma.attackCoverage.techniques === 0 ? "high" : "medium",
        confidence: 84,
        category: "attack-mapping",
        title: "ATT&CK technique tagging below policy baseline",
        description: `Rule has ${sigma.attackCoverage.techniques} technique tag(s), minimum required is ${minimumTechniques}.`,
        remediation: "Add `attack.t####` technique tags aligned to rule detection intent.",
      })
    }

    if (requireTacticTags && sigma.attackCoverage.tactics < minimumTactics) {
      findings.push({
        id: "sigma-tactic-coverage-low",
        severity: sigma.attackCoverage.tactics === 0 ? "high" : "medium",
        confidence: 82,
        category: "attack-mapping",
        title: "ATT&CK tactic tagging below policy baseline",
        description: `Rule has ${sigma.attackCoverage.tactics} tactic tag(s), minimum required is ${minimumTactics}.`,
        remediation: "Add ATT&CK tactic tags (e.g., attack.execution) for reporting and coverage analytics.",
      })
    }

    if (requireRuleId && sigma.warnings.some((warning) => warning.toLowerCase().includes("missing rule id"))) {
      findings.push({
        id: "sigma-rule-id-missing-policy",
        severity: "medium",
        confidence: 79,
        category: "governance",
        title: "Rule ID required by policy",
        description: "Rule metadata does not include a stable ID.",
        remediation: "Assign immutable rule IDs to support versioning, exceptions, and release governance.",
      })
    }

    if (requireTranslatorOutput && !sigma.translated) {
      findings.push({
        id: "sigma-translation-unavailable",
        severity: "high",
        confidence: 88,
        category: "deployment-readiness",
        title: "Backend translation output missing",
        description: "Translator did not produce KQL/Splunk/Elastic helper output.",
        remediation: "Fix detection selectors/condition blocks until translation output is deterministic.",
      })
    }

    if (sigma.warnings.length > warningThreshold) {
      findings.push({
        id: "sigma-warning-threshold-exceeded",
        severity: sigma.warnings.length > warningThreshold + 2 ? "medium" : "low",
        confidence: 72,
        category: "rule-hygiene",
        title: "Warning count exceeds policy threshold",
        description: `Rule has ${sigma.warnings.length} warning(s); max allowed is ${warningThreshold}.`,
        remediation: "Resolve lint warnings before promoting rule to higher environments.",
      })
    }

    if (sigma.valid && sigma.errors.length === 0 && sigma.warnings.length === 0) {
      findings.push({
        id: "sigma-clean-rule",
        severity: "info",
        confidence: 69,
        category: "quality-signal",
        title: "Rule passed lint without warnings",
        description: "Rule is structurally clean and ready for controlled validation/testing.",
        remediation: "Proceed to fixture-based unit testing and backend query validation.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "Sigma lint and translation completed",
      text: `Rule ${sigma.valid ? "passed" : "failed"} lint checks with ${sigma.errors.length} error(s) and ${sigma.warnings.length} warning(s).`,
      findings,
      metrics: {
        valid: sigma.valid ? 1 : 0,
        errors: sigma.errors.length,
        warnings: sigma.warnings.length,
        techniques: sigma.attackCoverage.techniques,
        tactics: sigma.attackCoverage.tactics,
      },
      baseScore: sigma.valid ? 95 : 70,
    })

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "Sigma Rule Linter / Translator Helper",
        summary,
        findings,
        evidence: [
          {
            title: sigma.title,
            valid: sigma.valid,
            errors: sigma.errors,
            warnings: sigma.warnings,
            attackCoverage: sigma.attackCoverage,
            translated: sigma.translated,
          },
        ],
        recommendations: [
          "Require ATT&CK tactic/technique tags and stable rule IDs for all production detections.",
          "Treat lint errors as hard blockers before translation and unit-test phases.",
          "Continuously test translated queries against backend schema and parser assumptions.",
        ],
        raw: {
          sigma,
          config: {
            requireTechniqueTags,
            requireTacticTags,
            minimumTechniques,
            minimumTactics,
            requireRuleId,
            requireTranslatorOutput,
            warningThreshold,
          },
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null
    const envelope = parseToolResultEnvelope(output, "Sigma Rule Linter / Translator Helper")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null
    const parsed = raw?.sigma as SigmaLintResult | undefined
    const config = raw?.config && typeof raw.config === "object" && raw.config !== null
      ? (raw.config as Record<string, unknown>)
      : null
    if (!parsed) return null

    return (
      <div className="space-y-4">
        <div className={`p-3 border rounded ${parsed.valid ? "bg-green-500/10 border-green-600/30" : "bg-red-500/10 border-red-600/30"}`}>
          <div className="font-semibold">Lint Status: {parsed.valid ? "PASS" : "FAIL"}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Techniques: {parsed.attackCoverage.techniques} | Tactics: {parsed.attackCoverage.tactics}
            {config && <> | Max warnings: {String(config.warningThreshold ?? "3")}</>}
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
    )
  }

  return (
    <ToolTemplate
      toolName="Sigma Rule Linter / Translator Helper"
      description="Lint Sigma rules with ATT&CK/governance policy controls and backend translation readiness scoring."
      actionLabel="Lint Sigma Rule"
      placeholder={"title: Suspicious PowerShell\nid: 11111111-1111-1111-1111-111111111111\nstatus: experimental\nlogsource:\n  product: windows\n  category: process_creation\ntags:\n  - attack.execution\n  - attack.t1059.001\ndetection:\n  selection:\n    Image|endswith: powershell.exe\n  condition: selection"}
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Minimum ATT&CK technique tags</Label>
              <Input
                value={minTechniqueTags}
                onChange={(event) => setMinTechniqueTags(event.target.value)}
                placeholder="1"
              />
            </div>
            <div className="space-y-1">
              <Label>Minimum ATT&CK tactic tags</Label>
              <Input
                value={minTacticTags}
                onChange={(event) => setMinTacticTags(event.target.value)}
                placeholder="1"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Max allowed warnings</Label>
            <Input
              value={maxWarnings}
              onChange={(event) => setMaxWarnings(event.target.value)}
              placeholder="3"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="sigma-require-techniques" className="text-sm">Require technique tags</Label>
              <Switch
                id="sigma-require-techniques"
                checked={requireTechniqueTags}
                onChange={(event) => setRequireTechniqueTags(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="sigma-require-tactics" className="text-sm">Require tactic tags</Label>
              <Switch
                id="sigma-require-tactics"
                checked={requireTacticTags}
                onChange={(event) => setRequireTacticTags(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="sigma-require-id" className="text-sm">Require rule ID</Label>
              <Switch
                id="sigma-require-id"
                checked={requireRuleId}
                onChange={(event) => setRequireRuleId(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="sigma-require-translation" className="text-sm">Require translation output</Label>
              <Switch
                id="sigma-require-translation"
                checked={requireTranslatorOutput}
                onChange={(event) => setRequireTranslatorOutput(event.target.checked)}
              />
            </div>
          </div>
        </div>
      }
      examples={[
        "title: Test Rule\nlogsource:\n  product: windows\ndetection:\n  selection:\n    EventID: 1\n  condition: selection",
      ]}
    />
  )
}
