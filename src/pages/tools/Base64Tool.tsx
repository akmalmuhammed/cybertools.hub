import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Upload, FileUp, Download, RefreshCw, FileText, Wand2, FileJson, Binary as BinaryIcon, Search, AlertTriangle, FileCode, FileImage } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { encodeBase64, encodeBase64Url, splitLines } from "@/lib/utils/encoders"
import { cleanBase64, detectBinaryType, toHex, formatJSON, extractBase64, base64ToBytes, BinaryDetectionResult, isText } from "@/lib/utils/base64-utils"
import { CopyButton } from "@/components/features/CopyButton"
import { SEO } from "@/components/features/SEO"
import { Badge } from "@/components/ui/badge"

export default function Base64Tool() {
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

    const [error, setError] = useState<string | null>(null)

    // Options
    const [liveMode, setLiveMode] = useState(true)
    const [urlSafe, setUrlSafe] = useState(false)
    const [doSplitLines, setDoSplitLines] = useState(false)
    const [autoFix, setAutoFix] = useState(true)

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
    }

    const handleInputTypeChange = (value: string) => {
        if (isInputType(value)) {
            setInputType(value)
        }
    }

    const process = useCallback(async (text: string) => {
        setError(null)
        setFixIssues([])

        if (!text && inputType === 'text' && !inputBytes) {
            setOutputText("")
            setOutputBytes(null)
            setHexOutput("")
            setJsonOutput(null)
            setDetection(null)
            return
        }

        try {
            let processed = text;

            if (mode === "decode") {
                // Auto-Fix Logic
                if (autoFix && inputType === 'text') {
                    const { cleaned, issues } = cleanBase64(text);
                    if (issues.length > 0) {
                        setFixIssues(issues);
                        processed = cleaned;
                    }
                }

                // Decode to BYTES first
                let bytes: Uint8Array;
                try {
                    // Check URL safe replacement manually if tool option set?
                    // cleanBase64 already does some, but encoders.ts had specific logic.
                    // Let's use cleanBase64 logic + base64ToBytes
                    let safeInput = processed;
                    if (urlSafe) {
                        // If user enforced URL safe, ensure we swap chars back standard for decoding
                        safeInput = safeInput.replace(/-/g, '+').replace(/_/g, '/');
                    }
                    // Pad if needed, base64ToBytes relies on atob which is strict
                    while (safeInput.length % 4) safeInput += '=';

                    bytes = base64ToBytes(safeInput);
                } catch {
                    throw new Error("Invalid Base64 input. Try Auto-Fix.")
                }

                setOutputBytes(bytes);

                // 1. Detect Binary Type
                const detected = detectBinaryType(bytes);
                setDetection(detected);

                // 2. Generate Hex
                setHexOutput(toHex(bytes));

                // 3. Determine if Text or Binary
                const looksLikeText = isText(bytes);

                if (detected || !looksLikeText) {
                    // It's binary or a known file type
                    setActiveTab("hex");
                    setOutputText(""); // Don't show garbage text
                    setJsonOutput(null);
                } else {
                    // Valid Text
                    const decodedStr = new TextDecoder().decode(bytes);
                    setOutputText(decodedStr);
                    setActiveTab("text");

                    // Check JSON
                    const fmts = formatJSON(decodedStr);
                    if (fmts) {
                        setJsonOutput(fmts);
                        setActiveTab("json");
                    } else {
                        setJsonOutput(null);
                    }
                }

            } else {
                // Encode
                // If input is text, encode text. If inputBytes set (from file), encode bytes.
                let result = "";

                if (inputType === 'file' && inputBytes) {
                    // Encode Binary File
                    // We need a bytesToBase64 function or use standard btoa on string
                    // But bytesToBase64 in utils uses binary string approach
                    // Let's rely on that
                    // We need to import bytesToBase64 or simple implementation
                    // For now, use a inline helper if missing in import
                    result = btoa(Array.from(inputBytes, (byte) => String.fromCharCode(byte)).join(""));
                } else {
                    // Encode Text
                    result = urlSafe ? encodeBase64Url(processed) : encodeBase64(processed);
                }

                if (doSplitLines) {
                    result = splitLines(result);
                }

                setOutputText(result);
                setActiveTab("text");
                setJsonOutput(null);
                setHexOutput("");
                setDetection(null);
            }

        } catch (err) {
            console.error(err)
            setError(err instanceof Error ? err.message : "Processing error")
            setOutputText("")
            setHexOutput("")
            setOutputBytes(null)
            setJsonOutput(null)
            setDetection(null)
        }
    }, [mode, urlSafe, doSplitLines, inputType, autoFix, inputBytes])

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
