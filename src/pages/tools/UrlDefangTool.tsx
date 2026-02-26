import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import {
  canonicalizeUrl,
  canonicalizeUrlsFromText,
  defangText,
  refangText,
  type CanonicalUrlResult,
} from "@/lib/utils/url-defense"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

type UrlDefenseMode = "defang" | "refang" | "canonicalize"

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'`]+/gi

function parseHostSuffixes(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\s,]+/)
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    ),
  )
}

function hasCredentialedUrl(text: string): boolean {
  return /https?:\/\/[^/\s:@]+:[^@\s]+@/i.test(text)
}

export default function UrlDefangTool() {
  const [mode, setMode] = useState<UrlDefenseMode>("defang")

  const [maxResultCount, setMaxResultCount] = useState("25")
  const [maxWarningCount, setMaxWarningCount] = useState("2")
  const [requiredHostSuffixes, setRequiredHostSuffixes] = useState("")
  const [requireProtocolDefang, setRequireProtocolDefang] = useState(true)
  const [requireHttpsCanonical, setRequireHttpsCanonical] = useState(true)
  const [flagCredentialedUrls, setFlagCredentialedUrls] = useState(true)

  const handleModeChange = (value: string) => {
    if (value === "defang" || value === "refang" || value === "canonicalize") {
      setMode(value)
    }
  }

  const process = (input: string) => {
    const findings: ToolFinding[] = []
    const limit = Math.max(1, Number(maxResultCount) || 25)
    const warningLimit = Math.max(0, Number(maxWarningCount) || 2)
    const hostSuffixes = parseHostSuffixes(requiredHostSuffixes)

    if (mode === "defang") {
      const output = defangText(input)
      const inputUrls = input.match(URL_PATTERN) ?? []
      const remainingLiveUrls = output.match(URL_PATTERN)?.length ?? 0

      if (flagCredentialedUrls && hasCredentialedUrl(input)) {
        findings.push({
          id: "url-defang-credentialed-input",
          severity: "high",
          confidence: 92,
          category: "credential-exposure",
          title: "Credentialed URL detected in source text",
          description: "Input includes URLs with embedded username/password credentials.",
          remediation: "Remove URL credentials and use managed secrets or authenticated headers.",
        })
      }

      if (requireProtocolDefang && inputUrls.length > 0 && remainingLiveUrls > 0) {
        findings.push({
          id: "url-defang-live-protocol-remains",
          severity: "medium",
          confidence: 82,
          category: "safe-sharing",
          title: "Live URL protocol remains after defang",
          description: `${remainingLiveUrls} URL(s) still contain live http/https schemes after defang.`,
          remediation: "Use strict defang handling before sharing threat indicators externally.",
        })
      }

      if (inputUrls.length > 0 && output === input) {
        findings.push({
          id: "url-defang-no-change",
          severity: "low",
          confidence: 70,
          category: "data-quality",
          title: "Defang operation did not change URL text",
          description: "Input contained URL-like values, but output remained unchanged.",
          remediation: "Validate URL formatting and run canonicalization before defanging.",
        })
      }

      if (findings.length === 0) {
        findings.push({
          id: "url-defang-success",
          severity: "info",
          confidence: 72,
          category: "safe-sharing",
          title: "URL indicators successfully defanged",
          description: "Defang transformation completed without policy violations.",
          remediation: "Share only defanged indicators in chat, tickets, and reports.",
        })
      }

      const summary = createSummaryFromFindings({
        title: "URL defang completed",
        text: `Processed ${inputUrls.length} detected URL(s) with safe-sharing controls.`,
        findings,
        metrics: {
          detectedUrls: inputUrls.length,
          remainingLiveUrls,
          changed: output === input ? 0 : 1,
        },
        baseScore: 98,
      })

      return JSON.stringify(
        buildToolResultEnvelope({
          toolName: "URL Defang/Refang + Canonicalizer",
          summary,
          findings,
          evidence: [
            {
              mode,
              detectedUrls: inputUrls.length,
              remainingLiveUrls,
              output,
            },
          ],
          recommendations: [
            "Defang all IOC URLs before external sharing and ticket distribution.",
            "Reject embedded URL credentials in threat-intel sharing workflows.",
            "Canonicalize indicators before deduplication and reputation checks.",
          ],
          raw: {
            mode,
            output,
            config: {
              requireProtocolDefang,
              flagCredentialedUrls,
            },
          },
        }),
      )
    }

    if (mode === "refang") {
      const output = refangText(input)
      const restoredUrls = output.match(URL_PATTERN)?.length ?? 0

      if (flagCredentialedUrls && hasCredentialedUrl(output)) {
        findings.push({
          id: "url-refang-credentialed-url",
          severity: "high",
          confidence: 91,
          category: "credential-exposure",
          title: "Credentialed URL present after refang",
          description: "Refanged output contains URL credentials and may leak privileged access paths.",
          remediation: "Sanitize credentials before IOC enrichment or browser testing.",
        })
      }

      if (/\bhxxps?:\/\//i.test(output)) {
        findings.push({
          id: "url-refang-partial-recovery",
          severity: "low",
          confidence: 69,
          category: "data-quality",
          title: "Partial refang result detected",
          description: "Output still includes defanged protocol markers.",
          remediation: "Normalize mixed defang formats before downstream processing.",
        })
      }

      if (findings.length === 0) {
        findings.push({
          id: "url-refang-ready",
          severity: "info",
          confidence: 70,
          category: "workflow",
          title: "Refang output ready for analysis",
          description: "Refanged indicators can be used for controlled sandbox enrichment.",
          remediation: "Open refanged indicators only in isolated environments.",
        })
      }

      const summary = createSummaryFromFindings({
        title: "URL refang completed",
        text: `Refanged payload produced ${restoredUrls} URL candidate(s).`,
        findings,
        metrics: {
          restoredUrls,
          changed: output === input ? 0 : 1,
        },
        baseScore: 97,
      })

      return JSON.stringify(
        buildToolResultEnvelope({
          toolName: "URL Defang/Refang + Canonicalizer",
          summary,
          findings,
          evidence: [
            {
              mode,
              restoredUrls,
              output,
            },
          ],
          recommendations: [
            "Use refang mode only in controlled environments.",
            "Retain original defanged indicators in case artifacts for safe collaboration.",
          ],
          raw: {
            mode,
            output,
            config: {
              flagCredentialedUrls,
            },
          },
        }),
      )
    }

    const canonicalized = canonicalizeUrlsFromText(input)
    const results = canonicalized.length > 0 ? canonicalized : [canonicalizeUrl(input)]

    const nonHttpsResults = requireHttpsCanonical
      ? results.filter((result) => result.scheme !== "https")
      : []

    const credentialedHosts: string[] = []
    if (flagCredentialedUrls) {
      results.forEach((result) => {
        try {
          const parsed = new URL(result.canonical)
          if (parsed.username || parsed.password) {
            credentialedHosts.push(parsed.hostname)
          }
        } catch {
          // Ignore parse exceptions for already-canonicalized values.
        }
      })
    }

    const unmatchedHosts = hostSuffixes.length > 0
      ? results
        .map((result) => result.host)
        .filter((host) => !hostSuffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`)))
      : []

    const warningCount = results.reduce((total, result) => total + result.warnings.length, 0)

    if (results.length > limit) {
      findings.push({
        id: "url-canonicalize-result-limit",
        severity: "medium",
        confidence: 79,
        category: "triage-governance",
        title: "Canonicalized URL volume exceeds review limit",
        description: `${results.length} URL(s) detected; configured review limit is ${limit}.`,
        remediation: "Split bulk URL datasets into reviewable batches by source or campaign.",
      })
    }

    if (nonHttpsResults.length > 0) {
      findings.push({
        id: "url-canonicalize-non-https",
        severity: "medium",
        confidence: 83,
        category: "transport-security",
        title: "Non-HTTPS canonical URLs detected",
        description: `${nonHttpsResults.length} canonical URL(s) do not use HTTPS.`,
        remediation: "Enforce HTTPS-only policy for production redirect and callback paths.",
      })
    }

    if (credentialedHosts.length > 0) {
      findings.push({
        id: "url-canonicalize-credentialed",
        severity: "high",
        confidence: 90,
        category: "credential-exposure",
        title: "Credentialed canonical URLs detected",
        description: `Detected embedded credentials in URL host(s): ${Array.from(new Set(credentialedHosts)).join(", ")}.`,
        remediation: "Remove credentials from URLs and rotate any leaked secrets immediately.",
      })
    }

    if (warningCount > warningLimit) {
      findings.push({
        id: "url-canonicalize-warning-threshold",
        severity: "low",
        confidence: 72,
        category: "normalization-quality",
        title: "Canonicalization warnings exceed threshold",
        description: `${warningCount} warning(s) were generated; policy limit is ${warningLimit}.`,
        remediation: "Review warning patterns and normalize source URL quality before enrichment.",
      })
    }

    if (unmatchedHosts.length > 0) {
      findings.push({
        id: "url-canonicalize-host-allowlist",
        severity: "high",
        confidence: 88,
        category: "domain-governance",
        title: "Canonical URLs outside required host scope",
        description: `Host(s) outside allowlist policy: ${Array.from(new Set(unmatchedHosts)).join(", ")}.`,
        remediation: "Restrict processing to approved domains or update host scope governance if expected.",
      })
    }

    if (findings.length === 0) {
      findings.push({
        id: "url-canonicalize-policy-pass",
        severity: "info",
        confidence: 73,
        category: "normalization-quality",
        title: "Canonicalization policy checks passed",
        description: "Canonicalized URLs satisfy configured transport, host, and warning policies.",
        remediation: "Use canonical URLs as deduplication keys across SOC intelligence pipelines.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "URL canonicalization completed",
      text: `Canonicalized ${results.length} URL(s) for IOC normalization workflows.`,
      findings,
      metrics: {
        urls: results.length,
        warnings: warningCount,
        nonHttps: nonHttpsResults.length,
        unmatchedHosts: unmatchedHosts.length,
      },
      baseScore: 98,
    })

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "URL Defang/Refang + Canonicalizer",
        summary,
        findings,
        evidence: results.slice(0, limit).map((result) => ({
          host: result.host,
          scheme: result.scheme,
          canonical: result.canonical,
          warnings: result.warnings.join(" | "),
          warningCount: result.warnings.length,
        })),
        recommendations: [
          "Use canonical URL outputs as deterministic keys for IOC deduplication and enrichment.",
          "Enforce HTTPS and host-allowlist checks before automated URL handling.",
          "Defang URLs before collaboration outside secure analysis environments.",
        ],
        raw: {
          mode,
          results,
          config: {
            limit,
            warningLimit,
            hostSuffixes,
            requireHttpsCanonical,
            flagCredentialedUrls,
          },
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null

    const envelope = parseToolResultEnvelope(output, "URL Defang/Refang + Canonicalizer")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null

    const rawMode = typeof raw?.mode === "string" ? raw.mode : mode

    if (rawMode !== "canonicalize") {
      const transformed = typeof raw?.output === "string" ? raw.output : ""
      return (
        <pre className="h-full min-h-[300px] p-4 rounded-lg bg-background border overflow-auto text-sm font-mono whitespace-pre-wrap break-all">
          {transformed}
        </pre>
      )
    }

    const results = Array.isArray(raw?.results) ? (raw.results as CanonicalUrlResult[]) : []
    if (results.length === 0) return null

    return (
      <div className="space-y-3">
        {results.map((result, index) => (
          <div key={`${result.canonical}-${index}`} className="p-3 border rounded bg-muted/20 space-y-2">
            <div className="text-xs text-muted-foreground uppercase font-semibold">Canonical URL</div>
            <div className="font-mono text-sm break-all">{result.canonical}</div>
            <div className="grid sm:grid-cols-2 gap-2 text-xs">
              <div><span className="font-semibold">Host:</span> {result.host}</div>
              <div><span className="font-semibold">Scheme:</span> {result.scheme}</div>
              <div><span className="font-semibold">Path:</span> {result.path}</div>
              <div><span className="font-semibold">Port:</span> {result.port ?? "default"}</div>
            </div>
            {result.warnings.length > 0 && (
              <ul className="text-xs text-muted-foreground space-y-1">
                {result.warnings.map((warning, warningIndex) => (
                  <li key={warningIndex}>- {warning}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <ToolTemplate
      toolName="URL Defang/Refang + Canonicalizer"
      description="Enterprise URL handling with safe-sharing controls, canonical normalization policy gates, and host-scope governance."
      actionLabel={mode === "defang" ? "Defang" : mode === "refang" ? "Refang" : "Canonicalize"}
      placeholder="https://example.com/login?b=2&a=1#fragment"
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <Tabs value={mode} onValueChange={handleModeChange} className="w-[420px] max-w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="defang">Defang</TabsTrigger>
              <TabsTrigger value="refang">Refang</TabsTrigger>
              <TabsTrigger value="canonicalize">Canonicalize</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Max URL records per run</Label>
              <Input value={maxResultCount} onChange={(event) => setMaxResultCount(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Max warning count</Label>
              <Input value={maxWarningCount} onChange={(event) => setMaxWarningCount(event.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Required host suffixes (comma separated)</Label>
            <Input
              value={requiredHostSuffixes}
              onChange={(event) => setRequiredHostSuffixes(event.target.value)}
              placeholder="example.com,corp.example"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="require-protocol-defang">Require protocol defang in safe-sharing mode</Label>
              <Switch
                id="require-protocol-defang"
                checked={requireProtocolDefang}
                onChange={(event) => setRequireProtocolDefang(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="require-https-canonical">Require HTTPS canonical URLs</Label>
              <Switch
                id="require-https-canonical"
                checked={requireHttpsCanonical}
                onChange={(event) => setRequireHttpsCanonical(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="flag-credentialed-url">Flag embedded URL credentials</Label>
              <Switch
                id="flag-credentialed-url"
                checked={flagCredentialedUrls}
                onChange={(event) => setFlagCredentialedUrls(event.target.checked)}
              />
            </div>
          </div>
        </div>
      }
      examples={[
        "https://example.com/login?b=2&a=1#frag",
        "hxxps://portal[.]example[.]com/reset-password",
        "Multiple URLs: https://a.example.com/x and https://b.example.com/y",
      ]}
    />
  )
}
