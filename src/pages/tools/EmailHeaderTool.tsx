import { EmailAnalyzer } from "@/components/tools/email/EmailAnalyzer";

export default function EmailHeaderTool() {
    return (
        <div className="space-y-4 h-full">
            <div className="flex flex-col space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Email Header Analyzer</h1>
                <p className="text-muted-foreground">
                    Investigate email legitimacy, trace delivery paths, and analyze authentication (SPF/DKIM/DMARC) alignment.
                </p>
            </div>

            <div className="flex-1 h-full min-h-0">
                <EmailAnalyzer />
            </div>
        </div>
    )
}
