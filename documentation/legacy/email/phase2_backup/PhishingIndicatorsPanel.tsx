import { PhishingAnalysisResult } from "./PhishingAnalyzer";
import { AlertTriangle, Lock, Eye, FileWarning, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PhishingIndicatorsPanelProps {
    results: PhishingAnalysisResult;
    bodyEnabled: boolean;
    onEnableBody: () => void;
}

export function PhishingIndicatorsPanel({ results, bodyEnabled, onEnableBody }: PhishingIndicatorsPanelProps) {
    if (!bodyEnabled) {
        return (
            <div className="border border-dashed p-8 rounded-lg text-center bg-muted/20">
                <Lock className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
                <h4 className="font-semibold text-muted-foreground">Body Analysis Disabled (Privacy Mode)</h4>
                <p className="text-sm text-muted-foreground mb-4">Enable deeper inspection to detect phishing links, urgency patterns, and hidden forms.</p>
                <Button variant="outline" onClick={onEnableBody} className="gap-2">
                    <Eye className="w-4 h-4" /> Enable Body Analysis
                </Button>
            </div>
        );
    }

    const { body, attachments, crossContext } = results;
    if (!body) return null; // Should not happen if enabled unless no body found

    return (
        <div className="space-y-6 animate-in fade-in transition-all">
            {/* Suspicious Indicators */}
            {body.indicators.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-md p-4 dark:bg-red-950/20 dark:border-red-900/30">
                    <h4 className="font-semibold text-red-800 dark:text-red-400 text-sm mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Suspicious Content Indicators
                    </h4>
                    <div className="space-y-2">
                        {body.indicators.map((ind, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
                                <span className="font-bold uppercase text-[10px] border border-red-200 bg-red-100 px-1 rounded mt-0.5">
                                    {ind.type.replace('_', ' ')}
                                </span>
                                <div>
                                    <span className="font-medium">"{ind.value}"</span>: {ind.description}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Cross Context Findings */}
            {crossContext.flags.length > 0 && (
                <div className="bg-orange-50 border border-orange-100 rounded-md p-4 dark:bg-orange-950/20 dark:border-orange-900/30">
                    <h4 className="font-semibold text-orange-800 dark:text-orange-400 text-sm mb-3 flex items-center gap-2">
                        <ExternalLink className="w-4 h-4" />
                        Correlation Warnings
                    </h4>
                    <ul className="space-y-2">
                        {crossContext.flags.map((flag, i) => (
                            <li key={i} className="text-sm text-orange-700 dark:text-orange-300 list-disc list-inside">
                                {flag.description}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* URL Table */}
            <div>
                <h4 className="font-semibold text-sm mb-3">Extracted Links</h4>
                <div className="border rounded-md divide-y max-h-60 overflow-y-auto">
                    {body.urls.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground italic">No links found in body.</div>
                    ) : (
                        body.urls.map((u, i) => (
                            <div key={i} className="p-2 flex items-center justify-between hover:bg-muted/50 text-sm">
                                <div className="truncate max-w-[80%] font-mono text-xs" title={u.url}>{u.url}</div>
                                {u.suspicious && (
                                    <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded border border-red-200 font-bold">
                                        Suspicious
                                    </span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Attachments Warnings */}
            {attachments.some(a => a.warnings.length > 0) && (
                <div className="bg-yellow-50 border border-yellow-100 rounded-md p-4 dark:bg-yellow-950/20 dark:border-yellow-900/30">
                    <h4 className="font-semibold text-yellow-800 dark:text-yellow-400 text-sm mb-3 flex items-center gap-2">
                        <FileWarning className="w-4 h-4" />
                        Attachment Risks
                    </h4>
                    {attachments.filter(a => a.warnings.length > 0).map((a, i) => (
                        <div key={i} className="mb-2 last:mb-0">
                            <div className="font-medium text-sm text-yellow-900 dark:text-yellow-200">{a.filename}</div>
                            <ul className="list-disc list-inside text-xs text-yellow-700 dark:text-yellow-300">
                                {a.warnings.map((w, j) => <li key={j}>{w}</li>)}
                            </ul>
                        </div>
                    ))}
                </div>
            )}

        </div>
    );
}
