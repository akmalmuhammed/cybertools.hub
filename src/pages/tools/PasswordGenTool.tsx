import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { generatePassword } from "@/lib/utils/crypto"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { CopyButton } from "@/components/features/CopyButton"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

interface PasswordOptions {
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  symbols: boolean
}

interface PasswordComposition {
  uppercase: number
  lowercase: number
  numbers: number
  symbols: number
  ambiguous: number
}

const AMBIGUOUS_PATTERN = /[Il1O0|]/
const AMBIGUOUS_GLOBAL = /[Il1O0|]/g

function selectedClassCount(options: PasswordOptions): number {
  return Number(options.uppercase) + Number(options.lowercase) + Number(options.numbers) + Number(options.symbols)
}

function characterPoolSize(options: PasswordOptions): number {
  let size = 0
  if (options.uppercase) size += 26
  if (options.lowercase) size += 26
  if (options.numbers) size += 10
  if (options.symbols) size += 26
  return size
}

function estimateEntropyBits(length: number, poolSize: number): number {
  if (length <= 0 || poolSize <= 1) return 0
  return Math.round(length * Math.log2(poolSize) * 100) / 100
}

function longestRepeatRun(password: string): number {
  if (!password) return 0
  let longest = 1
  let current = 1

  for (let i = 1; i < password.length; i += 1) {
    if (password[i] === password[i - 1]) {
      current += 1
      if (current > longest) longest = current
    } else {
      current = 1
    }
  }

  return longest
}

function analyzeComposition(password: string): PasswordComposition {
  const uppercase = (password.match(/[A-Z]/g) ?? []).length
  const lowercase = (password.match(/[a-z]/g) ?? []).length
  const numbers = (password.match(/[0-9]/g) ?? []).length
  const symbols = (password.match(/[^A-Za-z0-9]/g) ?? []).length
  const ambiguous = (password.match(AMBIGUOUS_GLOBAL) ?? []).length

  return { uppercase, lowercase, numbers, symbols, ambiguous }
}

function generatePolicyPassword(length: number, options: PasswordOptions, disallowAmbiguous: boolean): string {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const candidate = generatePassword(length, options)
    if (disallowAmbiguous && AMBIGUOUS_PATTERN.test(candidate)) {
      continue
    }
    return candidate
  }

  throw new Error("Unable to generate password that satisfies ambiguity policy")
}

export default function PasswordGenTool() {
  const [length, setLength] = useState(16)
  const [options, setOptions] = useState<PasswordOptions>({
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
  })

  const [minimumLengthPolicy, setMinimumLengthPolicy] = useState("14")
  const [minimumEntropyBits, setMinimumEntropyBits] = useState("80")
  const [minimumSymbolCount, setMinimumSymbolCount] = useState("2")
  const [maxRepeatRun, setMaxRepeatRun] = useState("2")
  const [requireClassDiversity, setRequireClassDiversity] = useState(true)
  const [disallowAmbiguousChars, setDisallowAmbiguousChars] = useState(true)

  const process = (_input: string) => {
    const minLength = Math.max(8, Number(minimumLengthPolicy) || 14)
    const minEntropy = Math.max(20, Number(minimumEntropyBits) || 80)
    const minSymbols = Math.max(0, Number(minimumSymbolCount) || 2)
    const repeatLimit = Math.max(1, Number(maxRepeatRun) || 2)
    const requiredClasses = requireClassDiversity ? 3 : 1

    const password = generatePolicyPassword(length, options, disallowAmbiguousChars)
    const composition = analyzeComposition(password)
    const classes = selectedClassCount(options)
    const poolSize = characterPoolSize(options)
    const entropyBits = estimateEntropyBits(password.length, poolSize)
    const repeatedRun = longestRepeatRun(password)

    const findings: ToolFinding[] = []

    if (classes < requiredClasses) {
      findings.push({
        id: "password-class-diversity-low",
        severity: "high",
        confidence: 93,
        category: "password-policy",
        title: "Character-class diversity below policy",
        description: `Selected ${classes} character class(es), but policy requires at least ${requiredClasses}.`,
        remediation: "Enable additional classes (uppercase/lowercase/numbers/symbols) to improve resilience.",
      })
    }

    if (password.length < minLength) {
      findings.push({
        id: "password-length-below-policy",
        severity: password.length < minLength - 4 ? "high" : "medium",
        confidence: 91,
        category: "password-policy",
        title: "Password length below policy",
        description: `Generated length ${password.length} is below required minimum ${minLength}.`,
        remediation: "Increase minimum length policy and regenerate password.",
      })
    }

    if (entropyBits < minEntropy) {
      findings.push({
        id: "password-entropy-below-policy",
        severity: entropyBits < minEntropy - 15 ? "high" : "medium",
        confidence: 88,
        category: "entropy",
        title: "Estimated entropy below policy floor",
        description: `Estimated entropy ${entropyBits} bits is below required ${minEntropy} bits.`,
        remediation: "Increase length and class diversity to raise entropy.",
      })
    }

    if (minSymbols > 0 && composition.symbols < minSymbols) {
      findings.push({
        id: "password-symbol-requirement-missed",
        severity: "medium",
        confidence: 86,
        category: "password-policy",
        title: "Symbol requirement not met",
        description: `Password includes ${composition.symbols} symbol(s), minimum required is ${minSymbols}.`,
        remediation: "Enable symbols and raise length to satisfy symbol composition policy.",
      })
    }

    if (repeatedRun > repeatLimit) {
      findings.push({
        id: "password-repeat-run-exceeded",
        severity: repeatedRun > repeatLimit + 1 ? "medium" : "low",
        confidence: 76,
        category: "password-quality",
        title: "Repeated-character run exceeds threshold",
        description: `Longest repeated run is ${repeatedRun}, policy allows up to ${repeatLimit}.`,
        remediation: "Regenerate password and cap repeated character sequences.",
      })
    }

    if (disallowAmbiguousChars && composition.ambiguous > 0) {
      findings.push({
        id: "password-ambiguous-characters-detected",
        severity: "medium",
        confidence: 85,
        category: "usability-risk",
        title: "Ambiguous characters detected",
        description: `Password includes ${composition.ambiguous} ambiguous character(s) despite policy.`,
        remediation: "Regenerate with ambiguity restriction enabled.",
      })
    }

    if (findings.length === 0) {
      findings.push({
        id: "password-policy-pass",
        severity: "info",
        confidence: 72,
        category: "password-policy",
        title: "Password satisfies configured policy",
        description: "Generated password meets configured composition, entropy, and repetition policies.",
        remediation: "Store password in an approved secret manager and rotate per lifecycle policy.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "Password generation completed",
      text: `Generated ${password.length}-character password with estimated entropy ${entropyBits} bits.`,
      findings,
      metrics: {
        length: password.length,
        entropyBits,
        classCount: classes,
        symbols: composition.symbols,
        longestRepeatRun: repeatedRun,
      },
      baseScore: 100,
    })

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "Password Generator",
        summary,
        findings,
        evidence: [
          {
            password,
            length: password.length,
            entropyBits,
            repeatedRun,
            composition,
          },
        ],
        recommendations: [
          "Set minimum password length to at least 14-16 for privileged accounts.",
          "Require at least three character classes with symbol presence for high-risk systems.",
          "Treat generated passwords as secrets and store only in approved vault workflows.",
        ],
        raw: {
          password,
          composition,
          entropyBits,
          repeatedRun,
          config: {
            length,
            options,
            minLength,
            minEntropy,
            minSymbols,
            repeatLimit,
            requiredClasses,
            disallowAmbiguousChars,
          },
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null

    const envelope = parseToolResultEnvelope(output, "Password Generator")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null

    const password = typeof raw?.password === "string" ? raw.password : ""
    const composition = raw?.composition && typeof raw.composition === "object" && raw.composition !== null
      ? (raw.composition as Record<string, unknown>)
      : null
    const entropyBits = typeof raw?.entropyBits === "number" ? raw.entropyBits : null

    if (!password) return null

    return (
      <div className="space-y-4">
        <div className="p-4 rounded-lg border bg-muted/20 space-y-2">
          <div className="text-xs uppercase text-muted-foreground">Generated Password</div>
          <div className="flex items-center justify-between gap-2">
            <code className="font-mono text-sm break-all">{password}</code>
            <CopyButton text={password} size="sm" variant="outline" fullWidth={false} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="p-3 rounded border bg-muted/20">Length: {password.length}</div>
          <div className="p-3 rounded border bg-muted/20">Entropy: {entropyBits ?? "n/a"} bits</div>
          <div className="p-3 rounded border bg-muted/20">Uppercase: {String(composition?.uppercase ?? 0)}</div>
          <div className="p-3 rounded border bg-muted/20">Lowercase: {String(composition?.lowercase ?? 0)}</div>
          <div className="p-3 rounded border bg-muted/20">Numbers: {String(composition?.numbers ?? 0)}</div>
          <div className="p-3 rounded border bg-muted/20">Symbols: {String(composition?.symbols ?? 0)}</div>
        </div>
      </div>
    )
  }

  return (
    <ToolTemplate
      toolName="Password Generator"
      description="Generate policy-driven passwords with enterprise composition and entropy governance controls."
      actionLabel="Generate"
      placeholder="Click Generate to create a password (input text is ignored)"
      requiresInput={false}
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-4 p-4 border rounded-md">
          <div className="flex flex-col gap-2">
            <Label>Length: {length}</Label>
            <Slider
              value={[length]}
              min={8}
              max={64}
              step={1}
              onValueChange={(values) => setLength(values[0])}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="uppercase"
                checked={options.uppercase}
                onCheckedChange={(checked) => setOptions((prev) => ({ ...prev, uppercase: !!checked }))}
              />
              <label htmlFor="uppercase" className="text-sm font-medium leading-none cursor-pointer">
                Uppercase (A-Z)
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="lowercase"
                checked={options.lowercase}
                onCheckedChange={(checked) => setOptions((prev) => ({ ...prev, lowercase: !!checked }))}
              />
              <label htmlFor="lowercase" className="text-sm font-medium leading-none cursor-pointer">
                Lowercase (a-z)
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="numbers"
                checked={options.numbers}
                onCheckedChange={(checked) => setOptions((prev) => ({ ...prev, numbers: !!checked }))}
              />
              <label htmlFor="numbers" className="text-sm font-medium leading-none cursor-pointer">
                Numbers (0-9)
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="symbols"
                checked={options.symbols}
                onCheckedChange={(checked) => setOptions((prev) => ({ ...prev, symbols: !!checked }))}
              />
              <label htmlFor="symbols" className="text-sm font-medium leading-none cursor-pointer">
                Symbols (!@#$)
              </label>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Minimum length policy</Label>
              <Input value={minimumLengthPolicy} onChange={(event) => setMinimumLengthPolicy(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Minimum entropy (bits)</Label>
              <Input value={minimumEntropyBits} onChange={(event) => setMinimumEntropyBits(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Minimum symbol count</Label>
              <Input value={minimumSymbolCount} onChange={(event) => setMinimumSymbolCount(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Max repeated run</Label>
              <Input value={maxRepeatRun} onChange={(event) => setMaxRepeatRun(event.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="require-diversity">Require 3+ character classes</Label>
              <Switch
                id="require-diversity"
                checked={requireClassDiversity}
                onChange={(event) => setRequireClassDiversity(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="disallow-ambiguous">Disallow ambiguous characters (I, l, 1, O, 0)</Label>
              <Switch
                id="disallow-ambiguous"
                checked={disallowAmbiguousChars}
                onChange={(event) => setDisallowAmbiguousChars(event.target.checked)}
              />
            </div>
          </div>
        </div>
      }
    />
  )
}
