import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Shield, Lock } from "lucide-react";

interface PrivacyControlsProps {
    analyzeBody: boolean;
    setAnalyzeBody: (v: boolean) => void;
    analyzeAttachments: boolean;
    setAnalyzeAttachments: (v: boolean) => void;
}

export function PrivacyControls({ analyzeBody, setAnalyzeBody, analyzeAttachments, setAnalyzeAttachments }: PrivacyControlsProps) {
    return (
        <div className="bg-muted/30 border rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-sm">Privacy Controls</h3>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full border border-green-200">
                    100% Client-Side
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between space-x-2 border p-3 rounded bg-background">
                    <div className="space-y-0.5">
                        <Label htmlFor="body-mode" className="text-sm font-medium">Analyze Email Body</Label>
                        <p className="text-xs text-muted-foreground">Scans text & HTML for phishing patterns.</p>
                    </div>
                    <Switch id="body-mode" checked={analyzeBody} onChange={(e) => setAnalyzeBody(e.target.checked)} />
                </div>

                <div className="flex items-center justify-between space-x-2 border p-3 rounded bg-background">
                    <div className="space-y-0.5">
                        <Label htmlFor="att-mode" className="text-sm font-medium">Analyze Attachment Metadata</Label>
                        <p className="text-xs text-muted-foreground">Checks filenames for double extensions.</p>
                    </div>
                    <Switch id="att-mode" checked={analyzeAttachments} onChange={(e) => setAnalyzeAttachments(e.target.checked)} />
                </div>
            </div>

            <p className="text-[10px] text-muted-foreground mt-3 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Your data never leaves this browser. Processing is ephemeral and memory-only.
            </p>
        </div>
    );
}
