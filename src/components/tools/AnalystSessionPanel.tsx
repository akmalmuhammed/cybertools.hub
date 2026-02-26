import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import type { AnalystRunRecord } from "@/lib/hooks/useAnalystSession"

interface AnalystSessionPanelProps {
  caseId: string
  setCaseId: (value: string) => void
  caseOwner: string
  setCaseOwner: (value: string) => void
  caseTags: string
  setCaseTags: (value: string) => void
  normalizedTags: string[]
  runs: AnalystRunRecord[]
  onClearRuns: () => void
}

function scoreTone(score: number | null): string {
  if (typeof score !== "number") return "text-muted-foreground"
  if (score >= 85) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 70) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

function formatRunTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function AnalystSessionPanel({
  caseId,
  setCaseId,
  caseOwner,
  setCaseOwner,
  caseTags,
  setCaseTags,
  normalizedTags,
  runs,
  onClearRuns,
}: AnalystSessionPanelProps) {
  return (
    <section className="rounded-xl border border-border/60 bg-card/55 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Investigation Session</h2>
        <div className="text-xs text-muted-foreground">{runs.length} run{runs.length === 1 ? "" : "s"}</div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="session-case-id" className="text-xs text-muted-foreground">Case ID</Label>
          <Input
            id="session-case-id"
            value={caseId}
            onChange={(event) => setCaseId(event.target.value)}
            placeholder="INC-2026-001"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="session-owner" className="text-xs text-muted-foreground">Owner</Label>
          <Input
            id="session-owner"
            value={caseOwner}
            onChange={(event) => setCaseOwner(event.target.value)}
            placeholder="analyst@team"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="session-tags" className="text-xs text-muted-foreground">Tags (comma-separated)</Label>
          <Input
            id="session-tags"
            value={caseTags}
            onChange={(event) => setCaseTags(event.target.value)}
            placeholder="phishing,priority-high"
            className="h-8 text-xs"
          />
        </div>
      </div>

      {normalizedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {normalizedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {runs.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Recent Runs</div>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClearRuns}>
              Clear
            </Button>
          </div>
          <div className="space-y-1 max-h-[230px] overflow-auto pr-1">
            {runs.map((run) => (
              <div key={run.id} className="rounded-md border border-border/60 bg-background/60 px-2.5 py-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{formatRunTimestamp(run.executedAt)}</div>
                  <div className={`font-semibold uppercase ${scoreTone(run.score)}`}>
                    {run.status} {typeof run.score === "number" ? `| ${run.score}` : ""}
                  </div>
                </div>
                <div className="mt-1 text-muted-foreground">
                  {run.summary} | {run.findings} findings | {run.durationMs} ms{run.mode ? ` | ${run.mode}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border/60 px-3 py-4 text-xs text-muted-foreground">
          No recorded runs yet. Capture or execute an analysis run to build traceability.
        </div>
      )}
    </section>
  )
}
