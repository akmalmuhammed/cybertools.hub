import { useMemo, useState, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { JsonEditor } from "@/components/tools/json/JsonEditor"
import { JsonTree } from "@/components/tools/json/JsonTree"
import { JsonDiff } from "@/components/tools/json/JsonDiff"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2, Download, FileJson } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import Ajv from "ajv"
import type { ErrorObject } from "ajv"
import { SEO } from "@/components/features/SEO"
import { useAnalystSession } from "@/lib/hooks/useAnalystSession"
import { AnalystSessionPanel } from "@/components/tools/AnalystSessionPanel"
import { buildToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

interface JsonShapeStats {
  maxDepth: number
  totalKeys: number
  maxArrayLength: number
  prototypePaths: string[]
}

function inspectJsonShape(value: unknown): JsonShapeStats {
  const prototypePaths: string[] = []

  const walk = (node: unknown, depth: number, path: string): { depth: number; keys: number; maxArray: number } => {
    if (Array.isArray(node)) {
      let deepest = depth
      let keys = 0
      let maxArray = node.length
      node.forEach((item, index) => {
        const child = walk(item, depth + 1, `${path}[${index}]`)
        deepest = Math.max(deepest, child.depth)
        keys += child.keys
        maxArray = Math.max(maxArray, child.maxArray)
      })
      return { depth: deepest, keys, maxArray }
    }

    if (node && typeof node === "object") {
      const record = node as Record<string, unknown>
      const entries = Object.entries(record)
      let deepest = depth
      let keys = entries.length
      let maxArray = 0

      entries.forEach(([key, childValue]) => {
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
          prototypePaths.push(path ? `${path}.${key}` : key)
        }

        const child = walk(childValue, depth + 1, path ? `${path}.${key}` : key)
        deepest = Math.max(deepest, child.depth)
        keys += child.keys
        maxArray = Math.max(maxArray, child.maxArray)
      })

      return { depth: deepest, keys, maxArray }
    }

    return { depth, keys: 0, maxArray: 0 }
  }

  const stats = walk(value, 1, "")
  return {
    maxDepth: stats.depth,
    totalKeys: stats.keys,
    maxArrayLength: stats.maxArray,
    prototypePaths,
  }
}

export default function JsonTool() {
  const session = useAnalystSession("json")
  const [input, setInput] = useState('{"name": "Secutil", "type": "Workspace"}')
  const [error, setError] = useState<string | null>(null)
  const [errorLine, setErrorLine] = useState<number | null>(null)
  const [parsed, setParsed] = useState<object | null>(null)

  const [schemaInput, setSchemaInput] = useState("")
  const [schemaErrors, setSchemaErrors] = useState<ErrorObject[] | null>(null)
  const [isSchemaOpen, setIsSchemaOpen] = useState(false)
  const [schemaJsonError, setSchemaJsonError] = useState<string | null>(null)

  const [maxInputChars, setMaxInputChars] = useState("200000")
  const [maxDepthInput, setMaxDepthInput] = useState("20")
  const [maxKeysInput, setMaxKeysInput] = useState("2000")
  const [maxSchemaErrorsInput, setMaxSchemaErrorsInput] = useState("25")
  const [maxArrayLengthInput, setMaxArrayLengthInput] = useState("5000")
  const [requireSchemaForApproval, setRequireSchemaForApproval] = useState(false)
  const [blockPrototypeKeys, setBlockPrototypeKeys] = useState(true)
  const [flagLargeArrays, setFlagLargeArrays] = useState(true)

  useEffect(() => {
    try {
      if (!input.trim()) {
        setParsed(null)
        setError(null)
        setErrorLine(null)
        return
      }
      const p = JSON.parse(input)
      setParsed(p)
      setError(null)
      setErrorLine(null)
    } catch (e: unknown) {
      setParsed(null)
      const msg = e instanceof Error ? e.message : "Invalid JSON"
      setError(msg)

      const match = msg.match(/at position (\d+)/)
      if (match && match[1]) {
        const pos = Number.parseInt(match[1], 10)
        const lines = input.substring(0, pos).split("\n")
        setErrorLine(lines.length)
      } else {
        setErrorLine(null)
      }
    }
  }, [input])

  useEffect(() => {
    if (!parsed || !schemaInput.trim()) {
      setSchemaErrors(null)
      setSchemaJsonError(null)
      return
    }

    try {
      const schema = JSON.parse(schemaInput)
      setSchemaJsonError(null)

      const ajv = new Ajv({ allErrors: true })
      const validate = ajv.compile(schema)
      const valid = validate(parsed)

      if (!valid && validate.errors) {
        setSchemaErrors(validate.errors)
      } else {
        setSchemaErrors(null)
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error"
      setSchemaJsonError(`Invalid Schema JSON: ${message}`)
      setSchemaErrors(null)
    }
  }, [parsed, schemaInput])

  const governanceEnvelope = useMemo(() => {
    const findings: ToolFinding[] = []

    const inputLimit = Math.max(128, Number(maxInputChars) || 200000)
    const depthLimit = Math.max(1, Number(maxDepthInput) || 20)
    const keyLimit = Math.max(1, Number(maxKeysInput) || 2000)
    const schemaErrorLimit = Math.max(0, Number(maxSchemaErrorsInput) || 25)
    const arrayLimit = Math.max(1, Number(maxArrayLengthInput) || 5000)

    let shape: JsonShapeStats | null = null
    if (parsed) {
      shape = inspectJsonShape(parsed)
    }

    if (input.length > inputLimit) {
      findings.push({
        id: "json-input-size-limit",
        severity: input.length > inputLimit * 2 ? "high" : "medium",
        confidence: 82,
        category: "payload-governance",
        title: "JSON input size exceeds policy limit",
        description: `Input has ${input.length} chars; limit is ${inputLimit}.`,
        remediation: "Split oversized documents or increase policy limit for approved workloads.",
      })
    }

    if (error) {
      findings.push({
        id: "json-parse-error",
        severity: "high",
        confidence: 92,
        category: "parse-quality",
        title: "JSON parsing failed",
        description: error,
        remediation: "Fix JSON syntax before schema validation and downstream processing.",
      })
    }

    if (shape) {
      if (shape.maxDepth > depthLimit) {
        findings.push({
          id: "json-depth-limit",
          severity: shape.maxDepth > depthLimit + 10 ? "high" : "medium",
          confidence: 80,
          category: "payload-governance",
          title: "JSON nesting depth exceeds threshold",
          description: `Max depth ${shape.maxDepth} exceeds configured limit ${depthLimit}.`,
          remediation: "Flatten nested structures before transport and indexing.",
        })
      }

      if (shape.totalKeys > keyLimit) {
        findings.push({
          id: "json-key-count-limit",
          severity: shape.totalKeys > keyLimit * 2 ? "high" : "medium",
          confidence: 78,
          category: "payload-governance",
          title: "JSON key count exceeds threshold",
          description: `Detected ${shape.totalKeys} keys; configured limit is ${keyLimit}.`,
          remediation: "Prune non-essential fields and normalize schema before ingestion.",
        })
      }

      if (flagLargeArrays && shape.maxArrayLength > arrayLimit) {
        findings.push({
          id: "json-array-length-limit",
          severity: shape.maxArrayLength > arrayLimit * 2 ? "high" : "medium",
          confidence: 77,
          category: "payload-governance",
          title: "Array length exceeds threshold",
          description: `Max array length ${shape.maxArrayLength} exceeds configured limit ${arrayLimit}.`,
          remediation: "Chunk large arrays into paginated payloads for safer processing.",
        })
      }

      if (blockPrototypeKeys && shape.prototypePaths.length > 0) {
        findings.push({
          id: "json-prototype-key-risk",
          severity: "high",
          confidence: 88,
          category: "prototype-pollution",
          title: "Prototype-sensitive keys detected",
          description: `Detected ${shape.prototypePaths.length} prototype-sensitive key path(s).`,
          remediation: "Strip __proto__/constructor/prototype keys before object merge operations.",
        })
      }
    }

    const schemaIssueCount = schemaErrors?.length ?? 0
    if (schemaIssueCount > schemaErrorLimit) {
      findings.push({
        id: "json-schema-error-limit",
        severity: schemaIssueCount > schemaErrorLimit + 20 ? "high" : "medium",
        confidence: 79,
        category: "schema-governance",
        title: "Schema error count exceeds threshold",
        description: `Schema validation reported ${schemaIssueCount} errors; limit is ${schemaErrorLimit}.`,
        remediation: "Align payload with schema requirements before release gating.",
      })
    }

    if (schemaJsonError) {
      findings.push({
        id: "json-schema-invalid",
        severity: "high",
        confidence: 86,
        category: "schema-governance",
        title: "Schema definition is invalid",
        description: schemaJsonError,
        remediation: "Fix schema syntax before using it as approval gate.",
      })
    }

    if (requireSchemaForApproval && !schemaInput.trim()) {
      findings.push({
        id: "json-schema-required",
        severity: "medium",
        confidence: 76,
        category: "schema-governance",
        title: "Schema is required by policy",
        description: "No schema was provided while strict schema policy is enabled.",
        remediation: "Provide and validate JSON schema before approval.",
      })
    }

    if (findings.length === 0) {
      findings.push({
        id: "json-governance-pass",
        severity: "info",
        confidence: 71,
        category: "schema-governance",
        title: "JSON payload passed governance checks",
        description: "No parsing, schema, depth, or structure policy violations were detected.",
        remediation: "Keep schema and payload governance baselines under version control.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "JSON governance assessment",
      text: error
        ? "JSON payload has parsing and/or governance violations."
        : "JSON payload analyzed for schema and structural governance baselines.",
      findings,
      metrics: {
        inputChars: input.length,
        schemaErrors: schemaIssueCount,
        maxDepth: shape?.maxDepth ?? 0,
        totalKeys: shape?.totalKeys ?? 0,
        maxArrayLength: shape?.maxArrayLength ?? 0,
      },
      baseScore: 98,
    })

    return buildToolResultEnvelope({
      toolName: "JSON Formatter",
      summary,
      findings,
      evidence: [
        {
          inputChars: input.length,
          parseError: error,
          schemaErrorCount: schemaIssueCount,
          shape,
          prototypePaths: shape?.prototypePaths.slice(0, 20) ?? [],
        },
      ],
      recommendations: [
        "Enforce schema validation as a release gate for security-sensitive payload contracts.",
        "Block prototype-sensitive keys before object merges in runtime code.",
        "Cap JSON depth and array sizes to prevent parser and memory abuse conditions.",
      ],
      raw: {
        input,
        schemaInput,
        parseError: error,
        schemaJsonError,
        shape,
        config: {
          inputLimit,
          depthLimit,
          keyLimit,
          schemaErrorLimit,
          arrayLimit,
          requireSchemaForApproval,
          blockPrototypeKeys,
          flagLargeArrays,
        },
      },
    })
  }, [
    parsed,
    input,
    error,
    schemaErrors,
    schemaInput,
    schemaJsonError,
    maxInputChars,
    maxDepthInput,
    maxKeysInput,
    maxSchemaErrorsInput,
    maxArrayLengthInput,
    requireSchemaForApproval,
    blockPrototypeKeys,
    flagLargeArrays,
  ])

  const format = () => {
    if (!parsed) return
    setInput(JSON.stringify(parsed, null, 2))
  }

  const minify = () => {
    if (!parsed) return
    setInput(JSON.stringify(parsed))
  }

  const captureRun = () => {
    const meaningfulFindings = governanceEnvelope.findings.filter((finding) => finding.severity !== "info").length
    session.recordRun({
      durationMs: 1,
      status: governanceEnvelope.summary.status,
      score: governanceEnvelope.summary.score,
      findings: meaningfulFindings,
      summary: governanceEnvelope.summary.text,
      mode: "editor",
      metrics: governanceEnvelope.summary.metrics,
    })
  }

  const exportEvidencePack = () => {
    const payload = session.attachContext({
      toolName: "JSON Formatter",
      exportedAt: new Date().toISOString(),
      governance: governanceEnvelope,
      snapshot: {
        validJson: !error && !!parsed,
        parseError: error,
        schemaErrorCount: schemaErrors?.length ?? 0,
        schemaJsonError,
        input,
        schemaInput,
        parsed: parsed ?? null,
        runs: session.runs,
      },
    })

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "json-session-evidence.json"
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <SEO
        title="JSON Formatter and Validator"
        description="Format, minify, validate, diff, and schema-check JSON locally in your browser with tree and editor views."
        canonical="/tools/json"
        keywords={[
          "json formatter",
          "json validator",
          "json diff",
          "json schema validation",
        ]}
        breadcrumbItems={[
          { name: "Home", url: "/" },
          { name: "Tools", url: "/tools" },
          { name: "Data Security & Privacy Engineering", url: "/domains/data-security-privacy-engineering" },
          { name: "JSON Formatter", url: "/tools/json" },
        ]}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "JSON Formatter",
          description: "Browser-based JSON formatter, validator, schema checker, and diff tool.",
          applicationCategory: "Data Security Tool",
          operatingSystem: "Web Browser",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
          },
        }}
      />

      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">JSON Formatter</h1>
        <p className="text-muted-foreground">
          Validate, format, and inspect JSON with schema checks, structural governance controls, and policy-driven findings.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={captureRun}>Capture Run</Button>
          <Button variant="outline" size="sm" onClick={exportEvidencePack}>
            <Download className="h-4 w-4 mr-2" /> Export Session Evidence
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">Governance Status:</span>
          <span className="rounded border px-2 py-0.5">{governanceEnvelope.summary.status}</span>
          <span className="rounded border px-2 py-0.5">
            Score: {typeof governanceEnvelope.summary.score === "number" ? governanceEnvelope.summary.score : "n/a"}
          </span>
          <span className="rounded border px-2 py-0.5">Findings: {governanceEnvelope.findings.length}</span>
        </div>
        <p className="text-sm text-muted-foreground">{governanceEnvelope.summary.text}</p>
        {governanceEnvelope.findings.length > 0 && (
          <ul className="text-xs text-muted-foreground space-y-1">
            {governanceEnvelope.findings.slice(0, 5).map((finding) => (
              <li key={finding.id}>[{finding.severity.toUpperCase()}] {finding.title}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border bg-card/50 p-4 space-y-3">
        <div className="text-sm font-semibold">Policy Controls</div>
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label>Max input chars</Label>
            <Input value={maxInputChars} onChange={(event) => setMaxInputChars(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Max JSON depth</Label>
            <Input value={maxDepthInput} onChange={(event) => setMaxDepthInput(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Max key count</Label>
            <Input value={maxKeysInput} onChange={(event) => setMaxKeysInput(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Max schema errors</Label>
            <Input value={maxSchemaErrorsInput} onChange={(event) => setMaxSchemaErrorsInput(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Max array length</Label>
            <Input value={maxArrayLengthInput} onChange={(event) => setMaxArrayLengthInput(event.target.value)} />
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="json-require-schema">Require schema for approval</Label>
            <Switch
              id="json-require-schema"
              checked={requireSchemaForApproval}
              onChange={(event) => setRequireSchemaForApproval(event.target.checked)}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="json-block-prototype">Block prototype-sensitive keys</Label>
            <Switch
              id="json-block-prototype"
              checked={blockPrototypeKeys}
              onChange={(event) => setBlockPrototypeKeys(event.target.checked)}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="json-flag-arrays">Flag oversized arrays</Label>
            <Switch
              id="json-flag-arrays"
              checked={flagLargeArrays}
              onChange={(event) => setFlagLargeArrays(event.target.checked)}
            />
          </div>
        </div>
      </div>

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

      <Tabs defaultValue="editor" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="editor">Editor & Tree</TabsTrigger>
          <TabsTrigger value="diff">Diff Mode</TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button onClick={format} disabled={!parsed} className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-md hover:bg-primary/90 disabled:opacity-50">
                Format
              </button>
              <button onClick={minify} disabled={!parsed} className="text-xs bg-muted text-foreground px-3 py-1 rounded-md hover:bg-muted/80 disabled:opacity-50 border">
                Minify
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSchemaOpen(!isSchemaOpen)}
                className="text-xs h-7 ml-2"
              >
                <FileJson className="w-3 h-3 mr-1" />
                {isSchemaOpen ? "Hide Schema" : "Validate Schema"}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              {parsed ? (
                <span className="flex items-center text-green-500 font-medium">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Valid JSON
                </span>
              ) : error ? (
                <span className="flex items-center text-destructive font-medium">
                  <AlertCircle className="h-3 w-3 mr-1" /> Invalid
                </span>
              ) : null}
            </div>
          </div>

          {isSchemaOpen && (
            <div className="border rounded-md p-4 bg-muted/20 space-y-2">
              <div className="flex justify-between items-center">
                <Label>JSON Schema</Label>
                {schemaJsonError && <span className="text-xs text-destructive">{schemaJsonError}</span>}
              </div>
              <Textarea
                placeholder="Paste JSON Schema here..."
                className="font-mono text-xs h-32"
                value={schemaInput}
                onChange={(event) => setSchemaInput(event.target.value)}
              />
              {schemaErrors && (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-semibold mb-1">Schema Validation Errors ({schemaErrors.length}):</div>
                    <ul className="list-disc pl-4 space-y-1 text-xs">
                      {schemaErrors.slice(0, 5).map((item, index) => (
                        <li key={index}>
                          <span className="font-mono">{item.instancePath || "root"}</span>: {item.message}
                        </li>
                      ))}
                      {schemaErrors.length > 5 && <li>...and {schemaErrors.length - 5} more</li>}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              {!schemaErrors && !schemaJsonError && schemaInput.trim() && parsed && (
                <Alert className="mt-2 bg-green-500/10 border-green-500/50 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>JSON matches the schema.</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-4 h-[600px]">
            <div className="flex flex-col gap-2 h-full">
              <Label>Raw Input</Label>
              <div className="flex-1 relative border rounded-md overflow-hidden">
                <JsonEditor value={input} onChange={setInput} errorLine={errorLine} />
                {error && (
                  <div className="absolute bottom-4 left-4 right-4 z-10">
                    <Alert variant="destructive" className="shadow-lg backdrop-blur-sm bg-destructive/10 border-destructive/50">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 h-full">
              <Label>Tree View</Label>
              <div className="flex-1 overflow-hidden">
                {parsed ? (
                  <JsonTree data={parsed} />
                ) : (
                  <div className="h-full border rounded-md bg-muted/20 flex items-center justify-center text-muted-foreground text-sm">
                    Valid JSON will appear here
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="diff" className="space-y-4 h-[700px]">
          <JsonDiff />
        </TabsContent>
      </Tabs>
    </div>
  )
}
