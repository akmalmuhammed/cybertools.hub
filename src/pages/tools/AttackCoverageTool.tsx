import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import {
  buildAttackCoverageHeatmap,
  type AttackCoverageResult,
} from "@/lib/utils/attack-coverage"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

function parseTacticList(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\s,]+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  )
}

export default function AttackCoverageTool() {
  const [minimumCoverageScore, setMinimumCoverageScore] = useState("70")
  const [minimumMappedRatioPercent, setMinimumMappedRatioPercent] = useState("80")
  const [minimumTacticDiversity, setMinimumTacticDiversity] = useState("6")
  const [minimumTechniqueDiversity, setMinimumTechniqueDiversity] = useState("10")
  const [maximumGapCount, setMaximumGapCount] = useState("2")
  const [requiredTacticsInput, setRequiredTacticsInput] = useState("attack.execution,attack.defense_evasion")
  const [requireAllRulesMapped, setRequireAllRulesMapped] = useState(false)

  const process = (input: string) => {
    const coverage = buildAttackCoverageHeatmap(input)
    const findings: ToolFinding[] = []

    const scoreFloor = Math.max(0, Math.min(100, Number(minimumCoverageScore) || 70))
    const mappedRatioFloor = Math.max(0, Math.min(100, Number(minimumMappedRatioPercent) || 80))
    const tacticFloor = Math.max(1, Number(minimumTacticDiversity) || 6)
    const techniqueFloor = Math.max(1, Number(minimumTechniqueDiversity) || 10)
    const gapLimit = Math.max(0, Number(maximumGapCount) || 2)
    const requiredTactics = parseTacticList(requiredTacticsInput)

    const mappedRatio = coverage.totalRules === 0 ? 0 : (coverage.mappedRules / coverage.totalRules) * 100

    if (coverage.totalRules === 0) {
      findings.push({
        id: "attack-coverage-no-rules",
        severity: "info",
        confidence: 75,
        category: "input-quality",
        title: "No detection rules parsed",
        description: "Coverage builder could not parse any rule metadata from input.",
        remediation: "Provide JSON/YAML rules with ATT&CK tags for coverage analysis.",
      })
    }

    if (coverage.coverageScore < scoreFloor) {
      findings.push({
        id: "attack-coverage-score-below-baseline",
        severity: coverage.coverageScore < Math.max(40, scoreFloor - 20) ? "high" : "medium",
        confidence: 82,
        category: "coverage-governance",
        title: "ATT&CK coverage score below baseline",
        description: `Coverage score ${coverage.coverageScore}% is below minimum ${scoreFloor}%.`,
        remediation: "Expand tactic/technique mapping and close untagged rule gaps.",
      })
    }

    if (mappedRatio < mappedRatioFloor) {
      findings.push({
        id: "attack-coverage-mapped-ratio-low",
        severity: mappedRatio < Math.max(40, mappedRatioFloor - 20) ? "high" : "medium",
        confidence: 80,
        category: "coverage-governance",
        title: "Mapped-rule ratio below threshold",
        description: `Mapped ratio ${mappedRatio.toFixed(2)}% is below minimum ${mappedRatioFloor}%.`,
        remediation: "Tag unmapped rules with ATT&CK metadata and enforce mapping in CI.",
      })
    }

    if (coverage.tactics.length < tacticFloor) {
      findings.push({
        id: "attack-coverage-tactic-diversity-low",
        severity: "medium",
        confidence: 76,
        category: "coverage-diversity",
        title: "Tactic diversity below target",
        description: `Detected ${coverage.tactics.length} tactic(s), minimum required is ${tacticFloor}.`,
        remediation: "Add detections across additional ATT&CK tactics aligned to threat model priorities.",
      })
    }

    if (coverage.techniques.length < techniqueFloor) {
      findings.push({
        id: "attack-coverage-technique-diversity-low",
        severity: "medium",
        confidence: 76,
        category: "coverage-diversity",
        title: "Technique diversity below target",
        description: `Detected ${coverage.techniques.length} technique(s), minimum required is ${techniqueFloor}.`,
        remediation: "Increase technique-specific detection depth for high-risk ATT&CK behaviors.",
      })
    }

    if (coverage.gaps.length > gapLimit) {
      findings.push({
        id: "attack-coverage-gaps-over-limit",
        severity: coverage.gaps.length > gapLimit + 2 ? "high" : "medium",
        confidence: 78,
        category: "gap-management",
        title: "Coverage gap count exceeds threshold",
        description: `${coverage.gaps.length} coverage gap note(s) detected; limit is ${gapLimit}.`,
        remediation: "Prioritize remediation roadmap for reported mapping gaps before next release.",
      })
    }

    if (requiredTactics.length > 0) {
      const observedTactics = new Set(coverage.tactics.map((item) => item.tactic.toLowerCase()))
      const missingRequired = requiredTactics.filter((tactic) => !observedTactics.has(tactic))
      if (missingRequired.length > 0) {
        findings.push({
          id: "attack-coverage-required-tactics-missing",
          severity: "high",
          confidence: 84,
          category: "threat-model-alignment",
          title: "Required ATT&CK tactics missing from coverage",
          description: `Missing required tactic(s): ${missingRequired.join(", ")}.`,
          remediation: "Add rule coverage for missing tactics defined by the threat model baseline.",
        })
      }
    }

    if (requireAllRulesMapped && coverage.totalRules > 0 && coverage.mappedRules < coverage.totalRules) {
      findings.push({
        id: "attack-coverage-unmapped-rules-disallowed",
        severity: "high",
        confidence: 83,
        category: "release-gate",
        title: "Unmapped rules violate strict mapping policy",
        description: `${coverage.totalRules - coverage.mappedRules} rule(s) are missing ATT&CK mappings.`,
        remediation: "Require ATT&CK mapping metadata on every rule before release.",
      })
    }

    if (coverage.coverageScore >= scoreFloor && mappedRatio >= mappedRatioFloor && findings.length === 0) {
      findings.push({
        id: "attack-coverage-healthy",
        severity: "info",
        confidence: 70,
        category: "quality-signal",
        title: "Coverage baselines satisfied",
        description: "Current rule set meets configured ATT&CK coverage baselines.",
        remediation: "Maintain continuous coverage reviews as new threats and assets are onboarded.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "ATT&CK coverage analysis completed",
      text: `Evaluated ${coverage.totalRules} rule(s), mapped ${coverage.mappedRules}, coverage score ${coverage.coverageScore}%.`,
      findings,
      metrics: {
        totalRules: coverage.totalRules,
        mappedRules: coverage.mappedRules,
        coverageScore: coverage.coverageScore,
        tactics: coverage.tactics.length,
        techniques: coverage.techniques.length,
        mappedRatio: Math.round(mappedRatio * 100) / 100,
      },
      baseScore: Math.round(coverage.coverageScore),
    })

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "ATT&CK Coverage Heatmap",
        summary,
        findings,
        evidence: [
          {
            totalRules: coverage.totalRules,
            mappedRules: coverage.mappedRules,
            coverageScore: coverage.coverageScore,
            tactics: coverage.tactics,
            techniques: coverage.techniques,
            gaps: coverage.gaps,
          },
        ],
        recommendations: [
          "Use ATT&CK mapping completeness as a CI gate for new detection content.",
          "Balance tactic breadth and technique depth based on active threat model priorities.",
          "Track coverage gaps longitudinally and assign owners for remediation.",
        ],
        raw: {
          coverage,
          config: {
            scoreFloor,
            mappedRatioFloor,
            tacticFloor,
            techniqueFloor,
            gapLimit,
            requiredTactics,
            requireAllRulesMapped,
          },
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null
    const envelope = parseToolResultEnvelope(output, "ATT&CK Coverage Heatmap")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null
    const parsed = raw?.coverage as AttackCoverageResult | undefined
    const config = raw?.config && typeof raw.config === "object" && raw.config !== null
      ? (raw.config as Record<string, unknown>)
      : null

    if (!parsed) return null

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Rules</div>
            <div className="text-xl font-semibold">{parsed.totalRules}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Mapped</div>
            <div className="text-xl font-semibold">{parsed.mappedRules}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Coverage Score</div>
            <div className="text-xl font-semibold">{parsed.coverageScore}%</div>
          </div>
        </div>

        {config && (
          <div className="text-xs text-muted-foreground">
            Score baseline: {String(config.scoreFloor ?? "70")}% | Mapped baseline: {String(config.mappedRatioFloor ?? "80")}%
          </div>
        )}

        <div className="space-y-2">
          <div className="text-sm font-semibold">Top ATT&CK Tactics</div>
          {parsed.tactics.slice(0, 10).map((tactic) => (
            <div key={tactic.tactic} className="flex items-center justify-between p-2 border rounded bg-muted/20 text-sm">
              <span>{tactic.tactic}</span>
              <span>{tactic.count}</span>
            </div>
          ))}
        </div>

        {parsed.gaps.length > 0 && (
          <div className="p-3 border rounded bg-amber-500/10 border-amber-600/30">
            <div className="text-sm font-semibold mb-2">Coverage Gaps</div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {parsed.gaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <ToolTemplate
      toolName="ATT&CK Coverage Heatmap"
      description="Compute ATT&CK coverage with policy baselines for mapping completeness, tactic diversity, and gap governance."
      actionLabel="Build Coverage"
      placeholder={`[
  {
    "title": "Suspicious PowerShell",
    "tags": ["attack.execution", "attack.t1059.001"]
  }
]`}
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Minimum coverage score (%)</Label>
              <Input
                value={minimumCoverageScore}
                onChange={(event) => setMinimumCoverageScore(event.target.value)}
                placeholder="70"
              />
            </div>
            <div className="space-y-1">
              <Label>Minimum mapped ratio (%)</Label>
              <Input
                value={minimumMappedRatioPercent}
                onChange={(event) => setMinimumMappedRatioPercent(event.target.value)}
                placeholder="80"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Minimum tactic diversity</Label>
              <Input
                value={minimumTacticDiversity}
                onChange={(event) => setMinimumTacticDiversity(event.target.value)}
                placeholder="6"
              />
            </div>
            <div className="space-y-1">
              <Label>Minimum technique diversity</Label>
              <Input
                value={minimumTechniqueDiversity}
                onChange={(event) => setMinimumTechniqueDiversity(event.target.value)}
                placeholder="10"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Maximum allowed gap notes</Label>
              <Input
                value={maximumGapCount}
                onChange={(event) => setMaximumGapCount(event.target.value)}
                placeholder="2"
              />
            </div>
            <div className="space-y-1">
              <Label>Required tactics (comma separated)</Label>
              <Input
                value={requiredTacticsInput}
                onChange={(event) => setRequiredTacticsInput(event.target.value)}
                placeholder="attack.execution,attack.defense_evasion"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
            <Label htmlFor="attack-coverage-require-all" className="text-sm">Require every rule to be ATT&CK mapped</Label>
            <Switch
              id="attack-coverage-require-all"
              checked={requireAllRulesMapped}
              onChange={(event) => setRequireAllRulesMapped(event.target.checked)}
            />
          </div>
        </div>
      }
    />
  )
}
