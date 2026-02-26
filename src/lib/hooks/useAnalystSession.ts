import { useCallback, useMemo, useState } from "react"
import type { ToolResultSummary } from "@/types/tool.types"

export interface AnalystRunRecord {
  id: string
  executedAt: string
  durationMs: number
  status: ToolResultSummary["status"]
  score: number | null
  findings: number
  summary: string
  mode?: string
  metrics?: Record<string, number>
}

interface RecordRunInput {
  durationMs: number
  status: ToolResultSummary["status"]
  score: number | null
  findings: number
  summary: string
  mode?: string
  metrics?: Record<string, number>
}

export function useAnalystSession(toolId: string) {
  const [caseId, setCaseId] = useState("")
  const [caseOwner, setCaseOwner] = useState("")
  const [caseTags, setCaseTags] = useState("")
  const [runs, setRuns] = useState<AnalystRunRecord[]>([])

  const normalizedTags = useMemo(
    () => caseTags.split(",").map((tag) => tag.trim()).filter((tag) => tag.length > 0).slice(0, 12),
    [caseTags],
  )

  const recordRun = useCallback((input: RecordRunInput) => {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const next: AnalystRunRecord = {
      id,
      executedAt: new Date().toISOString(),
      durationMs: Math.max(1, Math.round(input.durationMs)),
      status: input.status,
      score: input.score,
      findings: input.findings,
      summary: input.summary,
      mode: input.mode,
      metrics: input.metrics,
    }
    setRuns((previous) => [next, ...previous].slice(0, 25))
    return next
  }, [])

  const clearRuns = useCallback(() => setRuns([]), [])

  const buildContext = useCallback(() => {
    return {
      toolId,
      exportedAt: new Date().toISOString(),
      case: {
        id: caseId || null,
        owner: caseOwner || null,
        tags: normalizedTags,
      },
      recentRuns: runs.slice(0, 10),
    }
  }, [caseId, caseOwner, normalizedTags, runs, toolId])

  const attachContext = useCallback(<TPayload extends object>(payload: TPayload) => {
    return {
      ...payload,
      context: buildContext(),
    }
  }, [buildContext])

  return {
    caseId,
    setCaseId,
    caseOwner,
    setCaseOwner,
    caseTags,
    setCaseTags,
    normalizedTags,
    runs,
    recordRun,
    clearRuns,
    buildContext,
    attachContext,
  }
}
