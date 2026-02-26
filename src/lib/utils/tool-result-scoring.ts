import type { ToolFinding, ToolFindingSeverity, ToolResultSummary } from "../../types/tool.types.js"

const FINDING_PENALTIES: Record<ToolFindingSeverity, number> = {
  critical: 28,
  high: 18,
  medium: 10,
  low: 4,
  info: 1,
}

export function countFindingsBySeverity(findings: ToolFinding[]): Record<ToolFindingSeverity, number> {
  return findings.reduce<Record<ToolFindingSeverity, number>>(
    (acc, finding) => {
      acc[finding.severity] += 1
      return acc
    },
    { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
  )
}

export function deriveScoreFromFindings(findings: ToolFinding[], baseScore: number = 100): number {
  const penalty = findings.reduce((total, finding) => total + FINDING_PENALTIES[finding.severity], 0)
  return Math.max(0, Math.min(100, Math.round(baseScore - penalty)))
}

export function deriveSummaryStatus(findings: ToolFinding[]): ToolResultSummary["status"] {
  if (findings.some((finding) => finding.severity === "critical")) return "error"
  if (findings.some((finding) => finding.severity === "high" || finding.severity === "medium" || finding.severity === "low")) {
    return "warning"
  }
  return "ok"
}

export function createSummaryFromFindings(params: {
  title: string
  text: string
  findings: ToolFinding[]
  metrics?: Record<string, number>
  baseScore?: number
}): ToolResultSummary {
  return {
    status: deriveSummaryStatus(params.findings),
    score: deriveScoreFromFindings(params.findings, params.baseScore),
    title: params.title,
    text: params.text,
    metrics: params.metrics,
  }
}
