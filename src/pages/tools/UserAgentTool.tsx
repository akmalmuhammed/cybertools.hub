import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { parseUserAgent, type UserAgentParseResult } from "@/lib/utils/user-agent"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

function riskColor(level: UserAgentParseResult["risk"]["level"]): string {
  if (level === "high") return "text-red-600 dark:text-red-400"
  if (level === "medium") return "text-amber-600 dark:text-amber-400"
  return "text-green-600 dark:text-green-400"
}

function majorVersion(version: string | null): number | null {
  if (!version) return null
  const major = Number(version.split(".")[0])
  return Number.isFinite(major) ? major : null
}

export default function UserAgentTool() {
  const [maximumRiskScore, setMaximumRiskScore] = useState("50")
  const [minimumChromeMajor, setMinimumChromeMajor] = useState("120")
  const [minimumFirefoxMajor, setMinimumFirefoxMajor] = useState("120")
  const [minimumEdgeMajor, setMinimumEdgeMajor] = useState("120")
  const [minimumSafariMajor, setMinimumSafariMajor] = useState("16")
  const [blockBots, setBlockBots] = useState(true)
  const [blockAutomation, setBlockAutomation] = useState(true)
  const [blockHeadless, setBlockHeadless] = useState(true)
  const [requireKnownOs, setRequireKnownOs] = useState(false)
  const [requireKnownBrowser, setRequireKnownBrowser] = useState(true)

  const process = (input: string) => {
    const parsed = parseUserAgent(input)
    const findings: ToolFinding[] = []

    const riskThreshold = Math.max(0, Math.min(100, Number(maximumRiskScore) || 50))
    const chromeFloor = Math.max(1, Number(minimumChromeMajor) || 120)
    const firefoxFloor = Math.max(1, Number(minimumFirefoxMajor) || 120)
    const edgeFloor = Math.max(1, Number(minimumEdgeMajor) || 120)
    const safariFloor = Math.max(1, Number(minimumSafariMajor) || 16)

    if (parsed.risk.score > riskThreshold) {
      findings.push({
        id: "ua-risk-threshold-exceeded",
        severity: parsed.risk.score >= riskThreshold + 20 ? "high" : "medium",
        confidence: 88,
        category: "risk-governance",
        title: "User-Agent risk score exceeds threshold",
        description: `Risk score ${parsed.risk.score} exceeds policy threshold ${riskThreshold}.`,
        remediation: "Challenge or isolate traffic matching high-risk automation signatures.",
      })
    }

    if (blockBots && parsed.classification.isBot) {
      findings.push({
        id: "ua-bot-block-policy",
        severity: "high",
        confidence: 91,
        category: "access-control",
        title: "Bot traffic violates policy",
        description: "User-Agent matched bot/crawler signatures while bot traffic blocking is enabled.",
        remediation: "Apply bot controls or allowlist only approved crawler identities.",
      })
    }

    if (blockAutomation && parsed.classification.isAutomated) {
      findings.push({
        id: "ua-automation-block-policy",
        severity: "high",
        confidence: 90,
        category: "access-control",
        title: "Automation signature violates policy",
        description: "Automation framework markers were detected in User-Agent string.",
        remediation: "Require authenticated automation channels and block unknown scripted clients.",
      })
    }

    if (blockHeadless && parsed.classification.isHeadless) {
      findings.push({
        id: "ua-headless-block-policy",
        severity: "high",
        confidence: 92,
        category: "fraud-defense",
        title: "Headless browser signature detected",
        description: "Headless browser marker triggered policy block condition.",
        remediation: "Force additional verification for headless browser traffic paths.",
      })
    }

    if (requireKnownOs && parsed.os.name === "Unknown") {
      findings.push({
        id: "ua-unknown-os",
        severity: "medium",
        confidence: 78,
        category: "telemetry-quality",
        title: "Operating system could not be determined",
        description: "Unknown OS classification violates strict telemetry quality policy.",
        remediation: "Capture additional HTTP headers or fingerprint signals for device attribution.",
      })
    }

    if (requireKnownBrowser && parsed.browser.name === "Unknown") {
      findings.push({
        id: "ua-unknown-browser",
        severity: "medium",
        confidence: 80,
        category: "telemetry-quality",
        title: "Browser identity is unknown",
        description: "User-Agent could not be mapped to a known browser profile.",
        remediation: "Treat unknown browser traffic as elevated risk until corroborated by other controls.",
      })
    }

    const browserMajor = majorVersion(parsed.browser.version)

    if (parsed.browser.name === "Google Chrome" && browserMajor !== null && browserMajor < chromeFloor) {
      findings.push({
        id: "ua-chrome-version-floor",
        severity: "medium",
        confidence: 77,
        category: "version-governance",
        title: "Chrome version below minimum floor",
        description: `Detected Chrome ${browserMajor}, required minimum is ${chromeFloor}.`,
        remediation: "Prompt client upgrade or restrict high-risk actions for outdated browsers.",
      })
    }

    if (parsed.browser.name === "Mozilla Firefox" && browserMajor !== null && browserMajor < firefoxFloor) {
      findings.push({
        id: "ua-firefox-version-floor",
        severity: "medium",
        confidence: 77,
        category: "version-governance",
        title: "Firefox version below minimum floor",
        description: `Detected Firefox ${browserMajor}, required minimum is ${firefoxFloor}.`,
        remediation: "Enforce browser upgrade policy for managed endpoints.",
      })
    }

    if (parsed.browser.name === "Microsoft Edge" && browserMajor !== null && browserMajor < edgeFloor) {
      findings.push({
        id: "ua-edge-version-floor",
        severity: "medium",
        confidence: 77,
        category: "version-governance",
        title: "Edge version below minimum floor",
        description: `Detected Edge ${browserMajor}, required minimum is ${edgeFloor}.`,
        remediation: "Restrict sensitive workflows until endpoint browser is updated.",
      })
    }

    if (parsed.browser.name === "Safari" && browserMajor !== null && browserMajor < safariFloor) {
      findings.push({
        id: "ua-safari-version-floor",
        severity: "medium",
        confidence: 76,
        category: "version-governance",
        title: "Safari version below minimum floor",
        description: `Detected Safari ${browserMajor}, required minimum is ${safariFloor}.`,
        remediation: "Apply device upgrade policy or reduce trust score for legacy Safari clients.",
      })
    }

    if (findings.length === 0) {
      findings.push({
        id: "ua-policy-pass",
        severity: "info",
        confidence: 72,
        category: "risk-governance",
        title: "User-Agent satisfies configured policy",
        description: "Parsed User-Agent profile passed risk, automation, and version checks.",
        remediation: "Continue monitoring for drift in automation and legacy client fingerprints.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "User-Agent analysis completed",
      text: `Parsed ${parsed.browser.name} on ${parsed.os.name} with risk score ${parsed.risk.score}.`,
      findings,
      metrics: {
        riskScore: parsed.risk.score,
        signalCount: parsed.risk.signals.length,
        isBot: parsed.classification.isBot ? 1 : 0,
        isAutomated: parsed.classification.isAutomated ? 1 : 0,
      },
      baseScore: Math.max(40, 100 - parsed.risk.score),
    })

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "User-Agent Analyzer",
        summary,
        findings,
        evidence: [
          {
            browser: parsed.browser.name,
            browserVersion: parsed.browser.version,
            os: parsed.os.name,
            deviceType: parsed.device.type,
            riskScore: parsed.risk.score,
            riskLevel: parsed.risk.level,
            signals: parsed.risk.signals.join(" | "),
          },
        ],
        recommendations: [
          "Use User-Agent signals as one input in layered risk scoring, not as a single trust factor.",
          "Require additional verification for bot/automation/headless traffic classes.",
          "Continuously enforce browser version floors for privileged application access.",
        ],
        raw: {
          parsed,
          config: {
            riskThreshold,
            chromeFloor,
            firefoxFloor,
            edgeFloor,
            safariFloor,
            blockBots,
            blockAutomation,
            blockHeadless,
            requireKnownOs,
            requireKnownBrowser,
          },
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null

    const envelope = parseToolResultEnvelope(output, "User-Agent Analyzer")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null

    const parsed = raw?.parsed as UserAgentParseResult | undefined
    if (!parsed) return null

    return (
      <div className="space-y-4">
        <div className="grid gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <span className="block text-xs font-bold text-muted-foreground uppercase">Browser</span>
            <span>
              {parsed.browser.name}
              {parsed.browser.version ? ` ${parsed.browser.version}` : ""}
            </span>
            {parsed.browser.engine && (
              <p className="text-xs text-muted-foreground mt-1">Engine: {parsed.browser.engine}</p>
            )}
          </div>

          <div className="p-3 border rounded bg-muted/20">
            <span className="block text-xs font-bold text-muted-foreground uppercase">Operating System</span>
            <span>
              {parsed.os.name}
              {parsed.os.version ? ` ${parsed.os.version}` : ""}
            </span>
          </div>

          <div className="p-3 border rounded bg-muted/20">
            <span className="block text-xs font-bold text-muted-foreground uppercase">Device</span>
            <span className="capitalize">{parsed.device.type}</span>
            {(parsed.device.vendor || parsed.device.model) && (
              <p className="text-xs text-muted-foreground mt-1">
                {parsed.device.vendor || "Unknown Vendor"}
                {parsed.device.model ? ` / ${parsed.device.model}` : ""}
              </p>
            )}
          </div>

          <div className="p-3 border rounded bg-muted/20">
            <span className="block text-xs font-bold text-muted-foreground uppercase">Risk</span>
            <span className={`font-semibold uppercase ${riskColor(parsed.risk.level)}`}>
              {parsed.risk.level} ({parsed.risk.score}/100)
            </span>
          </div>
        </div>

        <div className="p-3 border rounded bg-muted/20">
          <h3 className="text-sm font-semibold mb-2">Classification</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Bot: {parsed.classification.isBot ? "Yes" : "No"}</div>
            <div>Automated: {parsed.classification.isAutomated ? "Yes" : "No"}</div>
            <div>Headless: {parsed.classification.isHeadless ? "Yes" : "No"}</div>
            <div>Desktop: {parsed.classification.isDesktop ? "Yes" : "No"}</div>
            <div>Mobile: {parsed.classification.isMobile ? "Yes" : "No"}</div>
            <div>Tablet: {parsed.classification.isTablet ? "Yes" : "No"}</div>
          </div>
        </div>

        {parsed.risk.signals.length > 0 && (
          <div className="p-3 border rounded bg-muted/20">
            <h3 className="text-sm font-semibold mb-2">Risk Signals</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              {parsed.risk.signals.map((signal, index) => (
                <li key={index}>- {signal}</li>
              ))}
            </ul>
          </div>
        )}

        {parsed.notes.length > 0 && (
          <div className="p-3 border rounded bg-muted/20">
            <h3 className="text-sm font-semibold mb-2">Notes</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              {parsed.notes.map((note, index) => (
                <li key={index}>- {note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <ToolTemplate
      toolName="User-Agent Analyzer"
      description="Policy-aware User-Agent profiling with automation controls, risk thresholds, and browser version governance."
      actionLabel="Analyze"
      placeholder="Mozilla/5.0 (...)"
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Maximum risk score</Label>
              <Input value={maximumRiskScore} onChange={(event) => setMaximumRiskScore(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Minimum Chrome major</Label>
              <Input value={minimumChromeMajor} onChange={(event) => setMinimumChromeMajor(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Minimum Firefox major</Label>
              <Input value={minimumFirefoxMajor} onChange={(event) => setMinimumFirefoxMajor(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Minimum Edge major</Label>
              <Input value={minimumEdgeMajor} onChange={(event) => setMinimumEdgeMajor(event.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Minimum Safari major</Label>
              <Input value={minimumSafariMajor} onChange={(event) => setMinimumSafariMajor(event.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="ua-block-bots">Block bot signatures</Label>
              <Switch id="ua-block-bots" checked={blockBots} onChange={(event) => setBlockBots(event.target.checked)} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="ua-block-automation">Block automation signatures</Label>
              <Switch
                id="ua-block-automation"
                checked={blockAutomation}
                onChange={(event) => setBlockAutomation(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="ua-block-headless">Block headless browser signatures</Label>
              <Switch
                id="ua-block-headless"
                checked={blockHeadless}
                onChange={(event) => setBlockHeadless(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="ua-known-os">Require known operating system</Label>
              <Switch
                id="ua-known-os"
                checked={requireKnownOs}
                onChange={(event) => setRequireKnownOs(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="ua-known-browser">Require known browser family</Label>
              <Switch
                id="ua-known-browser"
                checked={requireKnownBrowser}
                onChange={(event) => setRequireKnownBrowser(event.target.checked)}
              />
            </div>
          </div>
        </div>
      }
      examples={[
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/121.0.6167.85 Safari/537.36",
      ]}
    />
  )
}
