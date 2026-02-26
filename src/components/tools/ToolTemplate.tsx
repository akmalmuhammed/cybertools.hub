import { useState, useCallback, ReactNode, useEffect, useMemo } from "react"
import { motion } from "framer-motion"
import { CopyButton } from "@/components/features/CopyButton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, Trash2, ArrowRight, Download, FileDown, FileJson2, FileSpreadsheet, FileText, Keyboard } from "lucide-react"

import { useHistoryStore } from "@/store/useHistoryStore"
import { Link, useLocation } from "react-router-dom"
import { TOOLS } from "@/lib/constants/tools"
import { SEO } from "@/components/features/SEO"
import { getDomainById, getDomainCanonicalPath, getToolDomainId } from "@/lib/constants/tool-domains"
import { ToolTrustBadges } from "@/components/tools/ToolTrustBadges"
import {
  getProcessingDescription,
  getProcessingLabel,
  getSensitivityLabel,
  getToolOutboundSummary,
  getToolSensitivity,
  getToolProcessingMode,
} from "@/lib/constants/tool-trust"
import {
  getToolCapability,
  getToolCapabilitySummary,
  getToolDefaultPanels,
} from "@/lib/constants/tool-capabilities"
import {
  envelopeToMarkdown,
  parseToolResultEnvelope,
  recordsToCsv,
} from "@/lib/utils/tool-results"
import type { ToolDefaultPanel, ToolOutboundPolicy, ToolResultSummary } from "@/types/tool.types"

export interface ToolProcessContext {
  localOnly: boolean
  toolId?: string
  outboundPolicy: ToolOutboundPolicy
}

interface ToolRunRecord {
  id: string
  executedAt: string
  durationMs: number
  inputChars: number
  findings: number
  score: number | null
  status: ToolResultSummary["status"]
  localOnly: boolean
}

interface ToolTemplateProps {
  toolName: string
  description: string
  placeholder?: string
  initialInput?: string
  requiresInput?: boolean
  onProcess: (input: string, context: ToolProcessContext) => Promise<string> | string
  examples?: string[]
  controls?: ReactNode
  renderOutput?: (output: string) => ReactNode
  actionLabel?: string
}

function formatMetricLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/^./, (char) => char.toUpperCase())
}

function scoreClass(score: number | null): string {
  if (typeof score !== "number") return "text-muted-foreground"
  if (score >= 85) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 70) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

function toRecordArray(items: unknown[]): Array<Record<string, unknown>> {
  return items
    .map((item) => {
      if (typeof item === "object" && item !== null && !Array.isArray(item)) {
        return item as Record<string, unknown>
      }
      return { value: item }
    })
}

function downloadTextFile(fileName: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function formatRunTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function ToolTemplate({
  toolName,
  description,
  placeholder = "Enter text here...",
  initialInput = "",
  requiresInput = true,
  onProcess,
  examples = [],
  controls,
  renderOutput,
  actionLabel = "Process"
}: ToolTemplateProps) {
  const [input, setInput] = useState(initialInput)
  const [output, setOutput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localOnlyMode, setLocalOnlyMode] = useState(true)
  const [caseId, setCaseId] = useState("")
  const [caseOwner, setCaseOwner] = useState("")
  const [caseTags, setCaseTags] = useState("")
  const [runHistory, setRunHistory] = useState<ToolRunRecord[]>([])
  const { toast } = useToast()

  const location = useLocation()
  const { addToHistory } = useHistoryStore()
  const currentTool = useMemo(
    () => TOOLS.find((tool) => tool.path === location.pathname) ?? null,
    [location.pathname],
  )
  const currentToolId = currentTool?.id ?? null
  const currentDomain = currentTool
    ? getDomainById(getToolDomainId(currentTool.id))
    : null

  useEffect(() => {
    if (currentTool) {
      addToHistory(currentTool.id)
    }
  }, [currentTool, addToHistory])

  const seoKeywords = useMemo(() => {
    if (!currentTool) return ["cybersecurity tools", "browser security utilities", "secutil"]
    return Array.from(
      new Set([
        ...currentTool.keywords,
        currentTool.name.toLowerCase(),
        "cybersecurity tool",
        "local-first security",
        `${currentDomain?.name ?? "security"} tooling`,
        "secutil",
      ]),
    )
  }, [currentTool, currentDomain])

  const processingMode = currentTool ? getToolProcessingMode(currentTool.id) : null
  const processingLabel = processingMode ? getProcessingLabel(processingMode) : null
  const processingDescription = processingMode ? getProcessingDescription(processingMode) : null
  const sensitivity = currentTool ? getToolSensitivity(currentTool.id) : null
  const sensitivityLabel = sensitivity ? getSensitivityLabel(sensitivity) : null
  const outboundSummary = currentTool ? getToolOutboundSummary(currentTool.id) : null
  const capability = currentTool ? getToolCapability(currentTool.id) : null
  const capabilitySummary = currentTool ? getToolCapabilitySummary(currentTool.id) : null
  const defaultPanels = useMemo<ToolDefaultPanel[]>(
    () => (currentToolId ? getToolDefaultPanels(currentToolId) : ["findings", "evidence", "export"]),
    [currentToolId],
  )

  useEffect(() => {
    if (!outboundSummary) {
      setLocalOnlyMode(true)
      return
    }
    if (outboundSummary.policy === "none") {
      setLocalOnlyMode(true)
      return
    }
    if (outboundSummary.policy === "optional") {
      setLocalOnlyMode(true)
      return
    }
    setLocalOnlyMode(false)
  }, [outboundSummary])

  const usageSteps = useMemo(() => {
    if (!currentTool) return []
    const steps = [
      "Review tool mode, outbound policy, and sensitivity badges before processing.",
      "Paste data (or use file/batch options where supported).",
      `Run ${actionLabel.toLowerCase()} and triage findings/evidence panels.`,
      "Export JSON/CSV/Markdown evidence pack for downstream workflows.",
    ]

    if (processingMode === "network") {
      steps.splice(1, 0, "Confirm outbound requests are expected for this network-required workflow.")
    } else if (processingMode === "hybrid") {
      steps.splice(1, 0, "Use Local-only mode for sensitive payloads and enable network only when required.")
    }

    return steps
  }, [actionLabel, currentTool, processingMode])

  const relatedTools = useMemo(() => {
    if (!currentTool) return []

    const keywordSet = new Set(currentTool.keywords.map((keyword) => keyword.toLowerCase()))
    const evidenceTagSet = new Set(currentTool.evidenceTags)

    return TOOLS
      .filter((candidate) => candidate.id !== currentTool.id && candidate.status !== "planned")
      .map((candidate) => {
        const sharedKeywords = candidate.keywords.filter((keyword) => keywordSet.has(keyword.toLowerCase())).length
        const sharedEvidenceTags = candidate.evidenceTags.filter((tag) => evidenceTagSet.has(tag)).length
        const domainBoost = candidate.domainId === currentTool.domainId ? 3 : 0

        return {
          candidate,
          score: domainBoost + sharedKeywords + sharedEvidenceTags * 2,
        }
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name))
      .slice(0, 4)
      .map((entry) => entry.candidate)
  }, [currentTool])

  const topSearchIntents = currentTool
    ? Array.from(new Set([...currentTool.keywords, ...currentTool.evidenceTags])).slice(0, 8)
    : []

  const breadcrumbItems = useMemo(() => {
    if (!currentTool) return [{ name: "Home", url: "/" }]
    const domainPath = currentDomain ? getDomainCanonicalPath(currentDomain.id) : "/tools"

    return [
      { name: "Home", url: "/" },
      { name: "Tools", url: "/tools" },
      { name: currentDomain?.name ?? "Domain", url: domainPath },
      { name: currentTool.name, url: currentTool.path },
    ]
  }, [currentDomain, currentTool])

  const seoStructuredData = useMemo(() => {
    if (!currentTool) return undefined

    const faqItems = [
      {
        "@type": "Question",
        name: `What does ${currentTool.name} do?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: currentTool.description,
        },
      },
      {
        "@type": "Question",
        name: `Does ${currentTool.name} send data to external services?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: processingMode === "local"
            ? "No. This tool processes input locally in your browser by default."
            : processingMode === "network"
              ? "Yes. This tool performs outbound lookups and is clearly labeled as network mode."
              : "This tool supports local processing with optional outbound lookups when explicitly triggered.",
        },
      },
      {
        "@type": "Question",
        name: `Who should use ${currentTool.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${currentDomain?.name ?? "Security"} teams that need ${currentTool.description.toLowerCase()}`,
        },
      },
    ]

    return [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: currentTool.name,
        description,
        applicationCategory: currentDomain ? `${currentDomain.name} Tool` : "Security Tool",
        operatingSystem: "Web Browser",
        browserRequirements: "Requires JavaScript-enabled modern browser.",
        softwareHelp: processingMode === "local"
          ? "Runs fully in-browser without network calls."
          : processingMode === "network"
            ? "Performs outbound security lookups."
            : "Supports local processing with optional outbound lookups.",
        isAccessibleForFree: true,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        publisher: {
          "@type": "Organization",
          name: "Secutil",
        },
        url: currentTool.path,
        softwareVersion: "1.0.0",
        keywords: currentTool.keywords.join(", "),
        featureList: [
          `Mode: ${currentTool.processingMode}`,
          `Sensitivity: ${currentTool.sensitivity}`,
          ...currentTool.evidenceTags,
        ],
        additionalProperty: [
          {
            "@type": "PropertyValue",
            name: "processingMode",
            value: currentTool.processingMode,
          },
          {
            "@type": "PropertyValue",
            name: "sensitivity",
            value: currentTool.sensitivity,
          },
          {
            "@type": "PropertyValue",
            name: "evidenceTags",
            value: currentTool.evidenceTags.join(","),
          },
        ],
      },
      {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: `How to use ${currentTool.name}`,
        description: `Operational steps for ${currentTool.name} in Secutil.`,
        totalTime: "PT2M",
        step: usageSteps.map((step, index) => ({
          "@type": "HowToStep",
          position: index + 1,
          name: `Step ${index + 1}`,
          text: step,
        })),
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqItems,
      },
    ]
  }, [currentTool, currentDomain, description, processingMode, usageSteps])

  const toolSummarySentence = currentTool
    ? `${currentTool.name} supports ${currentDomain?.name ?? "security"} workflows with ${currentTool.processingMode} execution and ${currentTool.sensitivity} sensitivity handling.`
    : null

  const normalizedCaseTags = useMemo(
    () => caseTags.split(",").map((tag) => tag.trim()).filter((tag) => tag.length > 0).slice(0, 12),
    [caseTags],
  )

  const parsedEnvelope = useMemo(() => parseToolResultEnvelope(output, toolName), [output, toolName])
  const exportPayload = useMemo(() => {
    return {
      ...parsedEnvelope,
      context: {
        toolId: currentTool?.id ?? null,
        toolPath: currentTool?.path ?? null,
        exportedAt: runHistory[0]?.executedAt ?? new Date().toISOString(),
        localOnlyMode,
        outboundPolicy: outboundSummary?.policy ?? "none",
        case: {
          id: caseId || null,
          owner: caseOwner || null,
          tags: normalizedCaseTags,
        },
        recentRuns: runHistory.slice(0, 8),
      },
    }
  }, [
    caseId,
    caseOwner,
    currentTool?.id,
    currentTool?.path,
    localOnlyMode,
    normalizedCaseTags,
    outboundSummary?.policy,
    parsedEnvelope,
    runHistory,
  ])

  const exportJson = useMemo(() => {
    return JSON.stringify(exportPayload, null, 2)
  }, [exportPayload])
  const findingsCsv = useMemo(() => recordsToCsv(toRecordArray(parsedEnvelope.findings)), [parsedEnvelope.findings])
  const evidenceCsv = useMemo(() => recordsToCsv(toRecordArray(parsedEnvelope.evidence)), [parsedEnvelope.evidence])
  const exportMarkdown = useMemo(() => envelopeToMarkdown(toolName, parsedEnvelope), [parsedEnvelope, toolName])

  const handleProcess = useCallback(async () => {
    if (requiresInput && !input.trim()) return

    if (outboundSummary?.policy === "required" && localOnlyMode) {
      setError("This tool requires outbound requests. Disable Local-only run mode to continue.")
      return
    }

    const startedAt = performance.now()
    const executedAt = new Date().toISOString()
    setIsLoading(true)
    setError(null)
    try {
      const result = await onProcess(input, {
        localOnly: localOnlyMode,
        toolId: currentTool?.id,
        outboundPolicy: outboundSummary?.policy ?? "none",
      })
      setOutput(result)
      const parsedResult = parseToolResultEnvelope(result, toolName)
      const runId = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`
      const durationMs = Math.max(1, Math.round(performance.now() - startedAt))
      setRunHistory((prev) => [
        {
          id: runId,
          executedAt,
          durationMs,
          inputChars: input.length,
          findings: parsedResult.findings.length,
          score: parsedResult.summary.score,
          status: parsedResult.summary.status,
          localOnly: localOnlyMode,
        },
        ...prev,
      ].slice(0, 20))
      toast({
        title: "Processed successfully",
        description: "Your input has been processed.",
      })
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "An error occurred during processing")
      toast({
        title: "Processing Failed",
        description: "Please check your input and try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }, [
    requiresInput,
    input,
    outboundSummary,
    localOnlyMode,
    onProcess,
    currentTool?.id,
    toolName,
    toast,
  ])

  const handleClear = useCallback(() => {
    setInput("")
    setOutput("")
    setError(null)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const accelerator = event.metaKey || event.ctrlKey
      if (accelerator && event.key === "Enter") {
        event.preventDefault()
        void handleProcess()
        return
      }

      if (accelerator && event.shiftKey && (event.key === "C" || event.key === "c")) {
        if (!output) return
        event.preventDefault()
        void navigator.clipboard.writeText(exportJson).then(() => {
          toast({ title: "Copied JSON output", description: "Structured output copied to clipboard." })
        }).catch(() => {
          toast({
            title: "Copy failed",
            description: "Unable to copy output to clipboard.",
            variant: "destructive",
          })
        })
        return
      }

      if (event.key === "Escape") {
        setError(null)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleProcess, output, exportJson, toast])

  const defaultOutputTab = useMemo(() => {
    const prioritizedPanels: ToolDefaultPanel[] = ["findings", "evidence", "export", "history"]
    return prioritizedPanels.find((panel) => defaultPanels.includes(panel)) ?? "findings"
  }, [defaultPanels])

  const findingCounts = useMemo(() => {
    return parsedEnvelope.findings.reduce<Record<string, number>>((acc, finding) => {
      acc[finding.severity] = (acc[finding.severity] ?? 0) + 1
      return acc
    }, {})
  }, [parsedEnvelope.findings])

  return (
    <div className="space-y-6">
      <SEO
        title={toolName}
        description={description}
        canonical={currentTool?.path}
        keywords={seoKeywords}
        breadcrumbItems={breadcrumbItems}
        structuredData={seoStructuredData}
      />

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{toolName}</h1>
        <p className="text-muted-foreground text-lg">{description}</p>
        {currentTool && <ToolTrustBadges toolId={currentTool.id} />}
        {processingMode && (
          <div
            className={
              processingMode === "local"
                ? "rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300"
                : processingMode === "hybrid"
                  ? "rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-700 dark:text-sky-300"
                  : "rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"
            }
          >
            <span className="font-semibold">{processingLabel}:</span> {processingDescription}
            {sensitivityLabel && (
              <span className="ml-2">Sensitivity: <span className="font-semibold">{sensitivityLabel}</span></span>
            )}
          </div>
        )}
        {currentTool && currentTool.evidenceTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {currentTool.evidenceTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {currentTool && (
        <section className="rounded-xl border border-border/60 bg-card/55 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Analyst Console</Badge>
            {capability && (
              <Badge variant="secondary">
                {capability.inputModes.join("/")} input
              </Badge>
            )}
            {capability?.supportsBatch && <Badge variant="secondary">Batch-ready</Badge>}
            {capability?.supportsLocalOnly && <Badge variant="secondary">Local-only supported</Badge>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-lg border border-border/60 bg-background/60 p-3">
              <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Status</div>
              <div className="text-lg font-semibold capitalize">{parsedEnvelope.summary.status}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 p-3">
              <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Score</div>
              <div className={`text-lg font-semibold ${scoreClass(parsedEnvelope.summary.score)}`}>
                {typeof parsedEnvelope.summary.score === "number" ? parsedEnvelope.summary.score : "N/A"}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 p-3">
              <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Findings</div>
              <div className="text-lg font-semibold">{parsedEnvelope.findings.length}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 p-3">
              <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Evidence Rows</div>
              <div className="text-lg font-semibold">{parsedEnvelope.evidence.length}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 p-3">
              <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Runs</div>
              <div className="text-lg font-semibold">{runHistory.length}</div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">{toolSummarySentence}</div>
          {capabilitySummary && <div className="text-xs text-muted-foreground">Capability: {capabilitySummary}</div>}

          {outboundSummary && (
            <div className="rounded-lg border border-border/60 bg-background/65 p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">Outbound Activity Expectations</div>
                  <div className="text-xs text-muted-foreground">{outboundSummary.description}</div>
                </div>
                {(outboundSummary.policy === "optional" || outboundSummary.policy === "required") && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="tool-local-only" className="text-xs">Local-only run</Label>
                    <Switch
                      id="tool-local-only"
                      checked={localOnlyMode}
                      onChange={(event) => setLocalOnlyMode(event.target.checked)}
                    />
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                <Keyboard className="h-3.5 w-3.5" />
                <span>Shortcuts: Cmd/Ctrl+Enter run | Cmd/Ctrl+Shift+C copy JSON | Esc clear error</span>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border/60 bg-background/65 p-3 space-y-3">
            <div className="text-sm font-semibold">Investigation Context</div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="tool-case-id" className="text-xs text-muted-foreground">Case ID</Label>
                <Input
                  id="tool-case-id"
                  value={caseId}
                  onChange={(event) => setCaseId(event.target.value)}
                  placeholder="INC-2026-001"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tool-case-owner" className="text-xs text-muted-foreground">Owner</Label>
                <Input
                  id="tool-case-owner"
                  value={caseOwner}
                  onChange={(event) => setCaseOwner(event.target.value)}
                  placeholder="analyst@team"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tool-case-tags" className="text-xs text-muted-foreground">Tags (comma-separated)</Label>
                <Input
                  id="tool-case-tags"
                  value={caseTags}
                  onChange={(event) => setCaseTags(event.target.value)}
                  placeholder="phishing,priority-high"
                  className="h-8 text-xs"
                />
              </div>
            </div>
            {normalizedCaseTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {normalizedCaseTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Context stays local and is appended to JSON exports for incident traceability.
            </div>
          </div>

          {parsedEnvelope.summary.metrics && Object.keys(parsedEnvelope.summary.metrics).length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(parsedEnvelope.summary.metrics).slice(0, 6).map(([key, value]) => (
                <div key={key} className="rounded-md border border-border/60 bg-background/55 px-2.5 py-2 text-xs">
                  <span className="text-muted-foreground">{formatMetricLabel(key)}</span>
                  <span className="ml-2 font-semibold text-foreground">{value}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6">
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>Enter the data you want to process</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <Textarea
              placeholder={placeholder}
              className="min-h-[320px] font-mono text-sm resize-y"
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            {controls && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                {controls}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button onClick={() => void handleProcess()} disabled={isLoading || (requiresInput && !input.trim())} className="flex-1">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {actionLabel}
              </Button>
              <Button variant="outline" size="icon" onClick={handleClear} disabled={!input && !output && !error}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full flex flex-col bg-muted/30">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Output</CardTitle>
                <CardDescription>Findings, evidence, and export packs</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {output && <CopyButton text={exportJson} size="sm" variant="outline" fullWidth={false} />}
                {output && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadTextFile("secutil-output.json", exportJson, "application/json")}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" /> JSON
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 space-y-3">
            {error ? (
              <div className="h-full min-h-[320px] flex items-center justify-center text-destructive p-4 text-center bg-destructive/10 rounded-lg border border-destructive/20">
                <p>{error}</p>
              </div>
            ) : output ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative h-full"
              >
                <Tabs defaultValue={defaultOutputTab} className="w-full">
                  <TabsList className="grid grid-cols-5 w-full">
                    <TabsTrigger value="findings">Findings</TabsTrigger>
                    <TabsTrigger value="evidence">Evidence</TabsTrigger>
                    <TabsTrigger value="export">Export</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                    <TabsTrigger value="raw">Raw</TabsTrigger>
                  </TabsList>

                  <TabsContent value="findings" className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      {(["critical", "high", "medium", "low"] as const).map((level) => (
                        <div key={level} className="rounded-md border border-border/60 bg-background/70 px-2 py-1.5">
                          <div className="uppercase text-muted-foreground">{level}</div>
                          <div className="font-semibold">{findingCounts[level] ?? 0}</div>
                        </div>
                      ))}
                    </div>

                    {parsedEnvelope.findings.length > 0 ? (
                      <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                        {parsedEnvelope.findings.map((finding) => (
                          <div key={finding.id} className="rounded-lg border border-border/60 bg-background/70 p-3 space-y-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-semibold text-sm">{finding.title}</div>
                              <div className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                                {finding.severity} | confidence {finding.confidence}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">{finding.description}</p>
                            <div className="text-xs text-muted-foreground">Category: {finding.category}</div>
                            {finding.remediation && (
                              <div className="text-xs text-emerald-600 dark:text-emerald-400">Remediation: {finding.remediation}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border/60 p-5 text-sm text-muted-foreground">
                        No structured findings detected. Check the Raw tab for full output.
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="evidence" className="space-y-3">
                    {parsedEnvelope.recommendations.length > 0 && (
                      <div className="rounded-lg border border-border/60 bg-background/65 p-3">
                        <div className="text-sm font-semibold mb-1">Recommendations</div>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {parsedEnvelope.recommendations.map((recommendation) => (
                            <li key={recommendation}>- {recommendation}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {parsedEnvelope.evidence.length > 0 ? (
                      <pre className="h-[360px] p-4 rounded-lg bg-background border overflow-auto text-xs font-mono whitespace-pre-wrap break-all">
                        {JSON.stringify(parsedEnvelope.evidence, null, 2)}
                      </pre>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border/60 p-5 text-sm text-muted-foreground">
                        No structured evidence rows were produced.
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="export" className="space-y-3">
                    <div className="grid sm:grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="justify-start"
                        onClick={() => downloadTextFile("secutil-output.json", exportJson, "application/json")}
                      >
                        <FileJson2 className="mr-2 h-4 w-4" /> Export JSON
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-start"
                        onClick={() => downloadTextFile("secutil-report.md", exportMarkdown, "text/markdown")}
                      >
                        <FileText className="mr-2 h-4 w-4" /> Export Markdown Report
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-start"
                        disabled={!findingsCsv}
                        onClick={() => downloadTextFile("secutil-findings.csv", findingsCsv, "text/csv")}
                      >
                        <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Findings CSV
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-start"
                        disabled={!evidenceCsv}
                        onClick={() => downloadTextFile("secutil-evidence.csv", evidenceCsv, "text/csv")}
                      >
                        <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Evidence CSV
                      </Button>
                    </div>

                    {parsedEnvelope.exports.length > 0 && (
                      <div className="rounded-lg border border-border/60 bg-background/65 p-3 space-y-2">
                        <div className="text-sm font-semibold">Tool-native exports</div>
                        {parsedEnvelope.exports.map((exportItem) => (
                          <Button
                            key={`${exportItem.kind}-${exportItem.label}`}
                            variant="outline"
                            size="sm"
                            className="mr-2 mb-2"
                            onClick={() => downloadTextFile(
                              `${exportItem.label.replace(/\s+/g, "-").toLowerCase()}.${exportItem.kind === "markdown" ? "md" : exportItem.kind === "json" ? "json" : exportItem.kind === "csv" ? "csv" : "txt"}`,
                              exportItem.payload,
                              exportItem.kind === "json" ? "application/json" : "text/plain",
                            )}
                          >
                            <FileDown className="mr-1.5 h-3.5 w-3.5" /> {exportItem.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="history" className="space-y-3">
                    {runHistory.length > 0 ? (
                      <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
                        {runHistory.map((run) => (
                          <div key={run.id} className="rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-semibold">{formatRunTimestamp(run.executedAt)}</div>
                              <div className={`uppercase tracking-[0.08em] ${scoreClass(run.score)}`}>
                                {run.status} {typeof run.score === "number" ? `| score ${run.score}` : ""}
                              </div>
                            </div>
                            <div className="mt-1 text-muted-foreground">
                              {run.findings} findings | {run.inputChars} input chars | {run.durationMs} ms | mode {run.localOnly ? "local-only" : "network-enabled"}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border/60 p-5 text-sm text-muted-foreground">
                        No execution history yet. Run the tool to build an analyst trace.
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="raw">
                    {renderOutput ? renderOutput(output) : (
                      <pre className="h-[420px] p-4 rounded-lg bg-background border overflow-auto text-sm font-mono whitespace-pre-wrap break-all">
                        {output}
                      </pre>
                    )}
                  </TabsContent>
                </Tabs>
              </motion.div>
            ) : (
              <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                <ArrowRight className="h-8 w-8 mb-2 opacity-50" />
                <p>Process input to see findings and evidence</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {currentTool && (
        <section className="rounded-xl border border-border/60 bg-card/55 p-4 sm:p-5 space-y-4">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">How to use {currentTool.name}</h2>
            <ol className="space-y-2 text-sm text-muted-foreground">
              {usageSteps.map((step, index) => (
                <li key={step} className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-[11px] font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {topSearchIntents.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Search Intents</h3>
              <div className="flex flex-wrap gap-1.5">
                {topSearchIntents.map((intent) => (
                  <span
                    key={intent}
                    className="inline-flex items-center rounded-md border border-border/60 bg-background/60 px-2 py-1 text-xs text-muted-foreground"
                  >
                    {intent}
                  </span>
                ))}
              </div>
            </div>
          )}

          {relatedTools.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Next-Step Tool Chain</h3>
              <div className="flex flex-wrap gap-2">
                {relatedTools.map((relatedTool) => (
                  <Link
                    key={relatedTool.id}
                    to={relatedTool.path}
                    className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/15 transition-colors"
                  >
                    {relatedTool.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {examples.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Examples</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {examples.map((example, index) => (
              <Card key={index} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setInput(example)}>
                <CardContent className="p-4">
                  <pre className="text-xs text-muted-foreground truncate font-mono">{example}</pre>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
