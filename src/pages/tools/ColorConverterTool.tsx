import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { parseAndConvertColor, type NormalizedColor } from "@/lib/utils/color"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

function toLinear(value: number): number {
  const normalized = value / 255
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(color: NormalizedColor): number {
  const { r, g, b } = color.rgb
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

function contrastRatio(foreground: NormalizedColor, background: NormalizedColor): number {
  const l1 = relativeLuminance(foreground)
  const l2 = relativeLuminance(background)
  const [bright, dark] = l1 >= l2 ? [l1, l2] : [l2, l1]
  return Math.round(((bright + 0.05) / (dark + 0.05)) * 100) / 100
}

function isStatusHue(hue: number): boolean {
  return (
    (hue >= 0 && hue <= 20) ||
    (hue >= 35 && hue <= 65) ||
    (hue >= 80 && hue <= 160) ||
    (hue >= 190 && hue <= 250) ||
    hue >= 340
  )
}

export default function ColorConverterTool() {
  const [backgroundInput, setBackgroundInput] = useState("#FFFFFF")
  const [minimumContrast, setMinimumContrast] = useState("4.5")
  const [maximumSaturation, setMaximumSaturation] = useState("90")
  const [requireStatusPalette, setRequireStatusPalette] = useState(false)
  const [flagLowSaturation, setFlagLowSaturation] = useState(true)

  const process = (input: string) => {
    const converted = parseAndConvertColor(input)
    const minimumContrastFloor = Math.max(1, Number(minimumContrast) || 4.5)
    const saturationLimit = Math.max(0, Math.min(100, Number(maximumSaturation) || 90))

    const findings: ToolFinding[] = []
    const background = parseAndConvertColor(backgroundInput)

    if (converted.hex === background.hex) {
      findings.push({
        id: "color-foreground-background-identical",
        severity: "high",
        confidence: 95,
        category: "accessibility",
        title: "Foreground and background colors are identical",
        description: "Identical colors render content unreadable and fail accessibility baselines.",
        remediation: "Use contrasting colors with adequate WCAG ratio.",
      })
    }

    const ratio = contrastRatio(converted, background)

    if (ratio < minimumContrastFloor) {
      findings.push({
        id: "color-contrast-below-policy",
        severity: ratio < 3 ? "high" : "medium",
        confidence: 90,
        category: "accessibility",
        title: "Contrast ratio below policy",
        description: `Computed contrast ${ratio}:1 is below required ${minimumContrastFloor}:1.`,
        remediation: "Adjust foreground or background to meet minimum contrast requirements.",
      })
    }

    if (converted.hsl.s > saturationLimit) {
      findings.push({
        id: "color-saturation-above-policy",
        severity: "low",
        confidence: 74,
        category: "visual-governance",
        title: "Color saturation exceeds policy",
        description: `Saturation ${converted.hsl.s}% exceeds configured limit ${saturationLimit}%.`,
        remediation: "Reduce saturation for enterprise dashboard readability.",
      })
    }

    if (requireStatusPalette && !isStatusHue(converted.hsl.h)) {
      findings.push({
        id: "color-outside-status-palette",
        severity: "low",
        confidence: 71,
        category: "status-design",
        title: "Hue outside status palette range",
        description: `Hue ${converted.hsl.h} is outside configured status palette bands.`,
        remediation: "Use red/amber/green/blue status bands for risk-state communication.",
      })
    }

    if (flagLowSaturation && converted.hsl.s < 8) {
      findings.push({
        id: "color-low-saturation",
        severity: "low",
        confidence: 68,
        category: "visual-governance",
        title: "Very low saturation color",
        description: "Color appears near grayscale, which may reduce semantic signaling clarity.",
        remediation: "Increase saturation slightly for status-indicator distinction.",
      })
    }

    if (findings.length === 0) {
      findings.push({
        id: "color-policy-pass",
        severity: "info",
        confidence: 70,
        category: "accessibility",
        title: "Color conversion passes policy checks",
        description: "Color satisfies configured contrast and visual-governance controls.",
        remediation: "Keep a centralized approved palette for UI and reporting consistency.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "Color conversion completed",
      text: `Converted ${converted.inputFormat.toUpperCase()} color to HEX/RGB/HSL with policy checks.`,
      findings,
      metrics: {
        contrastRatio: ratio,
        hue: converted.hsl.h,
        saturation: converted.hsl.s,
        lightness: converted.hsl.l,
      },
      baseScore: 99,
    })

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "Color Converter",
        summary,
        findings,
        evidence: [
          {
            inputFormat: converted.inputFormat,
            hex: converted.hex,
            rgb: converted.rgbString,
            hsl: converted.hslString,
            background: background.hex,
            contrastRatio: ratio,
          },
        ],
        recommendations: [
          "Enforce contrast checks in design QA for security dashboards and alerts.",
          "Keep approved status color palettes centralized across product surfaces.",
          "Validate color accessibility against both light and dark report contexts.",
        ],
        raw: {
          converted,
          background,
          contrastRatio: ratio,
          config: {
            minimumContrastFloor,
            saturationLimit,
            requireStatusPalette,
            flagLowSaturation,
          },
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null

    const envelope = parseToolResultEnvelope(output, "Color Converter")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null

    const converted = raw?.converted as NormalizedColor | undefined
    const background = raw?.background as NormalizedColor | undefined
    const ratio = typeof raw?.contrastRatio === "number" ? raw.contrastRatio : null

    if (!converted || !background) return null

    return (
      <div className="flex flex-col gap-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3 space-y-2">
            <div className="text-xs uppercase text-muted-foreground">Foreground</div>
            <div className="w-full h-20 rounded border" style={{ backgroundColor: converted.hex }} />
            <div className="font-mono text-xs">{converted.hex}</div>
          </div>
          <div className="rounded-lg border p-3 space-y-2">
            <div className="text-xs uppercase text-muted-foreground">Background</div>
            <div className="w-full h-20 rounded border" style={{ backgroundColor: background.hex }} />
            <div className="font-mono text-xs">{background.hex}</div>
          </div>
        </div>

        <div
          className="rounded-lg border p-4"
          style={{ backgroundColor: background.hex, color: converted.hex }}
        >
          Security UI Contrast Preview
        </div>

        <div className="grid gap-4">
          <div className="p-3 bg-muted rounded-md flex justify-between items-center">
            <span className="font-bold text-sm text-muted-foreground">HEX</span>
            <span className="font-mono">{converted.hex}</span>
          </div>
          <div className="p-3 bg-muted rounded-md flex justify-between items-center">
            <span className="font-bold text-sm text-muted-foreground">RGB</span>
            <span className="font-mono">{converted.rgbString}</span>
          </div>
          <div className="p-3 bg-muted rounded-md flex justify-between items-center">
            <span className="font-bold text-sm text-muted-foreground">HSL</span>
            <span className="font-mono">{converted.hslString}</span>
          </div>
          <div className="p-3 bg-muted rounded-md flex justify-between items-center">
            <span className="font-bold text-sm text-muted-foreground">Contrast Ratio</span>
            <span className="font-mono">{ratio ? `${ratio}:1` : "n/a"}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ToolTemplate
      toolName="Color Converter"
      description="Convert colors with enterprise accessibility and UI-governance policy controls."
      actionLabel="Convert"
      placeholder="#10B981 or rgb(16,185,129) or hsl(158,84%,39%)"
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Reference background color</Label>
              <Input value={backgroundInput} onChange={(event) => setBackgroundInput(event.target.value)} placeholder="#FFFFFF" />
            </div>
            <div className="space-y-1">
              <Label>Minimum contrast ratio</Label>
              <Input value={minimumContrast} onChange={(event) => setMinimumContrast(event.target.value)} placeholder="4.5" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Maximum saturation (%)</Label>
              <Input value={maximumSaturation} onChange={(event) => setMaximumSaturation(event.target.value)} placeholder="90" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="require-status-palette">Require security status palette hue bands</Label>
              <Switch
                id="require-status-palette"
                checked={requireStatusPalette}
                onChange={(event) => setRequireStatusPalette(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="flag-low-saturation">Flag low-saturation (near grayscale) colors</Label>
              <Switch
                id="flag-low-saturation"
                checked={flagLowSaturation}
                onChange={(event) => setFlagLowSaturation(event.target.checked)}
              />
            </div>
          </div>
        </div>
      }
      examples={["#10B981", "rgb(255, 87, 51)", "hsl(240, 100%, 50%)"]}
    />
  )
}
