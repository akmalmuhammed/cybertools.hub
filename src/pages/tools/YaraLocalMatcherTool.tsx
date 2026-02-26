import { useState, type ChangeEvent } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  parseYaraRules,
  runYaraLocalMatcher,
  type YaraScanResult,
} from "@/lib/utils/yara-local"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

type ScanMode = "text" | "file"

type YaraWorkbenchResult = {
  scan: YaraScanResult
  scanMode: ScanMode
  fileName: string
  parsedRuleStats: {
    totalRules: number
    regexPatterns: number
    textPatterns: number
  }
}

export default function YaraLocalMatcherTool() {
  const [rulesInput, setRulesInput] = useState(
    [
      "rule SuspiciousKeyword {",
      "  strings:",
      "    $a = \"password=\" nocase",
      "  condition:",
      "    any of them",
      "}",
    ].join("\n"),
  )
  const [scanMode, setScanMode] = useState<ScanMode>("text")
  const [fileContent, setFileContent] = useState("")
  const [fileName, setFileName] = useState("")
  const [requireNoParseErrors, setRequireNoParseErrors] = useState(true)
  const [minimumMatchedRules, setMinimumMatchedRules] = useState("1")
  const [maximumMatchedRules, setMaximumMatchedRules] = useState("50")
  const [maxParsedRules, setMaxParsedRules] = useState("200")
  const [maxRegexPatterns, setMaxRegexPatterns] = useState("40")
  const [requireFileNameInFileMode, setRequireFileNameInFileMode] = useState(true)

  const process = async (input: string): Promise<string> => {
    const target = scanMode === "file" ? fileContent : input
    const parsedRules = parseYaraRules(rulesInput)
    const scan = runYaraLocalMatcher(rulesInput, target)

    const minimumMatches = Math.max(0, Number(minimumMatchedRules) || 1)
    const maximumMatches = Math.max(0, Number(maximumMatchedRules) || 50)
    const parsedRuleLimit = Math.max(1, Number(maxParsedRules) || 200)
    const regexLimit = Math.max(1, Number(maxRegexPatterns) || 40)

    const regexPatternCount = parsedRules.rules.reduce(
      (count, rule) => count + rule.patterns.filter((pattern) => pattern.type === "regex").length,
      0,
    )
    const textPatternCount = parsedRules.rules.reduce(
      (count, rule) => count + rule.patterns.filter((pattern) => pattern.type === "text").length,
      0,
    )

    const findings: ToolFinding[] = []

    if (!target.trim()) {
      findings.push({
        id: "yara-empty-target",
        severity: "medium",
        confidence: 79,
        category: "input-quality",
        title: "Scan target content is empty",
        description: "No text/file content supplied for YARA evaluation.",
        remediation: "Provide representative target content before interpreting match results.",
      })
    }

    if (requireNoParseErrors && scan.parseErrors.length > 0) {
      findings.push({
        id: "yara-parse-errors-blocking",
        severity: "high",
        confidence: 88,
        category: "rule-validity",
        title: "YARA parse errors present under strict mode",
        description: `${scan.parseErrors.length} parse error(s) found in rule definitions.`,
        remediation: "Fix malformed rule syntax and unsupported strings lines before using match results.",
      })
    } else if (scan.parseErrors.length > 0) {
      findings.push({
        id: "yara-parse-errors-warning",
        severity: "medium",
        confidence: 74,
        category: "rule-validity",
        title: "YARA parse errors detected",
        description: `${scan.parseErrors.length} parse error(s) found in rule definitions.`,
        remediation: "Correct parse issues to ensure deterministic matching behavior.",
      })
    }

    if (scan.parsedRules === 0) {
      findings.push({
        id: "yara-no-rules",
        severity: "high",
        confidence: 86,
        category: "rule-validity",
        title: "No valid YARA rules parsed",
        description: "Rule parser did not detect any valid YARA rules.",
        remediation: "Provide at least one valid rule block with strings and condition sections.",
      })
    }

    if (scan.parsedRules > parsedRuleLimit) {
      findings.push({
        id: "yara-rule-volume-high",
        severity: scan.parsedRules > parsedRuleLimit * 2 ? "high" : "medium",
        confidence: 75,
        category: "performance-risk",
        title: "Parsed rule count exceeds policy baseline",
        description: `Parsed rules=${scan.parsedRules}, max allowed=${parsedRuleLimit}.`,
        remediation: "Shard rulesets by use case and run targeted scans to reduce evaluation overhead.",
      })
    }

    if (regexPatternCount > regexLimit) {
      findings.push({
        id: "yara-regex-density-high",
        severity: regexPatternCount > regexLimit * 2 ? "medium" : "low",
        confidence: 71,
        category: "performance-risk",
        title: "Regex pattern density exceeds baseline",
        description: `Regex patterns=${regexPatternCount}, max allowed=${regexLimit}.`,
        remediation: "Prefer precise text patterns where possible and optimize expensive regex signatures.",
      })
    }

    if (scan.summary.matchedRules < minimumMatches) {
      findings.push({
        id: "yara-matches-below-minimum",
        severity: "medium",
        confidence: 76,
        category: "detection-signal",
        title: "Matched-rule count below minimum expectation",
        description: `Matched rules=${scan.summary.matchedRules}, minimum expected=${minimumMatches}.`,
        remediation: "Validate target sample quality and tune signatures for expected threat artifacts.",
      })
    }

    if (maximumMatches > 0 && scan.summary.matchedRules > maximumMatches) {
      findings.push({
        id: "yara-matches-above-maximum",
        severity: scan.summary.matchedRules > maximumMatches * 2 ? "high" : "medium",
        confidence: 77,
        category: "false-positive-risk",
        title: "Matched-rule count exceeds maximum threshold",
        description: `Matched rules=${scan.summary.matchedRules}, maximum allowed=${maximumMatches}.`,
        remediation: "Investigate overly broad signatures and tighten conditions to reduce false positives.",
      })
    }

    if (requireFileNameInFileMode && scanMode === "file" && !fileName) {
      findings.push({
        id: "yara-file-name-missing",
        severity: "low",
        confidence: 68,
        category: "auditability",
        title: "File mode active without filename context",
        description: "File scan mode is enabled but filename metadata is absent.",
        remediation: "Load a local file to preserve scan artifact context in investigation records.",
      })
    }

    if (scan.summary.matchedRules > 0) {
      findings.push({
        id: "yara-positive-matches",
        severity: "info",
        confidence: 72,
        category: "detection-signal",
        title: "YARA matches detected",
        description: `${scan.summary.matchedRules} rule(s) matched target content.`,
        remediation: "Review matched pattern IDs and corroborate with endpoint/network telemetry.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "YARA local matching completed",
      text: `Parsed ${scan.parsedRules} rule(s), matched ${scan.summary.matchedRules}, unmatched ${scan.summary.unmatchedRules}.`,
      findings,
      metrics: {
        parsedRules: scan.parsedRules,
        matchedRules: scan.summary.matchedRules,
        unmatchedRules: scan.summary.unmatchedRules,
        parseErrors: scan.parseErrors.length,
        regexPatterns: regexPatternCount,
      },
      baseScore: scan.summary.matchedRules > 0 ? 92 : 88,
    })

    const workbench: YaraWorkbenchResult = {
      scan,
      scanMode,
      fileName,
      parsedRuleStats: {
        totalRules: parsedRules.rules.length,
        regexPatterns: regexPatternCount,
        textPatterns: textPatternCount,
      },
    }

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "YARA Local Matcher",
        summary,
        findings,
        evidence: scan.matches.map((match) => ({
          rule: match.rule,
          matched: match.matched,
          condition: match.condition,
          matchedPatterns: match.matchedPatterns,
        })),
        recommendations: [
          "Treat rule parse errors as blockers for high-confidence detection workflows.",
          "Tune regex-heavy signatures to balance performance and detection precision.",
          "Correlate YARA matches with behavioral telemetry before automated containment.",
        ],
        raw: {
          yara: workbench,
          config: {
            requireNoParseErrors,
            minimumMatches,
            maximumMatches,
            parsedRuleLimit,
            regexLimit,
            requireFileNameInFileMode,
          },
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null
    const envelope = parseToolResultEnvelope(output, "YARA Local Matcher")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null
    const parsed = raw?.yara as YaraWorkbenchResult | undefined
    const config = raw?.config && typeof raw.config === "object" && raw.config !== null
      ? (raw.config as Record<string, unknown>)
      : null

    if (!parsed) return null

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase font-bold text-muted-foreground">Rules Parsed</div>
            <div className="text-xl font-semibold">{parsed.scan.parsedRules}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase font-bold text-muted-foreground">Matched</div>
            <div className="text-xl font-semibold text-red-600 dark:text-red-400">{parsed.scan.summary.matchedRules}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase font-bold text-muted-foreground">Unmatched</div>
            <div className="text-xl font-semibold">{parsed.scan.summary.unmatchedRules}</div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Mode: {parsed.scanMode} {parsed.fileName ? `| File: ${parsed.fileName}` : ""}
          {config && <> | Min matches: {String(config.minimumMatches ?? "1")}</>}
        </div>

        {parsed.scan.parseErrors.length > 0 && (
          <div className="p-3 border rounded bg-amber-500/10 border-amber-600/30">
            <h3 className="text-sm font-semibold mb-2">Rule Parse Notes</h3>
            <ul className="text-sm space-y-1">
              {parsed.scan.parseErrors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          {parsed.scan.matches.map((match) => (
            <div key={match.rule} className="p-3 border rounded bg-muted/20 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{match.rule}</div>
                <div className={match.matched ? "text-red-600 dark:text-red-400 font-semibold" : "text-green-600 dark:text-green-400 font-semibold"}>
                  {match.matched ? "MATCH" : "NO MATCH"}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">Condition: {match.condition}</div>
              <div className="text-xs text-muted-foreground">
                Matched strings: {match.matchedPatterns.length > 0 ? match.matchedPatterns.join(", ") : "none"}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      setFileName("")
      setFileContent("")
      return
    }

    setFileName(file.name)
    try {
      const text = await file.text()
      setFileContent(text)
    } catch {
      setFileContent("")
    }
  }

  return (
    <ToolTemplate
      toolName="YARA Local Matcher"
      description="Run local YARA matching with policy thresholds for rule quality, match signal, and performance safety."
      actionLabel="Run YARA Match"
      placeholder="Paste text content to scan..."
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>YARA Rules</Label>
            <Textarea
              value={rulesInput}
              onChange={(event) => setRulesInput(event.target.value)}
              className="min-h-[180px] font-mono text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="yara-mode">Scan Mode</Label>
            <select
              id="yara-mode"
              className="w-full rounded border bg-background px-2 py-2 text-sm"
              value={scanMode}
              onChange={(event) => setScanMode(event.target.value as ScanMode)}
            >
              <option value="text">Text Input</option>
              <option value="file">Local File</option>
            </select>
          </div>

          {scanMode === "file" && (
            <div className="space-y-1">
              <Label htmlFor="yara-file">Local file (never uploaded)</Label>
              <input
                id="yara-file"
                type="file"
                className="w-full rounded border bg-background px-2 py-2 text-sm"
                onChange={onFileChange}
              />
              {fileName && <div className="text-xs text-muted-foreground">Loaded: {fileName}</div>}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Minimum matched rules</Label>
              <Input
                value={minimumMatchedRules}
                onChange={(event) => setMinimumMatchedRules(event.target.value)}
                placeholder="1"
              />
            </div>
            <div className="space-y-1">
              <Label>Maximum matched rules</Label>
              <Input
                value={maximumMatchedRules}
                onChange={(event) => setMaximumMatchedRules(event.target.value)}
                placeholder="50"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Max parsed rules</Label>
              <Input
                value={maxParsedRules}
                onChange={(event) => setMaxParsedRules(event.target.value)}
                placeholder="200"
              />
            </div>
            <div className="space-y-1">
              <Label>Max regex patterns</Label>
              <Input
                value={maxRegexPatterns}
                onChange={(event) => setMaxRegexPatterns(event.target.value)}
                placeholder="40"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="yara-no-parse-errors" className="text-sm">Require zero parse errors</Label>
              <Switch
                id="yara-no-parse-errors"
                checked={requireNoParseErrors}
                onChange={(event) => setRequireNoParseErrors(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="yara-require-file-name" className="text-sm">Require filename in file mode</Label>
              <Switch
                id="yara-require-file-name"
                checked={requireFileNameInFileMode}
                onChange={(event) => setRequireFileNameInFileMode(event.target.checked)}
              />
            </div>
          </div>
        </div>
      }
      examples={[
        "password=Summer2026!\napi_key=123456",
      ]}
    />
  )
}
