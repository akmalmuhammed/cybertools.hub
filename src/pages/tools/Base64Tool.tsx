import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Upload, FileUp, Download, RefreshCw, FileText, Wand2, FileJson, Binary as BinaryIcon, Search, AlertTriangle, FileCode, FileImage } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { encodeBase64, encodeBase64Url, splitLines } from "@/lib/utils/encoders"
import { cleanBase64, detectBinaryType, toHex, formatJSON, extractBase64, base64ToBytes, BinaryDetectionResult, isText } from "@/lib/utils/base64-utils"
import { CopyButton } from "@/components/features/CopyButton"
import { SEO } from "@/components/features/SEO"
import { Badge } from "@/components/ui/badge"
import { useAnalystSession } from "@/lib/hooks/useAnalystSession"
import { AnalystSessionPanel } from "@/components/tools/AnalystSessionPanel"
import { buildToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

interface Base64RunSnapshot {
    durationMs: number
    status: "ok" | "warning" | "error"
    score: number
    findings: number
    summary: string
    mode: string
    metrics: Record<string, number>
}

type Base64GovernanceEnvelope = ReturnType<typeof buildToolResultEnvelope<Record<string, unknown>>>

export default function Base64Tool() {
    const session = useAnalystSession("base64")
    const [mode, setMode] = useState<"encode" | "decode">("encode")
    const [inputType, setInputType] = useState<"text" | "file">("text")
    const [input, setInput] = useState("")
    const [fileName, setFileName] = useState<string | null>(null)

    // Outputs
    const [outputText, setOutputText] = useState("") // For Text/JSON
    const [inputBytes, setInputBytes] = useState<Uint8Array | null>(null) // For Encode (binary input)
    const [outputBytes, setOutputBytes] = useState<Uint8Array | null>(null) // For Decode (binary output)
    const [hexOutput, setHexOutput] = useState("")
    const [jsonOutput, setJsonOutput] = useState<string | null>(null)
    const [fixIssues, setFixIssues] = useState<string[]>([])
    const [detection, setDetection] = useState<BinaryDetectionResult | null>(null)
    const [activeTab, setActiveTab] = useState("text")
    const [lastRunSnapshot, setLastRunSnapshot] = useState<Base64RunSnapshot | null>(null)
    const [governanceEnvelope, setGovernanceEnvelope] = useState<Base64GovernanceEnvelope | null>(null)

    const [error, setError] = useState<string | null>(null)

    // Options
    const [liveMode, setLiveMode] = useState(true)
    const [urlSafe, setUrlSafe] = useState(false)
    const [doSplitLines, setDoSplitLines] = useState(false)
    const [autoFix, setAutoFix] = useState(true)
    const [maxDecodedBytesInput, setMaxDecodedBytesInput] = useState("2000000")
    const [maxOutputCharsInput, setMaxOutputCharsInput] = useState("200000")
    const [maxAutoFixIssuesInput, setMaxAutoFixIssuesInput] = useState("4")
    const [requireJsonPayload, setRequireJsonPayload] = useState(false)
    const [forbidExecutablePayload, setForbidExecutablePayload] = useState(true)
    const [forbidArchivePayload, setForbidArchivePayload] = useState(false)
    const [strictAutoFixPolicy, setStrictAutoFixPolicy] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)

    const isMode = (value: string): value is "encode" | "decode" =>
        value === "encode" || value === "decode"

    const isInputType = (value: string): value is "text" | "file" =>
        value === "text" || value === "file"

    const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => Uint8Array.from(bytes).buffer

    const handleModeChange = (value: string) => {
        if (!isMode(value)) return
        setMode(value)
        setOutputText("")
        setOutputBytes(null)
        setError(null)
        setHexOutput("")
        setJsonOutput(null)
        setFixIssues([])
        setDetection(null)
        setLastRunSnapshot(null)
        setGovernanceEnvelope(null)
    }

    const handleInputTypeChange = (value: string) => {
        if (isInputType(value)) {
            setInputType(value)
        }
    }

    const process = useCallback(async (text: string) => {
        setError(null)
        setFixIssues([])
        const startedAt = performance.now()

        if (!text && inputType === 'text' && !inputBytes) {
            setOutputText("")
            setOutputBytes(null)
            setHexOutput("")
            setJsonOutput(null)
            setDetection(null)
            setLastRunSnapshot(null)
            setGovernanceEnvelope(null)
            return
        }

        try {
            let processed = text
            let outputChars = 0
            let outputByteCount = 0
            let jsonDetected = 0
            let detectedType = "none"
            let autoFixIssueCount = 0
            let binaryDetected = 0

            const maxDecodedBytes = Math.max(256, Number(maxDecodedBytesInput) || 2000000)
            const maxOutputChars = Math.max(256, Number(maxOutputCharsInput) || 200000)
            const maxAutoFixIssues = Math.max(0, Number(maxAutoFixIssuesInput) || 4)
            const policyFindings: ToolFinding[] = []

            if (mode === "decode") {
                if (autoFix && inputType === "text") {
                    const { cleaned, issues } = cleanBase64(text)
                    if (issues.length > 0) {
                        setFixIssues(issues)
                        processed = cleaned
                        autoFixIssueCount = issues.length
                    }
                }

                let bytes: Uint8Array
                try {
                    let safeInput = processed
                    if (urlSafe) {
                        safeInput = safeInput.replace(/-/g, "+").replace(/_/g, "/")
                    }
                    while (safeInput.length % 4) safeInput += "="

                    bytes = base64ToBytes(safeInput)
                } catch {
                    throw new Error("Invalid Base64 input. Try Auto-Fix.")
                }

                setOutputBytes(bytes)
                outputByteCount = bytes.byteLength

                const detected = detectBinaryType(bytes)
                setDetection(detected)
                detectedType = detected?.type ?? "none"

                const hexValue = toHex(bytes)
                setHexOutput(hexValue)
                outputChars = hexValue.length

                const looksLikeText = isText(bytes)
                binaryDetected = detected || !looksLikeText ? 1 : 0

                if (detected || !looksLikeText) {
                    setActiveTab("hex")
                    setOutputText("")
                    setJsonOutput(null)
                } else {
                    const decodedStr = new TextDecoder().decode(bytes)
                    setOutputText(decodedStr)
                    outputChars = decodedStr.length
                    setActiveTab("text")

                    const fmts = formatJSON(decodedStr)
                    if (fmts) {
                        setJsonOutput(fmts)
                        setActiveTab("json")
                        jsonDetected = 1
                    } else {
                        setJsonOutput(null)
                    }
                }
            } else {
                let result = ""

                if (inputType === "file" && inputBytes) {
                    result = btoa(Array.from(inputBytes, (byte) => String.fromCharCode(byte)).join(""))
                    outputByteCount = inputBytes.byteLength
                } else if (inputType === "file" && !inputBytes) {
                    throw new Error("Upload a file to encode.")
                } else {
                    result = urlSafe ? encodeBase64Url(processed) : encodeBase64(processed)
                }

                if (doSplitLines) {
                    result = splitLines(result)
                }

                setOutputText(result)
                setOutputBytes(null)
                setActiveTab("text")
                setJsonOutput(null)
                setHexOutput("")
                setDetection(null)
                outputChars = result.length
            }

            if (autoFixIssueCount > maxAutoFixIssues) {
                policyFindings.push({
                    id: "base64-autofix-issues-threshold",
                    severity: autoFixIssueCount > maxAutoFixIssues + 3 ? "high" : "medium",
                    confidence: 84,
                    category: "input-quality",
                    title: "Auto-fix repaired many Base64 issues",
                    description: `Detected ${autoFixIssueCount} fix operation(s), exceeding configured threshold ${maxAutoFixIssues}.`,
                    remediation: "Review source payload integrity before decoding suspiciously malformed content.",
                })
            }

            if (strictAutoFixPolicy && autoFixIssueCount > 0) {
                policyFindings.push({
                    id: "base64-autofix-strict-mode",
                    severity: "high",
                    confidence: 89,
                    category: "policy-gate",
                    title: "Strict mode rejects auto-fixed payloads",
                    description: "Payload required auto-fix, which violates strict Base64 hygiene policy.",
                    remediation: "Require valid canonical Base64 input before processing in strict mode.",
                })
            }

            if (mode === "decode" && outputByteCount > maxDecodedBytes) {
                policyFindings.push({
                    id: "base64-decoded-size-limit",
                    severity: outputByteCount > maxDecodedBytes * 2 ? "high" : "medium",
                    confidence: 82,
                    category: "payload-governance",
                    title: "Decoded payload exceeds byte-size limit",
                    description: `Decoded output ${outputByteCount} bytes exceeds configured limit ${maxDecodedBytes}.`,
                    remediation: "Cap decoded payload sizes to reduce memory and triage overhead.",
                })
            }

            if (outputChars > maxOutputChars) {
                policyFindings.push({
                    id: "base64-output-char-limit",
                    severity: outputChars > maxOutputChars * 2 ? "high" : "medium",
                    confidence: 80,
                    category: "payload-governance",
                    title: "Output character volume exceeds policy",
                    description: `Output has ${outputChars} chars; configured limit is ${maxOutputChars}.`,
                    remediation: "Split oversized payloads and preserve partial evidence for controlled review.",
                })
            }

            if (mode === "decode" && requireJsonPayload && jsonDetected === 0) {
                policyFindings.push({
                    id: "base64-json-required",
                    severity: "high",
                    confidence: 86,
                    category: "content-policy",
                    title: "Decoded payload is not JSON",
                    description: "JSON-only policy is enabled but decoded payload did not parse as JSON.",
                    remediation: "Disable JSON-only policy or provide expected serialized JSON payloads.",
                })
            }

            if (forbidExecutablePayload && (detectedType === "exe" || detectedType === "elf")) {
                policyFindings.push({
                    id: "base64-executable-detected",
                    severity: "high",
                    confidence: 92,
                    category: "malware-safety",
                    title: "Executable payload detected",
                    description: `Detected executable payload type (${detectedType}) in decoded content.`,
                    remediation: "Route executable payloads to isolated sandbox workflows before analysis.",
                })
            }

            if (forbidArchivePayload && (detectedType === "zip")) {
                policyFindings.push({
                    id: "base64-archive-detected",
                    severity: "medium",
                    confidence: 78,
                    category: "payload-safety",
                    title: "Archive payload detected",
                    description: "Detected archive content while archive-blocking policy is enabled.",
                    remediation: "Only process archive payloads in approved decompression and scanning pipelines.",
                })
            }

            if (policyFindings.length === 0) {
                policyFindings.push({
                    id: "base64-policy-pass",
                    severity: "info",
                    confidence: 70,
                    category: "payload-governance",
                    title: "Base64 processing passed policy checks",
                    description: "No governance violations detected for this Base64 run.",
                    remediation: "Keep payload size and content-type controls enabled for enterprise workflows.",
                })
            }

            const summary = createSummaryFromFindings({
                title: "Base64 governance assessment",
                text: mode === "decode"
                    ? `Decoded payload with ${binaryDetected ? "binary" : "text"} output analysis.`
                    : "Encoded payload with output governance checks.",
                findings: policyFindings,
                metrics: {
                    inputChars: text.length,
                    outputChars,
                    outputBytes: outputByteCount,
                    jsonDetected,
                    autoFixIssueCount,
                    binaryDetected,
                },
                baseScore: 96,
            })

            const envelope = buildToolResultEnvelope({
                toolName: "Base64 Ultimate",
                summary,
                findings: policyFindings,
                evidence: [
                    {
                        mode: `${mode}-${inputType}`,
                        inputChars: text.length,
                        outputChars,
                        outputBytes: outputByteCount,
                        jsonDetected: jsonDetected === 1,
                        autoFixIssueCount,
                        detectedType,
                        binaryDetected: binaryDetected === 1,
                    },
                ],
                recommendations: [
                    "Apply strict Base64 hygiene checks before decoding untrusted sources.",
                    "Route executable and archive payloads to isolated analysis environments.",
                    "Use explicit JSON-only mode for structured telemetry pipelines.",
                ],
                raw: {
                    mode,
                    inputType,
                    detectedType,
                    outputChars,
                    outputByteCount,
                    jsonDetected,
                    autoFixIssueCount,
                    policy: {
                        maxDecodedBytes,
                        maxOutputChars,
                        maxAutoFixIssues,
                        requireJsonPayload,
                        forbidExecutablePayload,
                        forbidArchivePayload,
                        strictAutoFixPolicy,
                    },
                },
            })
            setGovernanceEnvelope(envelope)

            const durationMs = Math.max(1, Math.round(performance.now() - startedAt))
            const meaningfulFindings = policyFindings.filter((finding) => finding.severity !== "info").length
            setLastRunSnapshot({
                durationMs,
                status: summary.status,
                score: summary.score ?? 96,
                findings: meaningfulFindings,
                summary: summary.text,
                mode: `${mode}-${inputType}`,
                metrics: {
                    inputChars: text.length,
                    outputChars,
                    outputBytes: outputByteCount,
                    jsonDetected,
                    autoFixIssues: autoFixIssueCount,
                    binaryDetected,
                },
            })

        } catch (err) {
            console.error(err)
            const message = err instanceof Error ? err.message : "Processing error"
            setError(message)
            setOutputText("")
            setHexOutput("")
            setOutputBytes(null)
            setJsonOutput(null)
            setDetection(null)
            const errorFinding: ToolFinding = {
                id: "base64-processing-error",
                severity: "high",
                confidence: 90,
                category: "pipeline-health",
                title: "Base64 processing failed",
                description: message,
                remediation: "Validate input structure and retry with policy-compliant payload content.",
            }
            const summary = createSummaryFromFindings({
                title: "Base64 processing failed",
                text: message,
                findings: [errorFinding],
                metrics: {
                    inputChars: text.length,
                },
                baseScore: 38,
            })
            const envelope = buildToolResultEnvelope({
                toolName: "Base64 Ultimate",
                summary,
                findings: [errorFinding],
                evidence: [
                    {
                        mode: `${mode}-${inputType}`,
                        inputChars: text.length,
                    },
                ],
                recommendations: [
                    "Validate Base64 formatting before decode operations.",
                    "Use Auto-Fix only for controlled triage workflows.",
                ],
                raw: { mode, inputType, error: message },
            })
            setGovernanceEnvelope(envelope)
            const durationMs = Math.max(1, Math.round(performance.now() - startedAt))
            setLastRunSnapshot({
                durationMs,
                status: summary.status,
                score: summary.score ?? 38,
                findings: 1,
                summary: summary.text,
                mode: `${mode}-${inputType}`,
                metrics: {
                    inputChars: text.length,
                    outputChars: 0,
                    outputBytes: 0,
                    jsonDetected: 0,
                },
            })
        }
    }, [
        mode,
        urlSafe,
        doSplitLines,
        inputType,
        autoFix,
        inputBytes,
        maxDecodedBytesInput,
        maxOutputCharsInput,
        maxAutoFixIssuesInput,
        requireJsonPayload,
        forbidExecutablePayload,
        forbidArchivePayload,
        strictAutoFixPolicy,
    ])

    // Effect for Live Mode
    useEffect(() => {
        if (liveMode) {
            if (inputType === 'text') {
                process(input)
            } else if (inputType === 'file' && inputBytes) {
                // For file input, `input` is empty, so we need to trigger based on `inputBytes`
                // The `process` function already handles `inputBytes` directly.
                // We just need to ensure it's called when inputBytes changes.
                process(""); // Pass empty string, process will use inputBytes
            }
        }
    }, [input, inputBytes, liveMode, process, inputType])

    const handleIncomingFile = (file: File) => {
        if (!file) return

        setFileName(file.name)
        setError(null)
        setFixIssues([])

        if (mode === 'encode') {
            // Read as ArrayBuffer for binary safety
            const reader = new FileReader();
            reader.onload = (e) => {
                const buffer = e.target?.result as ArrayBuffer;
                const bytes = new Uint8Array(buffer);
                setInputBytes(bytes);
                setInput(""); // Clear text input
            };
            reader.readAsArrayBuffer(file);
        } else {
            // Decode File: The file contains Base64 TEXT.
            // Read as text.
            const reader = new FileReader()
            reader.onload = (e) => {
                const text = e.target?.result as string
                setInput(text)
                setInputBytes(null);
            }
            reader.readAsText(file)
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) handleIncomingFile(file)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        const file = e.dataTransfer.files?.[0]
        if (file) {
            handleIncomingFile(file)
        }
    }

    const handleDownload = () => {
        if (mode === 'decode' && outputBytes) {
            // Download binary
            const blob = new Blob([toArrayBuffer(outputBytes)], { type: detection?.mime || "application/octet-stream" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `decoded.${detection?.ext || 'bin'}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else if (outputText) {
            // Text download
            const blob = new Blob([outputText], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "encoded.txt";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }

    const extractFromInput = () => {
        const extracted = extractBase64(input);
        if (extracted.length > 0) {
            const best = extracted.sort((a, b) => b.length - a.length)[0];
            setInput(best);
        }
    }

    const captureRun = () => {
        if (!lastRunSnapshot) return
        session.recordRun({
            durationMs: lastRunSnapshot.durationMs,
            status: lastRunSnapshot.status,
            score: lastRunSnapshot.score,
            findings: lastRunSnapshot.findings,
            summary: lastRunSnapshot.summary,
            mode: lastRunSnapshot.mode,
            metrics: lastRunSnapshot.metrics,
        })
    }

    const exportEvidencePack = () => {
        const payload = session.attachContext({
            toolName: "Base64 Ultimate",
            exportedAt: new Date().toISOString(),
            mode,
            inputType,
            fileName,
            options: {
                liveMode,
                urlSafe,
                doSplitLines,
                autoFix,
            },
            snapshot: lastRunSnapshot,
            governance: governanceEnvelope,
            fixIssues,
            detection,
            evidence: {
                inputChars: input.length,
                outputChars: outputText.length,
                outputBytes: outputBytes?.byteLength ?? 0,
                outputPreview: outputText.slice(0, 5000),
                hexPreview: hexOutput.slice(0, 5000),
                jsonPreview: jsonOutput?.slice(0, 5000) ?? "",
            },
        })

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement("a")
        anchor.href = url
        anchor.download = "base64-session-evidence.json"
        document.body.appendChild(anchor)
        anchor.click()
        document.body.removeChild(anchor)
        URL.revokeObjectURL(url)
    }

    // Function to render image preview
    const renderPreview = () => {
        if (detection && detection.type === 'image' && outputBytes) {
            const blob = new Blob([toArrayBuffer(outputBytes)], { type: detection.mime });
            const url = URL.createObjectURL(blob);
            return (
                <div className="flex flex-col items-center justify-center p-4 bg-black/5 rounded-lg border border-border">
                    <img src={url} alt="Decoded Preview" className="max-h-[300px] object-contain rounded shadow-sm" />
                    <p className="mt-2 text-xs text-muted-foreground">{detection.description} ({outputBytes.byteLength} bytes)</p>
                </div>
            )
        }
        return null; // Handle other previews later
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <SEO
                title="Base64 Smart Tools"
                description="Advanced Base64 encoder/decoder with binary detection, hex inspection, JSON detection, and auto-fix cleanup."
                canonical="/tools/base64"
                keywords={[
                    "base64 encode decode",
                    "base64 binary detector",
                    "base64 to hex",
                    "base64 cleanup tool",
                ]}
                breadcrumbItems={[
                    { name: "Home", url: "/" },
                    { name: "Tools", url: "/tools" },
                    { name: "Data Security & Privacy Engineering", url: "/domains/data-security-privacy-engineering" },
                    { name: "Base64 Converter", url: "/tools/base64" },
                ]}
                structuredData={{
                    "@context": "https://schema.org",
                    "@type": "SoftwareApplication",
                    name: "Base64 Converter",
                    description: "Advanced Base64 encoder and decoder with binary detection and safe transformation workflows.",
                    applicationCategory: "Data Security Tool",
                    operatingSystem: "Web Browser",
                    offers: {
                        "@type": "Offer",
                        price: "0",
                        priceCurrency: "USD",
                    },
                }}
            />

            <div className="text-center space-y-4">
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    Base64 Ultimate
                </h1>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                    Binary-safe Base64 tools. Detects EXEs, ZIPs, Images, and PDFs. Auto-fixes padding and provides Hex analysis.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={captureRun} disabled={!lastRunSnapshot}>
                        Capture Run
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportEvidencePack} disabled={!outputText && !outputBytes}>
                        <Download className="h-4 w-4 mr-2" /> Export Session Evidence
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Input Section */}
                <Card className="flex flex-col border-muted-foreground/20 shadow-lg h-full">
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <Tabs value={mode} onValueChange={handleModeChange} className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="encode">Encode</TabsTrigger>
                                    <TabsTrigger value="decode">Decode</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-6 flex flex-col">
                        <Tabs value={inputType} onValueChange={handleInputTypeChange} className="w-full flex-1 flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <TabsList className="">
                                    <TabsTrigger value="text" className="flex gap-2"><FileText className="w-4 h-4" /> Text</TabsTrigger>
                                    <TabsTrigger value="file" className="flex gap-2"><FileUp className="w-4 h-4" /> File</TabsTrigger>
                                </TabsList>
                                <div className="flex gap-2">
                                    {mode === 'decode' && inputType === 'text' && (
                                        <Button variant="ghost" size="sm" onClick={extractFromInput} title="Smart Extract Base64 from logs">
                                            <Search className="h-4 w-4 mr-2" /> Extract Base64
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <TabsContent value="text" className="mt-0 relative group flex-1">
                                <Textarea
                                    placeholder={mode === 'encode' ? "Type content to encode..." : "Paste Base64 here (logs, headers, raw strings)..."}
                                    className="h-full min-h-[300px] font-mono text-sm resize-none focus-visible:ring-primary"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                />
                                {input && mode === 'decode' && fixIssues.length > 0 && (
                                    <div className="absolute bottom-4 right-4 animate-in slide-in-from-bottom-2 fade-in z-10">
                                        <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border-yellow-500/20 gap-1 shadow-sm backdrop-blur-sm">
                                            <Wand2 className="h-3 w-3" /> Auto-Fixed {fixIssues.length} issues
                                        </Badge>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="file" className="mt-0 flex-1">
                                <div
                                    className="border-2 border-dashed border-muted-foreground/25 rounded-lg h-full min-h-[300px] flex flex-col items-center justify-center p-6 transition-colors hover:border-primary/50 bg-muted/50 cursor-pointer"
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                    <div className="rounded-full bg-primary/10 p-4 mb-4">
                                        <Upload className="h-8 w-8 text-primary" />
                                    </div>
                                    <p className="text-sm font-medium text-center mb-1">
                                        {fileName ? fileName : "Click to upload binary or text file"}
                                    </p>
                                    <p className="text-xs text-muted-foreground text-center">
                                        {mode === 'encode' ? "Binaries will be encoded as bytes" : "File should contain Base64 text"}
                                    </p>
                                </div>
                            </TabsContent>
                        </Tabs>

                        {/* Controls */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border border-border/50">
                            <div className="flex items-center justify-between space-x-2">
                                <Label htmlFor="live-mode" className="flex flex-col gap-1">
                                    <span>Live Mode</span>
                                    <span className="font-normal text-xs text-muted-foreground">Auto-process input</span>
                                </Label>
                                <Switch id="live-mode" checked={liveMode} onChange={(e) => setLiveMode(e.target.checked)} />
                            </div>

                            {mode === 'decode' ? (
                                <div className="flex items-center justify-between space-x-2">
                                    <Label htmlFor="auto-fix" className="flex flex-col gap-1">
                                        <span className="flex items-center gap-2"><Wand2 className="h-3 w-3 text-primary" /> Auto Fix</span>
                                        <span className="font-normal text-xs text-muted-foreground">Repairs padding/chars</span>
                                    </Label>
                                    <Switch id="auto-fix" checked={autoFix} onChange={(e) => setAutoFix(e.target.checked)} />
                                </div>
                            ) : (
                                <div className="flex items-center justify-between space-x-2">
                                    <Label htmlFor="split-lines" className="flex flex-col gap-1">
                                        <span>Split Lines (MIME)</span>
                                        <span className="font-normal text-xs text-muted-foreground">76-char line checking</span>
                                    </Label>
                                    <Switch id="split-lines" checked={doSplitLines} onChange={(e) => setDoSplitLines(e.target.checked)} />
                                </div>
                            )}

                            <div className="flex items-center justify-between space-x-2 sm:col-span-2">
                                <Label htmlFor="url-safe" className="flex flex-col gap-1">
                                    <span>URL Safe</span>
                                    <span className="font-normal text-xs text-muted-foreground">Use -_ instead of +/</span>
                                </Label>
                                <Switch id="url-safe" checked={urlSafe} onChange={(e) => setUrlSafe(e.target.checked)} />
                            </div>

                            <div className="sm:col-span-2 border-t pt-4 space-y-3">
                                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Policy Controls</div>
                                <div className="grid sm:grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label htmlFor="max-decoded-bytes">Max decoded bytes</Label>
                                        <Input
                                            id="max-decoded-bytes"
                                            value={maxDecodedBytesInput}
                                            onChange={(event) => setMaxDecodedBytesInput(event.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="max-output-chars">Max output chars</Label>
                                        <Input
                                            id="max-output-chars"
                                            value={maxOutputCharsInput}
                                            onChange={(event) => setMaxOutputCharsInput(event.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1 sm:col-span-2">
                                        <Label htmlFor="max-autofix-issues">Max auto-fix issues</Label>
                                        <Input
                                            id="max-autofix-issues"
                                            value={maxAutoFixIssuesInput}
                                            onChange={(event) => setMaxAutoFixIssuesInput(event.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <Label htmlFor="base64-require-json">Require JSON payload when decoding</Label>
                                        <Switch
                                            id="base64-require-json"
                                            checked={requireJsonPayload}
                                            onChange={(event) => setRequireJsonPayload(event.target.checked)}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <Label htmlFor="base64-forbid-executable">Block executable payload types</Label>
                                        <Switch
                                            id="base64-forbid-executable"
                                            checked={forbidExecutablePayload}
                                            onChange={(event) => setForbidExecutablePayload(event.target.checked)}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <Label htmlFor="base64-forbid-archive">Block archive payload types</Label>
                                        <Switch
                                            id="base64-forbid-archive"
                                            checked={forbidArchivePayload}
                                            onChange={(event) => setForbidArchivePayload(event.target.checked)}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <Label htmlFor="base64-strict-autofix">Reject payloads that require auto-fix</Label>
                                        <Switch
                                            id="base64-strict-autofix"
                                            checked={strictAutoFixPolicy}
                                            onChange={(event) => setStrictAutoFixPolicy(event.target.checked)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {!liveMode && (
                            <Button
                                className="w-full"
                                size="lg"
                                onClick={() => process(input)}
                                disabled={!input && !fileName}
                            >
                                <RefreshCw className="mr-2 h-4 w-4" /> Process
                            </Button>
                        )}
                    </CardContent>
                </Card>

                {/* Output Section */}
                <Card className="flex flex-col border-muted-foreground/20 shadow-lg bg-muted/10 h-full">
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between h-10">
                            <div className="flex items-center gap-2">
                                <CardTitle>Output</CardTitle>
                                {detection && (
                                    <Badge variant="outline" className="ml-2 gap-1 border-primary/50 text-primary">
                                        {detection.type === 'exe' && <FileCode className="h-3 w-3" />}
                                        {detection.type === 'image' && <FileImage className="h-3 w-3" />}
                                        {detection.type === 'zip' && <FileCode className="h-3 w-3" />}
                                        {detection.description}
                                    </Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {(outputText || outputBytes) && (
                                    <>
                                        <Button variant="outline" size="sm" onClick={handleDownload} title="Download Result">
                                            <Download className="h-4 w-4 mr-2" /> Download
                                        </Button>
                                        <CopyButton text={outputText || hexOutput} variant="default" size="sm" />
                                    </>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-[400px] flex flex-col">
                        <AnimatePresence mode="wait">
                            {error ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="h-full flex flex-col items-center justify-center p-6 text-destructive bg-destructive/5 rounded-lg border border-destructive/20 border-dashed"
                                >
                                    <AlertTriangle className="h-12 w-12 mb-4 opacity-50" />
                                    <p className="font-medium">{error}</p>
                                    <p className="text-sm mt-2 opacity-80">Try enabling Auto-Fix</p>
                                </motion.div>
                            ) : (outputText || outputBytes) ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="h-full flex flex-col"
                                >
                                    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col flex-1">
                                        <TabsList className="mb-4">
                                            <TabsTrigger value="text" className="gap-2" disabled={!outputText}><FileText className="h-4 w-4" /> Text</TabsTrigger>
                                            {jsonOutput && <TabsTrigger value="json" className="gap-2"><FileJson className="h-4 w-4" /> JSON</TabsTrigger>}
                                            <TabsTrigger value="hex" className="gap-2"><BinaryIcon className="h-4 w-4" /> Hex Value</TabsTrigger>
                                            {detection?.type === 'image' && <TabsTrigger value="preview" className="gap-2"><FileImage className="h-4 w-4" /> Preview</TabsTrigger>}
                                        </TabsList>

                                        <TabsContent value="text" className="flex-1 mt-0 h-full">
                                            <Textarea
                                                readOnly
                                                value={outputText}
                                                className="h-full min-h-[350px] font-mono text-sm resize-none bg-background/50 border-input/50"
                                            />
                                        </TabsContent>

                                        {jsonOutput && (
                                            <TabsContent value="json" className="flex-1 mt-0 h-full">
                                                <Textarea
                                                    readOnly
                                                    value={jsonOutput}
                                                    className="h-full min-h-[350px] font-mono text-sm resize-none bg-background/50 border-input/50 text-green-600 dark:text-green-400"
                                                />
                                            </TabsContent>
                                        )}

                                        <TabsContent value="hex" className="flex-1 mt-0 h-full">
                                            <Textarea
                                                readOnly
                                                value={hexOutput}
                                                className="h-full min-h-[350px] font-mono text-sm resize-none bg-background/50 border-input/50 tracking-wider uppercase text-blue-600 dark:text-blue-400"
                                            />
                                        </TabsContent>

                                        {detection?.type === 'image' && (
                                            <TabsContent value="preview" className="flex-1 mt-0 h-full flex items-center justify-center">
                                                {renderPreview()}
                                            </TabsContent>
                                        )}
                                    </Tabs>
                                </motion.div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="h-full min-h-[400px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-muted-foreground/20 rounded-lg bg-background/50"
                                >
                                    <div className="p-4 rounded-full bg-muted mb-4">
                                        <RefreshCw className="h-8 w-8 opacity-50" />
                                    </div>
                                    <p className="font-medium">Ready to process</p>
                                    <p className="text-sm opacity-60 mt-1">
                                        Supports Exe, Zip, Images, PDF
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </CardContent>
                </Card>
            </div>

            {governanceEnvelope && (
                <Card className="border-muted-foreground/20">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Governance Findings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                            <Badge variant="outline">Status: {governanceEnvelope.summary.status}</Badge>
                            <Badge variant="secondary">
                                Score: {typeof governanceEnvelope.summary.score === "number" ? governanceEnvelope.summary.score : "n/a"}
                            </Badge>
                            <Badge variant="secondary">Findings: {governanceEnvelope.findings.length}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{governanceEnvelope.summary.text}</p>
                        {governanceEnvelope.findings.length > 0 && (
                            <ul className="text-sm text-muted-foreground space-y-1">
                                {governanceEnvelope.findings.slice(0, 5).map((finding) => (
                                    <li key={finding.id}>[{finding.severity.toUpperCase()}] {finding.title}</li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            )}

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

            {/* Info Section about features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base"><Wand2 className="h-4 w-4 text-primary" /> Auto-Fix</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Automatically repairs broken Base64 strings by fixing padding, removing whitespace, and normalizing characters.
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base"><FileJson className="h-4 w-4 text-primary" /> Smart Detection</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Detects if decoded content is JSON, Images, or Hex data and provides specialized preview views.
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base"><Search className="h-4 w-4 text-primary" /> Extraction</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Paste logs or large text blocks - we'll find and extract the valid Base64 strings for you.
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
