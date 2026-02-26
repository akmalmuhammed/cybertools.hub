import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  runKevCvePrioritizer,
  type PrioritizationWeights,
  type VulnerabilityPrioritizationResult,
} from "@/lib/utils/kev-prioritizer"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

function priorityColor(priority: string): string {
  if (priority === "P1") return "text-red-600 dark:text-red-400"
  if (priority === "P2") return "text-amber-600 dark:text-amber-400"
  if (priority === "P3") return "text-yellow-600 dark:text-yellow-400"
  return "text-green-600 dark:text-green-400"
}

export default function KevCvePrioritizerTool() {
  const [kevCatalogInput, setKevCatalogInput] = useState("")
  const [weightPreset, setWeightPreset] = useState<"balanced" | "kev-heavy" | "exploit-heavy" | "custom">("balanced")
  const [weights, setWeights] = useState<PrioritizationWeights>({
    kev: 1,
    exploit: 1,
    cvss: 1,
    epss: 1,
    asset: 1,
  })
  const [maxP1Allowed, setMaxP1Allowed] = useState("8")
  const [maxP2Allowed, setMaxP2Allowed] = useState("20")
  const [requireKevCatalog, setRequireKevCatalog] = useState(false)
  const [requireKevInP1, setRequireKevInP1] = useState(true)
  const [requireExploitInP1, setRequireExploitInP1] = useState(false)
  const [minimumP1Score, setMinimumP1Score] = useState("80")
  const [maxEvidenceRows, setMaxEvidenceRows] = useState("300")

  const applyWeightPreset = (preset: "balanced" | "kev-heavy" | "exploit-heavy" | "custom") => {
    setWeightPreset(preset)
    if (preset === "balanced") {
      setWeights({ kev: 1, exploit: 1, cvss: 1, epss: 1, asset: 1 })
      return
    }
    if (preset === "kev-heavy") {
      setWeights({ kev: 1.4, exploit: 1, cvss: 0.9, epss: 1, asset: 1.1 })
      return
    }
    if (preset === "exploit-heavy") {
      setWeights({ kev: 1.1, exploit: 1.5, cvss: 1, epss: 1.2, asset: 1 })
    }
  }

  const process = (input: string) => {
    const prioritization = runKevCvePrioritizer(input, kevCatalogInput, weights)
    prioritization.notes.push(
      `Scoring weights => KEV:${weights.kev.toFixed(2)} Exploit:${weights.exploit.toFixed(2)} CVSS:${weights.cvss.toFixed(2)} EPSS:${weights.epss.toFixed(2)} Asset:${weights.asset.toFixed(2)}.`,
    )

    const findings: ToolFinding[] = []

    const p1Limit = Math.max(0, Number(maxP1Allowed) || 8)
    const p2Limit = Math.max(0, Number(maxP2Allowed) || 20)
    const p1ScoreFloor = Math.max(0, Math.min(100, Number(minimumP1Score) || 80))
    const evidenceLimit = Math.max(20, Math.min(2000, Number(maxEvidenceRows) || 300))

    if (prioritization.summary.total === 0) {
      findings.push({
        id: "kev-priority-no-records",
        severity: "info",
        confidence: 74,
        category: "input-quality",
        title: "No CVE records prioritized",
        description: "Input did not produce parseable vulnerability records.",
        remediation: "Provide free-form CVE lines, CSV, or NVD feed JSON for prioritization.",
      })
    }

    if (requireKevCatalog && !kevCatalogInput.trim()) {
      findings.push({
        id: "kev-priority-catalog-required",
        severity: "medium",
        confidence: 76,
        category: "data-source-governance",
        title: "KEV catalog input required by policy",
        description: "Policy requires KEV catalog context but catalog input is empty.",
        remediation: "Provide CISA KEV catalog IDs or feed export before final prioritization.",
      })
    }

    if (prioritization.summary.p1 > p1Limit) {
      findings.push({
        id: "kev-priority-p1-over-limit",
        severity: prioritization.summary.p1 > p1Limit + 5 ? "high" : "medium",
        confidence: 82,
        category: "remediation-capacity",
        title: "P1 queue exceeds operational capacity threshold",
        description: `P1 count=${prioritization.summary.p1}, max allowed=${p1Limit}.`,
        remediation: "Apply tighter exploitation/asset context filters or scale remediation capacity.",
      })
    }

    if (prioritization.summary.p2 > p2Limit) {
      findings.push({
        id: "kev-priority-p2-over-limit",
        severity: "low",
        confidence: 70,
        category: "remediation-capacity",
        title: "P2 queue exceeds threshold",
        description: `P2 count=${prioritization.summary.p2}, max allowed=${p2Limit}.`,
        remediation: "Re-rank medium-priority workload by exploitability and business criticality.",
      })
    }

    const p1Items = prioritization.items.filter((item) => item.priority === "P1")

    if (requireKevInP1) {
      const p1WithoutKev = p1Items.filter((item) => !item.kev)
      if (p1WithoutKev.length > 0) {
        findings.push({
          id: "kev-priority-p1-without-kev",
          severity: "medium",
          confidence: 77,
          category: "prioritization-policy",
          title: "P1 items lack KEV confirmation",
          description: `${p1WithoutKev.length} P1 item(s) are not KEV flagged.`,
          remediation: "Review P1 scoring weights to ensure KEV signals dominate urgent queues where required.",
        })
      }
    }

    if (requireExploitInP1) {
      const p1WithoutExploit = p1Items.filter((item) => !item.hasPublicExploit)
      if (p1WithoutExploit.length > 0) {
        findings.push({
          id: "kev-priority-p1-without-exploit",
          severity: "medium",
          confidence: 75,
          category: "prioritization-policy",
          title: "P1 items without exploit signal",
          description: `${p1WithoutExploit.length} P1 item(s) have no public exploit/PoC signal.`,
          remediation: "Require stronger exploitation evidence for urgent prioritization tiers.",
        })
      }
    }

    const p1BelowScoreFloor = p1Items.filter((item) => item.score < p1ScoreFloor)
    if (p1BelowScoreFloor.length > 0) {
      findings.push({
        id: "kev-priority-p1-score-below-floor",
        severity: "medium",
        confidence: 79,
        category: "prioritization-policy",
        title: "P1 score floor violated",
        description: `${p1BelowScoreFloor.length} P1 item(s) scored below configured floor ${p1ScoreFloor}.`,
        remediation: "Align priority mapping and weighting model with score floor policy.",
      })
    }

    const exploitHighButLowPriority = prioritization.items.filter(
      (item) => item.hasPublicExploit && item.priority === "P4",
    )
    if (exploitHighButLowPriority.length > 0) {
      findings.push({
        id: "kev-priority-exploit-underprioritized",
        severity: "high",
        confidence: 84,
        category: "risk-prioritization",
        title: "Exploit-signaled CVEs deprioritized to P4",
        description: `${exploitHighButLowPriority.length} CVE(s) with exploit signal were ranked P4.`,
        remediation: "Increase exploit and KEV weights or adjust policy mapping thresholds.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "KEV/CVE prioritization completed",
      text: `Prioritized ${prioritization.summary.total} CVE(s): P1=${prioritization.summary.p1}, P2=${prioritization.summary.p2}, P3=${prioritization.summary.p3}, P4=${prioritization.summary.p4}.`,
      findings,
      metrics: {
        total: prioritization.summary.total,
        p1: prioritization.summary.p1,
        p2: prioritization.summary.p2,
        p3: prioritization.summary.p3,
        p4: prioritization.summary.p4,
      },
      baseScore: 92,
    })

    const evidenceRows = prioritization.items.map((item) => ({
      cve: item.cve,
      priority: item.priority,
      score: item.score,
      kev: item.kev,
      hasPublicExploit: item.hasPublicExploit,
      cvss: item.cvss,
      epss: item.epss,
      assetCriticality: item.assetCriticality,
      reasons: item.reasons,
    }))

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "KEV/CVE Prioritizer",
        summary,
        findings,
        evidence: evidenceRows.slice(0, evidenceLimit),
        recommendations: [
          "Use policy thresholds on P1/P2 volumes to align remediation queues with team capacity.",
          "Continuously calibrate weights against KEV/exploit trends and incident outcomes.",
          "Validate urgent priorities with environment exposure and asset criticality context.",
        ],
        raw: {
          prioritization,
          config: {
            weightPreset,
            weights,
            p1Limit,
            p2Limit,
            requireKevCatalog,
            requireKevInP1,
            requireExploitInP1,
            p1ScoreFloor,
            evidenceLimit,
          },
          evidenceTruncated: evidenceRows.length > evidenceLimit,
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null

    const envelope = parseToolResultEnvelope(output, "KEV/CVE Prioritizer")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null
    const parsed = raw?.prioritization as VulnerabilityPrioritizationResult | undefined
    const config = raw?.config && typeof raw.config === "object" && raw.config !== null
      ? (raw.config as Record<string, unknown>)
      : null

    if (!parsed) return null

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-5 gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold text-muted-foreground uppercase">Total</div>
            <div className="text-xl font-semibold">{parsed.summary.total}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold text-muted-foreground uppercase">P1</div>
            <div className="text-xl font-semibold text-red-600 dark:text-red-400">{parsed.summary.p1}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold text-muted-foreground uppercase">P2</div>
            <div className="text-xl font-semibold text-amber-600 dark:text-amber-400">{parsed.summary.p2}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold text-muted-foreground uppercase">P3</div>
            <div className="text-xl font-semibold text-yellow-600 dark:text-yellow-400">{parsed.summary.p3}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold text-muted-foreground uppercase">P4</div>
            <div className="text-xl font-semibold text-green-600 dark:text-green-400">{parsed.summary.p4}</div>
          </div>
        </div>

        {config && (
          <div className="text-xs text-muted-foreground">
            Profile: {String(config.weightPreset ?? "balanced")} | P1 cap: {String(config.p1Limit ?? "8")} | P2 cap: {String(config.p2Limit ?? "20")}
          </div>
        )}

        <div className="space-y-2">
          {parsed.items.map((item) => (
            <div key={item.cve} className="p-3 border rounded bg-muted/20 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono font-semibold">{item.cve}</div>
                <div className={`font-semibold ${priorityColor(item.priority)}`}>
                  {item.priority} ({item.score})
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                CVSS: {item.cvss ?? "N/A"} | EPSS: {item.epss === null ? "N/A" : `${(item.epss * 100).toFixed(1)}%`} | Asset: {item.assetCriticality}
              </div>
              <div className="text-xs text-muted-foreground">
                Formula transparency: Score combines KEV, exploit signal, CVSS, EPSS, and asset criticality weights.
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                {item.reasons.map((reason, index) => (
                  <li key={index}>• {reason}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {parsed.notes.length > 0 && (
          <div className="p-3 border rounded bg-muted/20">
            <h3 className="text-sm font-semibold mb-2">Notes</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              {parsed.notes.map((note, index) => (
                <li key={index}>• {note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <ToolTemplate
      toolName="KEV/CVE Prioritizer"
      description="Prioritize vulnerabilities with KEV/exploit-aware policy gates, capacity thresholds, and enterprise evidence output."
      actionLabel="Prioritize CVEs"
      placeholder="CVE-2024-3094 cvss=10 epss=0.98 critical exploit (or paste NVD feed JSON)"
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Weight Profile</Label>
            <Tabs
              value={weightPreset}
              onValueChange={(value) => {
                if (value === "balanced" || value === "kev-heavy" || value === "exploit-heavy" || value === "custom") {
                  applyWeightPreset(value)
                }
              }}
              className="w-full"
            >
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="balanced">Balanced</TabsTrigger>
                <TabsTrigger value="kev-heavy">KEV Heavy</TabsTrigger>
                <TabsTrigger value="exploit-heavy">Exploit Heavy</TabsTrigger>
                <TabsTrigger value="custom">Custom</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid sm:grid-cols-5 gap-2">
            {([
              ["kev", "KEV"],
              ["exploit", "Exploit"],
              ["cvss", "CVSS"],
              ["epss", "EPSS"],
              ["asset", "Asset"],
            ] as Array<[keyof PrioritizationWeights, string]>).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input
                  value={weights[key]}
                  onChange={(event) => {
                    const parsed = Number(event.target.value)
                    if (Number.isFinite(parsed)) {
                      setWeightPreset("custom")
                      setWeights((prev) => ({ ...prev, [key]: Math.max(0, Math.min(2, parsed)) }))
                    }
                  }}
                />
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Max P1 allowed</Label>
              <Input
                value={maxP1Allowed}
                onChange={(event) => setMaxP1Allowed(event.target.value)}
                placeholder="8"
              />
            </div>
            <div className="space-y-1">
              <Label>Max P2 allowed</Label>
              <Input
                value={maxP2Allowed}
                onChange={(event) => setMaxP2Allowed(event.target.value)}
                placeholder="20"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Minimum score for P1</Label>
              <Input
                value={minimumP1Score}
                onChange={(event) => setMinimumP1Score(event.target.value)}
                placeholder="80"
              />
            </div>
            <div className="space-y-1">
              <Label>Max evidence rows</Label>
              <Input
                value={maxEvidenceRows}
                onChange={(event) => setMaxEvidenceRows(event.target.value)}
                placeholder="300"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>CISA KEV Catalog Input (optional)</Label>
            <Textarea
              value={kevCatalogInput}
              onChange={(event) => setKevCatalogInput(event.target.value)}
              placeholder="Paste KEV CVE IDs (or full KEV export text)..."
              className="min-h-[120px] font-mono text-xs"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="kev-require-catalog" className="text-sm">Require KEV catalog input</Label>
              <Switch
                id="kev-require-catalog"
                checked={requireKevCatalog}
                onChange={(event) => setRequireKevCatalog(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="kev-require-in-p1" className="text-sm">Require KEV signal for P1</Label>
              <Switch
                id="kev-require-in-p1"
                checked={requireKevInP1}
                onChange={(event) => setRequireKevInP1(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 sm:col-span-2">
              <Label htmlFor="kev-require-exploit-p1" className="text-sm">Require exploit signal for P1</Label>
              <Switch
                id="kev-require-exploit-p1"
                checked={requireExploitInP1}
                onChange={(event) => setRequireExploitInP1(event.target.checked)}
              />
            </div>
          </div>
        </div>
      }
      examples={[
        "CVE-2024-3094 cvss=10 epss=0.98 critical exploit\nCVE-2023-23397 cvss=9.8 epss=0.74 high",
        "{\"vulnerabilities\":[{\"cve\":{\"id\":\"CVE-2024-3094\",\"metrics\":{\"cvssMetricV31\":[{\"cvssData\":{\"baseScore\":10}}]},\"references\":[{\"url\":\"https://example.com/exploit\",\"tags\":[\"Exploit\"]}]}}]}",
        "cve,cvss,epss,kev,public_exploit,asset_criticality\nCVE-2024-12345,9.8,0.65,true,true,critical",
      ]}
    />
  )
}
