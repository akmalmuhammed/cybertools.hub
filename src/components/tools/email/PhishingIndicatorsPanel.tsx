import { ValidationPenalty } from "./scoring/types";
import { AlertTriangle, Lock, Eye, FileWarning, ExternalLink, ShieldAlert, Link } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PhishingIndicatorsPanelProps {
    penalties: ValidationPenalty[];
    extractedUrls: string[];
    bodyEnabled: boolean;
    onEnableBody: () => void;
}

export function PhishingIndicatorsPanel({ penalties, extractedUrls, bodyEnabled, onEnableBody }: PhishingIndicatorsPanelProps) {
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

    const bodyRisks = penalties.filter(p => p.source === 'body');
    const crossRisks = penalties.filter(p => p.source === 'cross');
    const attachmentRisks = penalties.filter(p => p.source === 'attachment');
    // We treat 'header' risks as separate usually shown in Header Analysis, 
    // but if critical we might show them? For now focus on Phishing Analysis (Content/Cross).

    if (bodyRisks.length === 0 && crossRisks.length === 0 && attachmentRisks.length === 0 && extractedUrls.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                <ShieldAlert className="w-8 h-8 mx-auto opacity-20 mb-2" />
                <p>No significant phishing indicators found in body content.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in transition-all">

            {/* Body Risks */}
            {bodyRisks.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-md p-4 dark:bg-red-950/20 dark:border-red-900/30">
                    <h4 className="font-semibold text-red-800 dark:text-red-400 text-sm mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Suspicious Content Indicators
                    </h4>
                    <div className="space-y-2">
                        {bodyRisks.map((risk, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
                                <span className="font-bold text-xs border border-red-200 bg-red-100 px-1.5 rounded text-red-800">
                                    {risk.value}
                                </span>
                                <div>{risk.reason}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Cross Context Risks */}
            {crossRisks.length > 0 && (
                <div className="bg-orange-50 border border-orange-100 rounded-md p-4 dark:bg-orange-950/20 dark:border-orange-900/30">
                    <h4 className="font-semibold text-orange-800 dark:text-orange-400 text-sm mb-3 flex items-center gap-2">
                        <ExternalLink className="w-4 h-4" />
                        Correlation Warnings (BEC/Impersonation)
                    </h4>
                    <div className="space-y-2">
                        {crossRisks.map((risk, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-orange-700 dark:text-orange-300">
                                <span className="font-bold text-xs border border-orange-200 bg-orange-100 px-1.5 rounded text-orange-800">
                                    {risk.value}
                                </span>
                                <div>{risk.reason}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Attachment Risks */}
            {attachmentRisks.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-100 rounded-md p-4 dark:bg-yellow-950/20 dark:border-yellow-900/30">
                    <h4 className="font-semibold text-yellow-800 dark:text-yellow-400 text-sm mb-3 flex items-center gap-2">
                        <FileWarning className="w-4 h-4" />
                        Attachment Risks
                    </h4>
                    <div className="space-y-2">
                        {attachmentRisks.map((risk, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-yellow-700 dark:text-yellow-300">
                                <span className="font-bold text-xs border border-yellow-200 bg-yellow-100 px-1.5 rounded text-yellow-800">
                                    {risk.value}
                                </span>
                                <div>{risk.reason}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Extracted URLs */}
            <div>
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Link className="w-4 h-4 text-muted-foreground" /> Extracted Links
                </h4>
                <div className="border rounded-md divide-y max-h-60 overflow-y-auto">
                    {extractedUrls.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground italic">No links found in body.</div>
                    ) : (
                        extractedUrls.map((url, i) => (
                            <div key={i} className="p-2 flex items-center justify-between hover:bg-muted/50 text-sm group">
                                <div className="truncate max-w-[85%] font-mono text-xs text-muted-foreground group-hover:text-foreground" title={url}>
                                    {url}
                                </div>
                                {/* Simple heuristic display if needed, but Signals already flagged risky links */}
                            </div>
                        ))
                    )}
                </div>
            </div>

        </div>
    );
}
