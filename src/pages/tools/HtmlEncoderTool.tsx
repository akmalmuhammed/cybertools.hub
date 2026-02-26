import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { encodeHTML, decodeHTML } from "@/lib/utils/encoders"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { buildToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

interface HtmlSignals {
  scriptCount: number
  inlineHandlerCount: number
  javascriptUriCount: number
  iframeCount: number
  dataUriCount: number
  formActionCount: number
}

function inspectHtmlSignals(html: string): HtmlSignals {
  const lowered = html.toLowerCase()

  return {
    scriptCount: (html.match(/<script\b/gi) ?? []).length,
    inlineHandlerCount: (html.match(/\son[a-z]+\s*=/gi) ?? []).length,
    javascriptUriCount: (lowered.match(/javascript:/g) ?? []).length,
    iframeCount: (html.match(/<iframe\b/gi) ?? []).length,
    dataUriCount: (lowered.match(/data:[a-z0-9.+-]+\/[a-z0-9.+-]+/g) ?? []).length,
    formActionCount: (html.match(/<form\b[^>]*\saction\s*=/gi) ?? []).length,
  }
}

export default function HtmlEncoderTool() {
  const [mode, setMode] = useState<"encode" | "decode">("encode")
  const [maxOutputChars, setMaxOutputChars] = useState("8192")
  const [blockScriptTags, setBlockScriptTags] = useState(true)
  const [blockInlineHandlers, setBlockInlineHandlers] = useState(true)
  const [blockJavascriptUris, setBlockJavascriptUris] = useState(true)
  const [blockDataUris, setBlockDataUris] = useState(false)
  const [blockIframes, setBlockIframes] = useState(false)
  const [requireEncodingChange, setRequireEncodingChange] = useState(true)

  const handleModeChange = (value: string) => {
    if (value === "encode" || value === "decode") {
      setMode(value)
    }
  }

  const process = (input: string) => {
    const output = mode === "encode" ? encodeHTML(input) : decodeHTML(input)
    const analysisTarget = mode === "decode" ? output : input
    const findings: ToolFinding[] = []

    const signals = inspectHtmlSignals(analysisTarget)
    const outputLimit = Math.max(64, Number(maxOutputChars) || 8192)

    if (blockScriptTags && signals.scriptCount > 0) {
      findings.push({
        id: "html-script-tag-policy",
        severity: "high",
        confidence: 92,
        category: "xss-risk",
        title: "Script tag content violates policy",
        description: `Detected ${signals.scriptCount} <script> tag occurrence(s) in payload.`,
        remediation: "Strip active script content and sanitize before rendering.",
      })
    }

    if (blockInlineHandlers && signals.inlineHandlerCount > 0) {
      findings.push({
        id: "html-inline-handler-policy",
        severity: "medium",
        confidence: 86,
        category: "xss-risk",
        title: "Inline event handlers detected",
        description: `Detected ${signals.inlineHandlerCount} inline event handler attribute(s).`,
        remediation: "Disallow inline handlers and enforce CSP nonce/hash controls.",
      })
    }

    if (blockJavascriptUris && signals.javascriptUriCount > 0) {
      findings.push({
        id: "html-javascript-uri-policy",
        severity: "high",
        confidence: 90,
        category: "xss-risk",
        title: "javascript: URI detected",
        description: `Detected ${signals.javascriptUriCount} javascript: URI occurrence(s).`,
        remediation: "Reject javascript: URI schemes and allowlist safe protocols only.",
      })
    }

    if (blockDataUris && signals.dataUriCount > 0) {
      findings.push({
        id: "html-data-uri-policy",
        severity: "medium",
        confidence: 78,
        category: "content-security",
        title: "Data URI content blocked by policy",
        description: `Detected ${signals.dataUriCount} data URI occurrence(s).`,
        remediation: "Avoid inline data payloads in untrusted content and use vetted media hosting.",
      })
    }

    if (blockIframes && signals.iframeCount > 0) {
      findings.push({
        id: "html-iframe-policy",
        severity: "medium",
        confidence: 74,
        category: "content-security",
        title: "Iframe markup blocked by policy",
        description: `Detected ${signals.iframeCount} iframe occurrence(s) in content.`,
        remediation: "Restrict iframe embedding to approved origins with sandbox controls.",
      })
    }

    if (output.length > outputLimit) {
      findings.push({
        id: "html-output-length-policy",
        severity: output.length > outputLimit * 2 ? "high" : "medium",
        confidence: 80,
        category: "payload-governance",
        title: "Output size exceeds policy",
        description: `Output contains ${output.length} chars; configured limit is ${outputLimit}.`,
        remediation: "Split large payloads and enforce size controls in downstream workflows.",
      })
    }

    if (mode === "encode" && requireEncodingChange && output === input && /[<>'"&]/.test(input)) {
      findings.push({
        id: "html-encode-no-change",
        severity: "medium",
        confidence: 76,
        category: "transformation-quality",
        title: "Encoding output unchanged despite unsafe characters",
        description: "Input contains HTML control characters but encoded output did not materially change.",
        remediation: "Verify rendering context and apply strict output encoding before template injection.",
      })
    }

    if (findings.length === 0) {
      findings.push({
        id: "html-policy-pass",
        severity: "info",
        confidence: 71,
        category: "xss-risk",
        title: "HTML transformation passed policy checks",
        description: "No active-content policy violations detected in transformed payload.",
        remediation: "Maintain CSP and context-aware output encoding across templates.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "HTML transformation completed",
      text: mode === "encode"
        ? "HTML entities encoded for safer rendering and transport."
        : "HTML entities decoded for analyst inspection and content review.",
      findings,
      metrics: {
        inputChars: input.length,
        outputChars: output.length,
        scriptTags: signals.scriptCount,
        inlineHandlers: signals.inlineHandlerCount,
      },
      baseScore: 98,
    })

    const recommendations = [
      "Always encode untrusted content before injecting into HTML templates.",
      "Use strict CSP and avoid inline JavaScript/event handlers.",
      "Review decoded payloads before rendering in browser-like contexts.",
      "Apply payload size limits for stored and transported HTML artifacts.",
    ]

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "HTML Encoder",
        summary,
        findings,
        evidence: [
          {
            mode,
            input,
            output,
            analysisTarget,
            changed: output !== input,
            signals,
          },
        ],
        recommendations,
        raw: {
          mode,
          input,
          output,
          signals,
          config: {
            outputLimit,
            blockScriptTags,
            blockInlineHandlers,
            blockJavascriptUris,
            blockDataUris,
            blockIframes,
            requireEncodingChange,
          },
        },
      }),
    )
  }

  return (
    <ToolTemplate
      toolName="HTML Encoder"
      description="Encode/decode HTML entities with XSS policy gates, active-content controls, and payload governance checks."
      actionLabel={mode === "encode" ? "Encode" : "Decode"}
      controls={
        <div className="space-y-3">
          <Tabs value={mode} onValueChange={handleModeChange} className="w-[200px]">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="encode">Encode</TabsTrigger>
              <TabsTrigger value="decode">Decode</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-1">
            <Label>Max output chars</Label>
            <Input value={maxOutputChars} onChange={(event) => setMaxOutputChars(event.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="html-block-script">Block &lt;script&gt; tags</Label>
              <Switch
                id="html-block-script"
                checked={blockScriptTags}
                onChange={(event) => setBlockScriptTags(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="html-block-inline">Block inline event handlers</Label>
              <Switch
                id="html-block-inline"
                checked={blockInlineHandlers}
                onChange={(event) => setBlockInlineHandlers(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="html-block-js-uri">Block javascript: URIs</Label>
              <Switch
                id="html-block-js-uri"
                checked={blockJavascriptUris}
                onChange={(event) => setBlockJavascriptUris(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="html-block-data-uri">Block data: URIs</Label>
              <Switch
                id="html-block-data-uri"
                checked={blockDataUris}
                onChange={(event) => setBlockDataUris(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="html-block-iframe">Block iframe tags</Label>
              <Switch
                id="html-block-iframe"
                checked={blockIframes}
                onChange={(event) => setBlockIframes(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="html-require-change">Require encoding to change unsafe input</Label>
              <Switch
                id="html-require-change"
                checked={requireEncodingChange}
                onChange={(event) => setRequireEncodingChange(event.target.checked)}
              />
            </div>
          </div>
        </div>
      }
      onProcess={process}
      examples={[
        "<script>alert('xss')</script>",
        "&lt;div&gt;Hello&lt;/div&gt;",
      ]}
    />
  )
}
