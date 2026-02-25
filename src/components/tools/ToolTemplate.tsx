import { useState, useCallback, ReactNode, useEffect, useMemo } from "react"
import { motion } from "framer-motion"
import { CopyButton } from "@/components/features/CopyButton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Trash2, ArrowRight } from "lucide-react"

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
  getToolSensitivity,
  getToolProcessingMode,
} from "@/lib/constants/tool-trust"

interface ToolTemplateProps {
  toolName: string
  description: string
  placeholder?: string
  initialInput?: string
  requiresInput?: boolean
  onProcess: (input: string) => Promise<string> | string
  examples?: string[]
  controls?: ReactNode
  renderOutput?: (output: string) => ReactNode
  actionLabel?: string
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
  const { toast } = useToast()

  const location = useLocation()
  const { addToHistory } = useHistoryStore()
  const currentTool = useMemo(
    () => TOOLS.find((tool) => tool.path === location.pathname) ?? null,
    [location.pathname],
  )
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

  const usageSteps = useMemo(() => {
    if (!currentTool) return []
    const steps = [
      "Review tool mode and sensitivity badges before processing.",
      "Paste or upload data in the input panel.",
      `Run ${actionLabel.toLowerCase()} and inspect the generated output.`,
      "Copy results or move to a related tool for follow-on analysis.",
    ]

    if (processingMode === "network") {
      steps.splice(1, 0, "Confirm outbound lookups are expected for this workflow.")
    } else if (processingMode === "hybrid") {
      steps.splice(1, 0, "Choose local-only or outbound-enrichment mode based on data sensitivity.")
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

  const handleProcess = useCallback(async () => {
    if (requiresInput && !input.trim()) return

    setIsLoading(true)
    setError(null)
    try {
      const result = await onProcess(input)
      setOutput(result)
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
  }, [input, onProcess, toast, requiresInput])

  const handleClear = () => {
    setInput("")
    setOutput("")
    setError(null)
  }

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
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">How to use {currentTool.name}</h2>
            {toolSummarySentence && (
              <p className="text-sm text-muted-foreground">{toolSummarySentence}</p>
            )}
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
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Related Tools</h3>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>Enter the data you want to process</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <Textarea
              placeholder={placeholder}
              className="min-h-[300px] font-mono text-sm resize-none"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            {controls && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                {controls}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button onClick={handleProcess} disabled={isLoading || (requiresInput && !input.trim())} className="flex-1">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {actionLabel}
              </Button>
              <Button variant="outline" size="icon" onClick={handleClear} disabled={!input && !output}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full flex flex-col bg-muted/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Output</CardTitle>
                <CardDescription>Results will appear here</CardDescription>
              </div>
              {output && <CopyButton text={output} />}
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            {error ? (
              <div className="h-full flex items-center justify-center text-destructive p-4 text-center bg-destructive/10 rounded-lg border border-destructive/20">
                <p>{error}</p>
              </div>
            ) : output ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative h-full"
              >
                {renderOutput ? renderOutput(output) : (
                  <pre className="h-full min-h-[300px] p-4 rounded-lg bg-background border overflow-auto text-sm font-mono whitespace-pre-wrap break-all">
                    {output}
                  </pre>
                )}
              </motion.div>
            ) : (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                <ArrowRight className="h-8 w-8 mb-2 opacity-50" />
                <p>Process input to see results</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {examples.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Examples</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {examples.map((example, i) => (
              <Card key={i} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setInput(example)}>
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
