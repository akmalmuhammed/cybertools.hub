import { useMemo, useState } from "react"
import { HashText } from "@/components/tools/hash/HashText"
import { HashFile } from "@/components/tools/hash/HashFile"
import { HashCompare } from "@/components/tools/hash/HashCompare"
import type { HashRunReport } from "@/components/tools/hash/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SEO } from "@/components/features/SEO"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Download } from "lucide-react"
import { useAnalystSession } from "@/lib/hooks/useAnalystSession"
import { AnalystSessionPanel } from "@/components/tools/AnalystSessionPanel"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { buildToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

interface HashPolicyConfig {
  disallowMd5: boolean
  disallowSha1: boolean
  requireHmacForText: boolean
  requireSaltForText: boolean
  maxBulkItems: number
  maxFileBytes: number
  minCompareHashLength: number
}

function evaluateHashGovernance(
  latestRun: HashRunReport | null,
  config: HashPolicyConfig,
) {
  const findings: ToolFinding[] = []

  if (!latestRun) {
    return buildToolResultEnvelope({
      toolName: "Hash Generator",
      summary: {
        status: "ok",
        score: null,
        title: "Hash governance idle",
        text: "Run a hash workflow to evaluate governance policy gates.",
      },
      findings: [],
      evidence: [],
      recommendations: [
        "Prefer SHA-256/SHA-512 for integrity checks and signing workflows.",
        "Use HMAC for authenticity guarantees where key ownership matters.",
      ],
      raw: { config },
    })
  }

  if (latestRun.status === "error") {
    findings.push({
      id: "hash-run-error",
      severity: "high",
      confidence: 90,
      category: "pipeline-health",
      title: "Hash workflow returned error state",
      description: "Latest hash execution failed and needs operator review.",
      remediation: "Validate input format, client resources, and rerun in controlled mode.",
    })
  }

  const isTextMode = latestRun.mode === "single-text" || latestRun.mode === "bulk-text"
  const isFileMode = latestRun.mode === "file"
  const isCompareMode = latestRun.mode === "compare"

  if ((isTextMode || isFileMode) && config.disallowMd5) {
    findings.push({
      id: "hash-md5-disallowed",
      severity: "medium",
      confidence: 84,
      category: "crypto-governance",
      title: "MD5 output disallowed by policy",
      description: "MD5 is considered cryptographically broken for security-sensitive workflows.",
      remediation: "Use SHA-256 or SHA-512 for trusted integrity and signing workflows.",
    })
  }

  if ((isTextMode || isFileMode) && config.disallowSha1) {
    findings.push({
      id: "hash-sha1-disallowed",
      severity: "medium",
      confidence: 82,
      category: "crypto-governance",
      title: "SHA-1 output disallowed by policy",
      description: "SHA-1 collision resistance is weak for security-sensitive validation.",
      remediation: "Migrate validation pipelines to SHA-256/SHA-512 baselines.",
    })
  }

  if (isTextMode) {
    const processedCount = latestRun.metrics?.processedCount ?? 1
    const hasHmac = (latestRun.metrics?.hasHmac ?? 0) > 0
    const hasSalt = (latestRun.metrics?.hasSalt ?? 0) > 0

    if (processedCount > config.maxBulkItems) {
      findings.push({
        id: "hash-bulk-limit",
        severity: processedCount > config.maxBulkItems * 2 ? "high" : "medium",
        confidence: 79,
        category: "operational-guardrail",
        title: "Bulk hash volume exceeds policy",
        description: `Processed ${processedCount} records; policy limit is ${config.maxBulkItems}.`,
        remediation: "Split bulk datasets into smaller batches to improve review fidelity.",
      })
    }

    if (config.requireHmacForText && !hasHmac) {
      findings.push({
        id: "hash-hmac-required",
        severity: "high",
        confidence: 88,
        category: "authenticity",
        title: "HMAC required for text hashing",
        description: "Policy requires keyed hashing for text payload workflows.",
        remediation: "Set an approved HMAC key before generating production hashes.",
      })
    }

    if (config.requireSaltForText && !hasSalt) {
      findings.push({
        id: "hash-salt-required",
        severity: "medium",
        confidence: 76,
        category: "authenticity",
        title: "Salt required for text hashing",
        description: "Policy requires salt for text hash generation workflows.",
        remediation: "Apply deterministic or managed salt policy before processing.",
      })
    }
  }

  if (isFileMode) {
    const fileBytes = latestRun.metrics?.fileBytes ?? 0
    if (fileBytes > config.maxFileBytes) {
      findings.push({
        id: "hash-file-size-limit",
        severity: fileBytes > config.maxFileBytes * 2 ? "high" : "medium",
        confidence: 83,
        category: "operational-guardrail",
        title: "File size exceeds hashing policy limit",
        description: `File size ${fileBytes} bytes exceeds configured limit ${config.maxFileBytes} bytes.`,
        remediation: "Use chunked preprocessing or split artifacts for policy-compliant hashing.",
      })
    }
  }

  if (isCompareMode) {
    const hashLength = latestRun.metrics?.hashLength ?? 0
    if (hashLength > 0 && hashLength < config.minCompareHashLength) {
      findings.push({
        id: "hash-compare-length-floor",
        severity: "medium",
        confidence: 75,
        category: "integrity-quality",
        title: "Compared hash length below minimum threshold",
        description: `Hash length ${hashLength} is below policy minimum ${config.minCompareHashLength}.`,
        remediation: "Use SHA-256/512 length digests for high-confidence integrity validation.",
      })
    }
  }

  if (findings.length === 0) {
    findings.push({
      id: "hash-governance-pass",
      severity: "info",
      confidence: 71,
      category: "crypto-governance",
      title: "Hash workflow passed policy checks",
      description: "Latest hash execution satisfies configured governance and integrity controls.",
      remediation: "Maintain policy baselines and monitor drift in algorithm usage.",
    })
  }

  const summary = createSummaryFromFindings({
    title: "Hash governance assessment",
    text: latestRun.summary,
    findings,
    metrics: {
      durationMs: latestRun.durationMs,
      findings: findings.length,
      score: typeof latestRun.score === "number" ? latestRun.score : 0,
    },
    baseScore: typeof latestRun.score === "number" ? latestRun.score : 96,
  })

  return buildToolResultEnvelope({
    toolName: "Hash Generator",
    summary,
    findings,
    evidence: [
      {
        mode: latestRun.mode,
        status: latestRun.status,
        runScore: latestRun.score,
        durationMs: latestRun.durationMs,
        metrics: latestRun.metrics ?? {},
      },
    ],
    recommendations: [
      "Prefer SHA-256/SHA-512 for integrity-critical workflows.",
      "Use HMAC for authenticity when validating untrusted transport channels.",
      "Constrain bulk/file workloads with deterministic operational limits.",
    ],
    raw: {
      latestRun,
      config,
    },
  })
}

export default function HashTool() {
  const session = useAnalystSession("hash")
  const [latestRun, setLatestRun] = useState<HashRunReport | null>(null)

  const [disallowMd5, setDisallowMd5] = useState(true)
  const [disallowSha1, setDisallowSha1] = useState(true)
  const [requireHmacForText, setRequireHmacForText] = useState(false)
  const [requireSaltForText, setRequireSaltForText] = useState(false)
  const [maxBulkItemsInput, setMaxBulkItemsInput] = useState("500")
  const [maxFileBytesInput, setMaxFileBytesInput] = useState("104857600")
  const [minCompareHashLengthInput, setMinCompareHashLengthInput] = useState("64")

  const policyConfig = useMemo<HashPolicyConfig>(() => ({
    disallowMd5,
    disallowSha1,
    requireHmacForText,
    requireSaltForText,
    maxBulkItems: Math.max(1, Number(maxBulkItemsInput) || 500),
    maxFileBytes: Math.max(1, Number(maxFileBytesInput) || 104857600),
    minCompareHashLength: Math.max(1, Number(minCompareHashLengthInput) || 64),
  }), [
    disallowMd5,
    disallowSha1,
    requireHmacForText,
    requireSaltForText,
    maxBulkItemsInput,
    maxFileBytesInput,
    minCompareHashLengthInput,
  ])

  const governanceEnvelope = useMemo(
    () => evaluateHashGovernance(latestRun, policyConfig),
    [latestRun, policyConfig],
  )

  const handleRun = (run: HashRunReport) => {
    setLatestRun(run)
    session.recordRun({
      durationMs: run.durationMs,
      status: run.status,
      score: run.score,
      findings: run.findings,
      summary: run.summary,
      mode: run.mode,
      metrics: run.metrics,
    })
  }

  const exportEvidencePack = () => {
    const payload = session.attachContext({
      toolName: "Hash Generator",
      exportedAt: new Date().toISOString(),
      latestRun,
      governance: governanceEnvelope,
      notes: "Hash operations were executed locally in browser.",
    })
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "hash-session-evidence.json"
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <SEO
        title="Hash Generator"
        description="Generate MD5, SHA1, SHA256, and SHA512 hashes locally for text and files, and compare hash integrity values."
        canonical="/tools/hash"
        keywords={[
          "hash generator",
          "sha256 generator",
          "md5 hash tool",
          "file hash checker",
        ]}
        breadcrumbItems={[
          { name: "Home", url: "/" },
          { name: "Tools", url: "/tools" },
          { name: "Data Security & Privacy Engineering", url: "/domains/data-security-privacy-engineering" },
          { name: "Hash Generator", url: "/tools/hash" },
        ]}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Hash Generator",
          applicationCategory: "Application Security Tool",
          operatingSystem: "Any",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
          },
        }}
      />

      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Hash Generator</h1>
        <p className="text-muted-foreground">
          Generate cryptographic hashes for text and files, compare digest values, and enforce enterprise algorithm governance.
        </p>
        <div className="pt-2">
          <Button variant="outline" size="sm" onClick={exportEvidencePack}>
            <Download className="h-4 w-4 mr-2" /> Export Session Evidence
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Governance Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label>Max bulk items</Label>
              <Input value={maxBulkItemsInput} onChange={(event) => setMaxBulkItemsInput(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Max file bytes</Label>
              <Input value={maxFileBytesInput} onChange={(event) => setMaxFileBytesInput(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Min compare hash length</Label>
              <Input value={minCompareHashLengthInput} onChange={(event) => setMinCompareHashLengthInput(event.target.value)} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="hash-disallow-md5">Disallow MD5 in policy score</Label>
              <Switch id="hash-disallow-md5" checked={disallowMd5} onChange={(event) => setDisallowMd5(event.target.checked)} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="hash-disallow-sha1">Disallow SHA-1 in policy score</Label>
              <Switch id="hash-disallow-sha1" checked={disallowSha1} onChange={(event) => setDisallowSha1(event.target.checked)} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="hash-require-hmac">Require HMAC for text runs</Label>
              <Switch
                id="hash-require-hmac"
                checked={requireHmacForText}
                onChange={(event) => setRequireHmacForText(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="hash-require-salt">Require salt for text runs</Label>
              <Switch
                id="hash-require-salt"
                checked={requireSaltForText}
                onChange={(event) => setRequireSaltForText(event.target.checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Governance Findings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Status: {governanceEnvelope.summary.status}</Badge>
            <Badge variant="secondary">
              Score: {typeof governanceEnvelope.summary.score === "number" ? governanceEnvelope.summary.score : "n/a"}
            </Badge>
            <Badge variant="secondary">Findings: {governanceEnvelope.findings.length}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{governanceEnvelope.summary.text}</p>
          {governanceEnvelope.findings.length > 0 ? (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {governanceEnvelope.findings.slice(0, 5).map((finding) => (
                <li key={finding.id}>[{finding.severity.toUpperCase()}] {finding.title}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No findings yet.</p>
          )}
        </CardContent>
      </Card>

      <AnalystSessionPanel
        caseId={session.caseId}
        setCaseId={session.setCaseId}
        caseOwner={session.caseOwner}
        setCaseOwner={session.setCaseOwner}
        caseTags={session.caseTags}
        setCaseTags={session.setCaseTags}
        normalizedTags={session.normalizedTags}
        runs={session.runs}
        onClearRuns={session.clearRuns}
      />

      <Tabs defaultValue="text" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="text">Text & Bulk</TabsTrigger>
          <TabsTrigger value="file">File (Client-side)</TabsTrigger>
          <TabsTrigger value="compare">Compare</TabsTrigger>
        </TabsList>

        <div className="mt-6 border rounded-xl p-6 bg-card/50 backdrop-blur-sm">
          <TabsContent value="text" className="mt-0">
            <HashText onRun={handleRun} />
          </TabsContent>

          <TabsContent value="file" className="mt-0">
            <HashFile onRun={handleRun} />
          </TabsContent>

          <TabsContent value="compare" className="mt-0">
            <HashCompare onRun={handleRun} />
          </TabsContent>
        </div>
      </Tabs>

      <div className="rounded-lg border bg-muted/50 p-4">
        <h4 className="mb-2 font-semibold">Algorithm Guidance</h4>
        <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <li className="flex items-center gap-2">
            <span className="font-mono font-bold text-foreground">MD5</span>
            <span>Legacy / Broken. Use only for non-security checks.</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="font-mono font-bold text-foreground">SHA-1</span>
            <span>Deprecated. Weak collision resistance.</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="font-mono font-bold text-foreground">SHA-256</span>
            <span>Standard. Secure for most use cases.</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="font-mono font-bold text-foreground">SHA-512</span>
            <span>Strongest. High performance on 64-bit systems.</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
