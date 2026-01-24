import { useState, useEffect } from "react";
import { HeaderParser, AnalysisResult } from "./HeaderParser";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VerdictBanner } from "./VerdictBanner";
import { AuthAlignment } from "./AuthAlignment";
import { HopsVisualizer } from "./HopsVisualizer";
import { ArtifactsPanel } from "./ArtifactsPanel";
import { FileText, ShieldCheck } from "lucide-react";

export function EmailAnalyzer() {
    const [input, setInput] = useState("");
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<"analyst" | "raw" | "it">("analyst");

    const analyze = async () => {
        if (!input.trim()) return;
        setLoading(true);
        try {
            const result = await HeaderParser.parse(input);
            setAnalysis(result);
        } catch (e) {
            console.error("Analysis failed", e);
        } finally {
            setLoading(false);
        }
    };

    // Auto-analyze on paste (debounce slightly)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (input.length > 50 && !analysis) {
                analyze();
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [input]);

    const handleClear = () => {
        setInput("");
        setAnalysis(null);
    };

    return (
        <div className="flex flex-col gap-6 h-full">
            {/* Input Section - Only show if no analysis or if explicitly toggled (not implemented for simplicity, just show always if empty) */}
            {!analysis && (
                <div className="space-y-4 max-w-2xl mx-auto w-full text-center py-10">
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold tracking-tight">Paste Email Headers</h2>
                        <p className="text-muted-foreground">
                            Copy headers from Outlook, Gmail, or any mail client to begin investigation.
                        </p>
                    </div>
                    <Textarea
                        placeholder="Received: from ...&#10;Authentication-Results: ..."
                        className="min-h-[200px] font-mono text-sm"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                    />
                    <Button onClick={analyze} disabled={!input} className="w-full">
                        {loading ? "Analyzing..." : "Analyze Headers"}
                    </Button>
                </div>
            )}

            {/* Analysis Dashboard */}
            {analysis && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Header Controls */}
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-b pb-4">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold">Analysis Report</h2>
                            <span className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">
                                {analysis.score}/100 Trust Score
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-[300px]">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="analyst" title="Default View">Analyst</TabsTrigger>
                                    <TabsTrigger value="raw" title="For Engineers">Raw</TabsTrigger>
                                    <TabsTrigger value="it" title="Simplified">Quick IT</TabsTrigger>
                                </TabsList>
                            </Tabs>
                            <Button variant="outline" size="sm" onClick={handleClear}>
                                New
                            </Button>
                        </div>
                    </div>

                    {/* MODE SPECFIC CONTENT */}

                    {/* --- IT MODE --- */}
                    {mode === "it" && (
                        <div className="max-w-xl mx-auto space-y-6 text-center py-10">
                            <div className="transform scale-125 origin-center">
                                <VerdictBanner verdict={analysis.verdict} score={analysis.score} />
                            </div>

                            <div className="bg-muted/30 p-6 rounded-lg border text-left space-y-4">
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5" />
                                    Recommendation
                                </h3>
                                <p className="text-lg">
                                    {analysis.verdict === 'likely_legit'
                                        ? "This email appears safe. You can likely trust it."
                                        : "This email has security issues. Do not click links or open attachments. Escalate to Security."
                                    }
                                </p>
                                <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                                    <li>Sender: {analysis.headers['From'] || 'Unknown'}</li>
                                    <li>Subject: {analysis.headers['Subject'] || '(No Subject)'}</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* --- ANALYST MODE --- */}
                    {mode === "analyst" && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left Column: Verdict & Auth */}
                            <div className="lg:col-span-2 space-y-6">
                                <VerdictBanner verdict={analysis.verdict} score={analysis.score} />

                                <div className="space-y-2">
                                    <h3 className="font-semibold text-lg">Authentication</h3>
                                    <AuthAlignment
                                        spf={analysis.auth.spf}
                                        dkim={analysis.auth.dkim}
                                        dmarc={analysis.auth.dmarc}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Button variant="ghost" className="w-full justify-start p-0 h-auto hover:bg-transparent" onClick={() => setMode('raw')}>
                                        <span className="text-blue-500 text-sm flex items-center gap-1">
                                            <FileText className="w-4 h-4" /> View Raw Headers
                                        </span>
                                    </Button>
                                </div>

                                <div className="pt-4 border-t">
                                    <HopsVisualizer hops={analysis.hops} />
                                </div>
                            </div>

                            {/* Right Column: Key Details & Hops */}
                            <div className="space-y-6">
                                <div className="bg-card border rounded-md p-4 space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-xs uppercase font-bold text-muted-foreground">Subject</label>
                                        <div className="font-medium text-sm">{analysis.headers['Subject']}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs uppercase font-bold text-muted-foreground">From</label>
                                        <div className="font-medium text-sm break-all">{analysis.headers['From']}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs uppercase font-bold text-muted-foreground">Return-Path</label>
                                        <div className="font-mono text-xs break-all">{analysis.headers['Return-Path'] || 'N/A'}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs uppercase font-bold text-muted-foreground">To</label>
                                        <div className="font-medium text-sm break-all">{analysis.headers['To']}</div>
                                    </div>
                                </div>
                                <ArtifactsPanel artifacts={analysis.artifacts} />
                            </div>


                        </div>
                    )}

                    {/* --- RAW MODE --- */}
                    {mode === "raw" && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold">Raw Headers</h3>
                                <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(analysis.rawHeaders)}>
                                    Copy All
                                </Button>
                            </div>
                            <pre className="p-4 bg-muted/30 rounded-md overflow-x-auto text-xs font-mono whitespace-pre-wrap break-all border h-[600px] overflow-y-auto">
                                {analysis.rawHeaders}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
