import { useState, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { JsonEditor } from "@/components/tools/json/JsonEditor"
import { JsonTree } from "@/components/tools/json/JsonTree"
import { JsonDiff } from "@/components/tools/json/JsonDiff"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2, FileJson } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import Ajv from "ajv"
import type { ErrorObject } from "ajv"
import { SEO } from "@/components/features/SEO"

export default function JsonTool() {
    const [input, setInput] = useState('{"name": "Secutil", "type": "Workspace"}')
    const [error, setError] = useState<string | null>(null)
    const [errorLine, setErrorLine] = useState<number | null>(null)
    const [parsed, setParsed] = useState<object | null>(null)

    // Schema state
    const [schemaInput, setSchemaInput] = useState('')
    const [schemaErrors, setSchemaErrors] = useState<ErrorObject[] | null>(null)
    const [isSchemaOpen, setIsSchemaOpen] = useState(false)
    const [schemaJsonError, setSchemaJsonError] = useState<string | null>(null)

    // Parse JSON effectively
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

            // Try to extract line number from message "at position X"
            // This is messy in standard JS JSON.parse but we can do a best effort or just valid with a better parser later
            // Standard V8 message: "Unexpected token ... in JSON at position X"
            const match = msg.match(/at position (\d+)/)
            if (match && match[1]) {
                const pos = parseInt(match[1])
                const lines = input.substring(0, pos).split('\n')
                setErrorLine(lines.length)
            } else {
                setErrorLine(null)
            }
        }
    }, [input])

    // Validate Schema
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
            setSchemaJsonError("Invalid Schema JSON: " + message)
            setSchemaErrors(null)
        }
    }, [parsed, schemaInput])

    const format = () => {
        if (!parsed) return
        setInput(JSON.stringify(parsed, null, 2))
    }

    const minify = () => {
        if (!parsed) return
        setInput(JSON.stringify(parsed))
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
                    Validate, format, and inspect JSON with error highlighting and tree view.
                </p>
            </div>

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
                                onChange={(e) => setSchemaInput(e.target.value)}
                            />
                            {schemaErrors && (
                                <Alert variant="destructive" className="mt-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        <div className="font-semibold mb-1">Schema Validation Errors ({schemaErrors.length}):</div>
                                        <ul className="list-disc pl-4 space-y-1 text-xs">
                                            {schemaErrors.slice(0, 5).map((err, i) => (
                                                <li key={i}>
                                                    <span className="font-mono">{err.instancePath || "root"}</span>: {err.message}
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
                                <JsonEditor
                                    value={input}
                                    onChange={setInput}
                                    errorLine={errorLine}
                                />
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
