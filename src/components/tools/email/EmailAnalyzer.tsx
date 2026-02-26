import { useState, useEffect, useCallback, useRef } from "react";
import PostalMime from 'postal-mime';
import { HeaderParser, AnalysisResult } from "./HeaderParser";
import { AnalysisEngine } from "./scoring/AnalysisEngine";
import { NormalizedSignals, ScoringResult } from "./scoring/types";
import { PrivacyControls } from "./PrivacyControls";
import { PhishingIndicatorsPanel } from "./PhishingIndicatorsPanel";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VerdictBanner } from "./VerdictBanner";
import { AuthAlignment } from "./AuthAlignment";
import { HopsVisualizer } from "./HopsVisualizer";
import { ArtifactsPanel } from "./ArtifactsPanel";
import { ShieldAlert, FileText, ShieldCheck, Download, AlertTriangle } from "lucide-react";
import { useAnalystSession } from "@/lib/hooks/useAnalystSession";
import { AnalystSessionPanel } from "@/components/tools/AnalystSessionPanel";

interface EnhancedAnalysis {
    header: AnalysisResult;
    signals: NormalizedSignals;
    scoring: ScoringResult;
    emailContent: { text: string; html: string };
    timestamp: number;
}

export function EmailAnalyzer() {
    const session = useAnalystSession("email")
    const recordRun = session.recordRun
    const [input, setInput] = useState("");
    const [analysis, setAnalysis] = useState<EnhancedAnalysis | null>(null);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<"analyst" | "raw" | "it">("analyst");

    // Privacy Controls State
    const [analyzeBody, setAnalyzeBody] = useState(false);
    const [analyzeAttachments, setAnalyzeAttachments] = useState(false);

    // Raw Tab State
    const [rawTab, setRawTab] = useState<'headers' | 'body_text' | 'body_html'>('headers');
    const previousTogglesRef = useRef({
        analyzeBody: false,
        analyzeAttachments: false,
    });

    const handleModeChange = (value: string) => {
        if (value === "analyst" || value === "raw" || value === "it") {
            setMode(value);
        }
    };

    const performAnalysis = useCallback(async (content: string, runBody: boolean, runAttachments: boolean) => {
        if (!content.trim()) return;
        setLoading(true);
        const startedAt = performance.now()
        try {
            // 1. Parallel Pipeline Logic

            // A. Header Parsing (Legacy Support)
            // We still use HeaderParser for artifacts and hops visualization
            const headerResPromise = HeaderParser.parse(content);

            // B. MIME Parsing (Standardized)
            const parser = new PostalMime();
            const emailPromise = parser.parse(content);

            const [headerRes, email] = await Promise.all([headerResPromise, emailPromise]);

            // C. Unified Analysis Engine (v3)
            const { signals, result } = AnalysisEngine.analyze(
                headerRes,
                email,
                { checkBody: runBody, checkAttachments: runAttachments }
            );

            setAnalysis({
                header: headerRes,
                signals: signals,
                scoring: result,
                emailContent: {
                    text: email.text || "",
                    html: email.html || ""
                },
                timestamp: Date.now()
            });

            const durationMs = Math.max(1, Math.round(performance.now() - startedAt))
            const findings = result.trust.penalties.length
            recordRun({
                durationMs,
                status: result.verdict.verdict === "High Risk"
                    ? "error"
                    : result.verdict.verdict === "Suspicious"
                        ? "warning"
                        : "ok",
                score: result.trust.score,
                findings,
                summary: `${result.verdict.verdict}: ${result.verdict.reason}`,
                mode: runBody
                    ? (runAttachments ? "headers+body+attachments" : "headers+body")
                    : "headers-only",
                metrics: {
                    hopCount: headerRes.hops.length,
                    urlCount: signals.extractedUrls.length,
                    penalties: result.trust.penalties.length,
                },
            })

        } catch (e) {
            console.error("Analysis failed", e);
            const durationMs = Math.max(1, Math.round(performance.now() - startedAt))
            recordRun({
                durationMs,
                status: "error",
                score: 35,
                findings: 1,
                summary: "Email analysis failed due to parsing or scoring error.",
                mode: "error",
            })
        } finally {
            setLoading(false);
        }
    }, [recordRun]);

    // Trigger re-analysis only when privacy toggles change after an initial run.
    useEffect(() => {
        if (!analysis || !input) {
            previousTogglesRef.current = { analyzeBody, analyzeAttachments };
            return;
        }
        const previous = previousTogglesRef.current;
        if (
            previous.analyzeBody === analyzeBody &&
            previous.analyzeAttachments === analyzeAttachments
        ) {
            return;
        }
        previousTogglesRef.current = { analyzeBody, analyzeAttachments };
        const timer = setTimeout(() => {
            performAnalysis(input, analyzeBody, analyzeAttachments);
        }, 200);
        return () => clearTimeout(timer);
    }, [analysis, input, analyzeBody, analyzeAttachments, performAnalysis]);

    const handleAnalyzeClick = () => {
        performAnalysis(input, analyzeBody, analyzeAttachments);
    };

    const handleClear = () => {
        setInput("");
        setAnalysis(null);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            const text = await file.text();
            setInput(text);
            setTimeout(() => performAnalysis(text, analyzeBody, analyzeAttachments), 100);
        }
    };

    return (
        <div className="h-full flex flex-col">
            {analysis && (
                <div className="flex items-center justify-between pb-4 border-b animate-in fade-in slide-in-from-top-2 duration-300">
                    <Tabs value={mode} onValueChange={handleModeChange} className="w-[300px]">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="analyst" title="Default View">Analyst</TabsTrigger>
                            <TabsTrigger value="raw" title="For Engineers">Raw</TabsTrigger>
                            <TabsTrigger value="it" title="Simplified">Quick IT</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <div className="flex gap-1 items-center">
                        <Button variant="outline" size="sm" onClick={() => window.print()} title="Export as PDF">
                            <FileText className="w-4 h-4" /> PDF
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => {
                            if (!analysis) return;
                            const exportData = session.attachContext({
                                header: analysis.header,
                                signals: analysis.signals,
                                scoring: analysis.scoring,
                                timestamp: analysis.timestamp,
                                privacySettings: { analyzeBody, analyzeAttachments }
                            });
                            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `email-analysis-${analysis.timestamp}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                        }} title="Download JSON">
                            <Download className="w-4 h-4" /> JSON
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => {
                            if (!analysis) return;
                            const rows = [
                                ['Metric', 'Value'],
                                ['Case ID', `"${session.caseId || ''}"`],
                                ['Case Owner', `"${session.caseOwner || ''}"`],
                                ['Case Tags', `"${session.normalizedTags.join('; ')}"`],
                                ['Verdict', analysis.scoring.verdict.verdict],
                                ['Trust Score', analysis.scoring.trust.score],
                                ['Confidence', analysis.scoring.confidence.level],
                                ['Subject', `"${analysis.header.headers['subject'] || ''}"`],
                                ['From', `"${analysis.header.headers['from'] || ''}"`],
                                ['SPF', analysis.header.auth.spf.status],
                                ['DKIM', analysis.header.auth.dkim.status],
                                ['DMARC', analysis.header.auth.dmarc.status],
                                [],
                                ['Header Key', 'Header Value'],
                                ...Object.entries(analysis.header.headers).map(([k, v]) => [`"${k}"`, `"${Array.isArray(v) ? v.join('; ') : v}"`])
                            ];
                            const csvContent = rows.map(e => e.join(",")).join("\n");
                            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `email-analysis-${analysis.timestamp}.csv`;
                            a.click();
                            URL.revokeObjectURL(url);
                        }} title="Download CSV">
                            <FileText className="w-4 h-4" /> CSV
                        </Button>

                        <div className="w-px h-6 bg-border mx-2" />

                        <Button variant="default" size="sm" onClick={handleClear}>
                            New Analysis
                        </Button>
                    </div>
                </div>
            )}

            <div className="py-4">
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
            </div>

            {/* Input Section */}
            {!analysis && (
                <div
                    className="space-y-4 max-w-2xl mx-auto w-full text-center py-10 animate-in zoom-in-95 duration-500"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                >
                    <div className="space-y-4">
                        <div className="text-center space-y-2">
                            <div className="flex justify-center mb-4">
                                <div className="bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 px-4 py-2 rounded-lg inline-flex items-center gap-3">
                                    <div className="p-1.5 bg-green-500/10 rounded-full">
                                        <ShieldCheck className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-bold text-sm">100% Client-Side Privacy</div>
                                        <div className="text-xs opacity-80">Files are processed locally in your browser. No server uploads.</div>
                                    </div>
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold tracking-tight">Paste Headers or Drop .eml File</h2>
                            <p className="text-muted-foreground">
                                Copy headers from Outlook/Gmail or drop a file to begin analysis.
                            </p>
                        </div>
                    </div>

                    <Textarea
                        placeholder="Received: from ...&#10;Authentication-Results: ..."
                        className="min-h-[300px] font-mono text-sm border-dashed border-2 shadow-sm focus-visible:ring-offset-2"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                    />

                    <div className="space-y-4">
                        {/* Mini Privacy Controls for Input */}
                        <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground bg-muted/30 p-2 rounded-md border border-dashed">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Analysis Options:</span>
                            <label className="flex items-center gap-2 cursor-pointer select-none hover:text-foreground transition-colors">
                                <input type="checkbox" checked={analyzeBody} onChange={e => setAnalyzeBody(e.target.checked)} className="rounded border-gray-300" />
                                Analyze Body Content
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer select-none hover:text-foreground transition-colors">
                                <input type="checkbox" checked={analyzeAttachments} onChange={e => setAnalyzeAttachments(e.target.checked)} className="rounded border-gray-300" />
                                Scan Attachments
                            </label>
                        </div>

                        <div className="flex gap-3">
                            <Button onClick={handleAnalyzeClick} disabled={!input} className="flex-1" size="lg">
                                {loading ? "Analyzing..." : "Start Analysis"}
                            </Button>

                            <div className="relative">
                                <input
                                    type="file"
                                    className="hidden"
                                    accept=".eml,.txt,message/rfc822"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const text = await file.text();
                                            setInput(text);
                                            setTimeout(() => performAnalysis(text, analyzeBody, analyzeAttachments), 100);
                                            e.target.value = '';
                                        }
                                    }}
                                    id="file-upload-input"
                                />
                                <Button variant="outline" size="lg" className="w-full gap-2" onClick={() => document.getElementById('file-upload-input')?.click()}>
                                    <Download className="w-4 h-4 rotate-180" />
                                    Upload .eml
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Analysis Dashboard */}
            {analysis && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 py-4">

                    {/* --- IT MODE --- */}
                    {mode === "it" && (
                        <div className="max-w-xl mx-auto space-y-6 text-center py-4">
                            {/* Unified Verdict Banner */}
                            <div className={`p-6 rounded-xl border shadow-sm ${analysis.scoring.verdict.verdict === 'Likely Legitimate' ? 'bg-green-50 border-green-200 dark:bg-green-950/20' :
                                analysis.scoring.verdict.verdict === 'High Risk' ? 'bg-red-50 border-red-200 dark:bg-red-950/20' :
                                    'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20'
                                }`}>
                                <h2 className={`text-3xl font-bold mb-2 ${analysis.scoring.verdict.verdict === 'Likely Legitimate' ? 'text-green-700 dark:text-green-400' :
                                    analysis.scoring.verdict.verdict === 'High Risk' ? 'text-red-700 dark:text-red-400' :
                                        'text-yellow-700 dark:text-yellow-400'
                                    }`}>
                                    {analysis.scoring.verdict.verdict}
                                </h2>
                                <div className="text-4xl font-black text-muted-foreground/20">{analysis.scoring.trust.score}/100</div>

                                {!analyzeBody && (
                                    <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background border text-sm text-muted-foreground">
                                        <AlertTriangle className="w-3 h-3" />
                                        Limited visibility (Headers Only). Enable body analysis for full verdict.
                                    </div>
                                )}
                            </div>

                            {/* Recommended Actions */}
                            <div className="bg-background border rounded-lg p-5 text-left max-w-lg mx-auto shadow-sm">
                                <h4 className="font-semibold mb-3 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-primary" />
                                    Recall & Containment
                                </h4>
                                <ul className="space-y-2">
                                    {analysis.header.recommendedActions?.map((action, idx) => (
                                        <li key={idx} className="flex items-start gap-2 text-sm">
                                            <input type="checkbox" className="mt-1 rounded border-gray-300" />
                                            <span>{action}</span>
                                        </li>
                                    ))}
                                    {!analyzeBody && (
                                        <li className="flex items-start gap-2 text-sm text-muted-foreground italic">
                                            Enable body analysis to see content-based removal recommendations.
                                        </li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* --- ANALYST MODE --- */}
                    {mode === "analyst" && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left Column: Verdict & Auth */}
                            <div className="lg:col-span-2 space-y-6">

                                {/* Privacy Controls Section */}
                                <PrivacyControls
                                    analyzeBody={analyzeBody}
                                    setAnalyzeBody={setAnalyzeBody}
                                    analyzeAttachments={analyzeAttachments}
                                    setAnalyzeAttachments={setAnalyzeAttachments}
                                />

                                <VerdictBanner
                                    verdict={analysis.scoring.verdict.verdict}
                                    score={analysis.scoring.trust.score}
                                    confidence={analysis.scoring.confidence}
                                    reason={analysis.scoring.verdict.reason}
                                    factors={[]} // Factors computed in banner or scoring object if needed
                                />

                                {/* Impersonation Alert */}
                                {analysis.header.impersonationAlert && (
                                    <div className="bg-red-950/30 border border-red-900/50 p-4 rounded-md flex items-start gap-3">
                                        <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="font-bold text-red-500 text-sm">Potential Impersonation Detected</h4>
                                            <p className="text-sm text-red-200/80 mt-1">{analysis.header.impersonationAlert}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Phishing Analysis Panel */}
                                <PhishingIndicatorsPanel
                                    penalties={analysis.scoring.trust.penalties}
                                    extractedUrls={analysis.signals.extractedUrls}
                                    bodyEnabled={analyzeBody}
                                    onEnableBody={() => setAnalyzeBody(true)}
                                />

                                <div className="space-y-2">
                                    <h3 className="font-semibold text-lg">Authentication</h3>
                                    <AuthAlignment
                                        spf={analysis.header.auth.spf}
                                        dkim={analysis.header.auth.dkim}
                                        dmarc={analysis.header.auth.dmarc}
                                    />
                                    {/* ARC Results */}
                                    {analysis.header.arc && analysis.header.arc.status !== 'none' && (
                                        <div className="mt-3 text-sm border-t pt-2">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold text-muted-foreground">ARC Validation:</span>
                                                <span className={`font-mono font-bold ${analysis.header.arc.status === 'pass' ? 'text-green-600' : 'text-red-500'}`}>
                                                    {analysis.header.arc.status.toUpperCase()}
                                                </span>
                                            </div>
                                            <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                                                {analysis.header.arc.details.map((d, i) => <li key={i}>{d}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                {/* X-Headers */}
                                {analysis.header.xHeaders && analysis.header.xHeaders.length > 0 && (
                                    <div className="space-y-2">
                                        <h3 className="font-semibold text-lg">Notable X-Headers</h3>
                                        <div className="bg-muted/30 rounded-md border text-sm divide-y">
                                            {analysis.header.xHeaders.map((xh, i) => (
                                                <div key={i} className="p-3">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="font-mono text-xs font-semibold">{xh.key}</span>
                                                        <span className="text-[10px] bg-background border px-1.5 rounded">{xh.value.substring(0, 50)}{xh.value.length > 50 ? '...' : ''}</span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground italic">{xh.explanation}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="pt-4 border-t">
                                    <HopsVisualizer hops={analysis.header.hops} />
                                </div>
                            </div>

                            {/* Right Column: Key Details & Hops */}
                            <div className="space-y-6">
                                <div className="bg-card border rounded-md p-4 space-y-4">
                                    <h3 className="font-semibold text-sm text-foreground/80 mb-2">Key Metadata</h3>
                                    <div className="space-y-1">
                                        <label className="text-xs uppercase font-bold text-muted-foreground">Subject</label>
                                        <div className="font-medium text-sm">{analysis.header.headers['subject']}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs uppercase font-bold text-muted-foreground">From</label>
                                        <div className="font-medium text-sm break-all">{analysis.header.headers['from']}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs uppercase font-bold text-muted-foreground">Return-Path</label>
                                        <div className="font-mono text-xs break-all">{analysis.header.headers['return-path'] || 'N/A'}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs uppercase font-bold text-muted-foreground">To</label>
                                        <div className="font-medium text-sm break-all">{analysis.header.headers['to']}</div>
                                    </div>
                                </div>

                                <ArtifactsPanel artifacts={analysis.header.artifacts} />
                            </div>
                        </div>
                    )}

                    {/* --- RAW MODE --- */}
                    {mode === "raw" && (
                        <div className="space-y-4">
                            <div className="flex gap-2 mb-4">
                                <Button size="sm" variant={rawTab === 'headers' ? 'secondary' : 'ghost'} onClick={() => setRawTab('headers')}>Headers</Button>
                                {analyzeBody && <Button size="sm" variant={rawTab === 'body_text' ? 'secondary' : 'ghost'} onClick={() => setRawTab('body_text')}>Body (Text)</Button>}
                                {analyzeBody && <Button size="sm" variant={rawTab === 'body_html' ? 'secondary' : 'ghost'} onClick={() => setRawTab('body_html')}>Body (HTML)</Button>}
                            </div>

                            {rawTab === 'headers' && (
                                <div className="relative">
                                    <Button size="sm" variant="outline" className="absolute top-2 right-2" onClick={() => navigator.clipboard.writeText(analysis.header.rawHeaders)}>Copy</Button>
                                    <pre className="p-4 bg-muted/30 rounded-md overflow-x-auto text-xs font-mono whitespace-pre-wrap break-all border h-[600px] overflow-y-auto">
                                        {analysis.header.rawHeaders}
                                    </pre>
                                </div>
                            )}
                            {rawTab === 'body_text' && (
                                <pre className="p-4 bg-muted/30 rounded-md overflow-x-auto text-xs font-mono whitespace-pre-wrap break-all border h-[600px] overflow-y-auto">
                                    {analysis.emailContent.text || "No text content found."}
                                </pre>
                            )}
                            {rawTab === 'body_html' && (
                                <pre className="p-4 bg-muted/30 rounded-md overflow-x-auto text-xs font-mono whitespace-pre-wrap break-all border h-[600px] overflow-y-auto">
                                    {analysis.emailContent.html || "No HTML content found."}
                                </pre>
                            )}
                        </div>
                    )}
                </div >
            )}
        </div>
    );
}
