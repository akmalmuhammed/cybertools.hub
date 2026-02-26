import { useState } from "react"
import { ToolTemplate, type ToolProcessContext } from "@/components/tools/ToolTemplate"
import {
  enrichBulkReputation,
  type BulkReputationResult,
  type ReputationProvider,
} from "@/lib/utils/reputation"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding, ToolFindingSeverity } from "@/types/tool.types"

function riskColor(level: "low" | "medium" | "high"): string {
  if (level === "high") return "text-red-600 dark:text-red-400"
  if (level === "medium") return "text-amber-600 dark:text-amber-400"
  return "text-green-600 dark:text-green-400"
}

function severityFromRisk(level: "low" | "medium" | "high"): ToolFindingSeverity {
  if (level === "high") return "high"
  if (level === "medium") return "medium"
  return "low"
}

function confidenceFromRiskScore(score: number): number {
  if (score >= 90) return 92
  if (score >= 80) return 86
  if (score >= 70) return 80
  if (score >= 50) return 74
  return 66
}

export default function ReputationEnricherTool() {
  const [provider, setProvider] = useState<ReputationProvider>("none")
  const [providerProxyUrl, setProviderProxyUrl] = useState("")
  const [includeRdap, setIncludeRdap] = useState(true)
  const [timeoutMs, setTimeoutMs] = useState("8000")
  const [findingThreshold, setFindingThreshold] = useState("40")
  const [includeLowRiskFindings, setIncludeLowRiskFindings] = useState(false)
  const [maxEvidenceRows, setMaxEvidenceRows] = useState("200")

  const handleProviderChange = (value: string) => {
    if (value === "none" || value === "abuseipdb" || value === "virustotal") {
      setProvider(value)
    }
  }

  const process = async (input: string, context: ToolProcessContext) => {
    const effectiveProvider = context.localOnly ? "none" : provider

    const result = await enrichBulkReputation(input, {
      provider: effectiveProvider,
      providerProxyUrl: providerProxyUrl.trim() || undefined,
      includeRdap,
      timeoutMs: Number(timeoutMs) || 8000,
    })

    if (context.localOnly && provider !== "none") {
      result.notes.push("Local-only run mode forced provider=none to prevent outbound enrichment calls.")
    }

    const threshold = Math.max(0, Math.min(100, Number(findingThreshold) || 40))
    const evidenceLimit = Math.max(10, Math.min(1000, Number(maxEvidenceRows) || 200))

    const findings: ToolFinding[] = []
    result.items.forEach((item, index) => {
      const shouldCreateRiskFinding = item.riskScore >= threshold || (includeLowRiskFindings && item.riskLevel === "low")

      if (shouldCreateRiskFinding) {
        findings.push({
          id: `reputation-risk-${item.indicator.type}-${index}`,
          severity: severityFromRisk(item.riskLevel),
          confidence: confidenceFromRiskScore(item.riskScore),
          category: "threat-intel",
          title: `${item.riskLevel.toUpperCase()} risk indicator: ${item.indicator.value}`,
          description: item.details.length > 0
            ? item.details.slice(0, 3).join(" ")
            : "Indicator has elevated risk score based on enrichment signals.",
          remediation: item.indicator.type === "ip"
            ? "Correlate with network telemetry and enforce block/monitor controls by policy tier."
            : "Validate domain ownership, registration profile, and delivery infrastructure before allowlisting.",
        })
      }

      if (includeRdap && !item.sources.includes("rdap")) {
        findings.push({
          id: `reputation-rdap-gap-${item.indicator.type}-${index}`,
          severity: "low",
          confidence: 70,
          category: "intel-coverage",
          title: `RDAP enrichment gap for ${item.indicator.value}`,
          description: "RDAP was requested but did not appear in enrichment sources for this indicator.",
          remediation: "Retry with increased timeout or validate network path to RDAP services.",
        })
      }

      if (effectiveProvider !== "none" && !item.sources.includes(effectiveProvider)) {
        findings.push({
          id: `reputation-provider-gap-${item.indicator.type}-${index}`,
          severity: "low",
          confidence: 69,
          category: "intel-coverage",
          title: `${effectiveProvider} enrichment unavailable for ${item.indicator.value}`,
          description: `${effectiveProvider} was selected but not reflected in item sources.`,
          remediation: "Validate proxy endpoint behavior, credential mapping, and provider quota/availability.",
        })
      }
    })

    if (result.items.length === 0) {
      findings.push({
        id: "reputation-no-indicators",
        severity: "info",
        confidence: 72,
        category: "input-quality",
        title: "No indicators extracted",
        description: "Input did not contain parseable IP or domain indicators.",
        remediation: "Provide newline/comma separated indicators or mixed text containing IOC artifacts.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "Reputation enrichment completed",
      text: `Enriched ${result.summary.total} indicator(s) with ${effectiveProvider === "none" ? "local/RDAP" : `${effectiveProvider} + local/RDAP`} context.`,
      findings,
      metrics: {
        totalIndicators: result.summary.total,
        highRiskIndicators: result.summary.high,
        mediumRiskIndicators: result.summary.medium,
        lowRiskIndicators: result.summary.low,
        noteCount: result.notes.length,
      },
      baseScore: 92,
    })

    const evidenceItems = result.items.slice(0, evidenceLimit).map((item) => ({
      indicatorType: item.indicator.type,
      indicatorValue: item.indicator.value,
      riskScore: item.riskScore,
      riskLevel: item.riskLevel,
      sources: item.sources,
      details: item.details,
      providerData: item.providerData,
    }))

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "Bulk Domain/IP Reputation Enricher",
        summary,
        findings,
        evidence: evidenceItems,
        recommendations: [
          "Escalate high-risk indicators into containment or deeper triage workflows with supporting telemetry.",
          "Use provider enrichments through controlled backend proxies and monitor lookup coverage gaps.",
          "Continuously tune score thresholds by environment and false-positive tolerance.",
        ],
        raw: {
          reputation: result,
          config: {
            providerRequested: provider,
            providerUsed: effectiveProvider,
            includeRdap,
            threshold,
            evidenceLimit,
            includeLowRiskFindings,
            localOnlyRun: context.localOnly,
          },
          evidenceTruncated: result.items.length > evidenceLimit,
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null
    const envelope = parseToolResultEnvelope(output, "Bulk Domain/IP Reputation Enricher")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null
    const parsed = raw?.reputation as BulkReputationResult | undefined
    const config = raw?.config && typeof raw.config === "object" && raw.config !== null
      ? (raw.config as Record<string, unknown>)
      : null
    const evidenceTruncated = raw?.evidenceTruncated === true

    if (!parsed) return null

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-4 gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold text-muted-foreground uppercase">Total</div>
            <div className="text-xl font-semibold">{parsed.summary.total}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold text-muted-foreground uppercase">High</div>
            <div className="text-xl font-semibold text-red-600 dark:text-red-400">{parsed.summary.high}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold text-muted-foreground uppercase">Medium</div>
            <div className="text-xl font-semibold text-amber-600 dark:text-amber-400">{parsed.summary.medium}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold text-muted-foreground uppercase">Low</div>
            <div className="text-xl font-semibold text-green-600 dark:text-green-400">{parsed.summary.low}</div>
          </div>
        </div>

        {config && (
          <div className="p-3 border rounded bg-muted/20 text-xs text-muted-foreground">
            Provider: {String(config.providerUsed ?? "none")} | RDAP: {config.includeRdap ? "enabled" : "disabled"} | Threshold: {String(config.threshold ?? "40")}
            {evidenceTruncated ? " | Evidence truncated to configured max rows" : ""}
          </div>
        )}

        <div className="space-y-2">
          {parsed.items.map((item) => (
            <div
              key={`${item.indicator.type}-${item.indicator.value}`}
              className="p-3 border rounded bg-muted/20 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-sm break-all">
                  {item.indicator.value} <span className="text-xs text-muted-foreground">({item.indicator.type})</span>
                </div>
                <div className={`font-semibold uppercase ${riskColor(item.riskLevel)}`}>
                  {item.riskLevel} ({item.riskScore})
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Sources: {item.sources.join(", ")}
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                {item.details.map((detail, index) => (
                  <li key={index}>• {detail}</li>
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
      toolName="Bulk Domain/IP Reputation Enricher"
      description="Enrich domain/IP indicators with multi-source scoring, coverage-gap findings, and enterprise-grade triage controls."
      actionLabel="Enrich Indicators"
      placeholder="Paste domains and IPs (one per line or mixed text)..."
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Provider</Label>
            <Tabs value={provider} onValueChange={handleProviderChange} className="w-full">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="none">Local/RDAP</TabsTrigger>
                <TabsTrigger value="abuseipdb">AbuseIPDB</TabsTrigger>
                <TabsTrigger value="virustotal">VirusTotal</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {provider !== "none" && (
            <div className="space-y-1">
              <Label>Provider Proxy URL</Label>
              <Input
                value={providerProxyUrl}
                onChange={(event) => setProviderProxyUrl(event.target.value)}
                placeholder="https://your-proxy.example/reputation"
              />
              <p className="text-xs text-muted-foreground">
                Use your backend proxy. Direct provider API-key calls are intentionally disabled client-side.
              </p>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="reputation-rdap" className="text-sm">Include RDAP enrichment</Label>
              <Switch
                id="reputation-rdap"
                checked={includeRdap}
                onChange={(event) => setIncludeRdap(event.target.checked)}
              />
            </div>
            <div className="space-y-1">
              <Label>Timeout (ms)</Label>
              <Input
                value={timeoutMs}
                onChange={(event) => setTimeoutMs(event.target.value)}
                placeholder="8000"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Risk score threshold for findings</Label>
              <Input
                value={findingThreshold}
                onChange={(event) => setFindingThreshold(event.target.value)}
                placeholder="40"
              />
            </div>
            <div className="space-y-1">
              <Label>Max evidence rows</Label>
              <Input
                value={maxEvidenceRows}
                onChange={(event) => setMaxEvidenceRows(event.target.value)}
                placeholder="200"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
            <Label htmlFor="reputation-low-findings" className="text-sm">Include low-risk findings</Label>
            <Switch
              id="reputation-low-findings"
              checked={includeLowRiskFindings}
              onChange={(event) => setIncludeLowRiskFindings(event.target.checked)}
            />
          </div>
        </div>
      }
      examples={[
        "8.8.8.8\n1.1.1.1\nexample.com\nlogin.example.org",
        "Observed indicators: 203.0.113.10, api.example.com, malware.test",
      ]}
    />
  )
}
