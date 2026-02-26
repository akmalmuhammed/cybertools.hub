import type { ToolResultSummary } from "@/types/tool.types"

export interface HashRunReport {
  status: ToolResultSummary["status"]
  score: number | null
  findings: number
  summary: string
  durationMs: number
  mode: string
  metrics?: Record<string, number>
}
