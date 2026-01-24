import { CheckCircle, XCircle, MinusCircle, HelpCircle } from "lucide-react"

interface AuthStatus {
    status: string;
    details: string;
    explanation?: string;
}

interface AuthAlignmentProps {
    spf: AuthStatus;
    dkim: AuthStatus;
    dmarc: AuthStatus;
}

export function AuthAlignment({ spf, dkim, dmarc }: AuthAlignmentProps) {

    const StatusIcon = ({ status }: { status: string }) => {
        const s = status.toLowerCase();
        if (s === 'pass') return <CheckCircle className="w-5 h-5 text-green-500" />;
        if (s === 'fail' || s === 'softfail') return <XCircle className="w-5 h-5 text-red-500" />;
        if (s === 'none') return <MinusCircle className="w-5 h-5 text-muted-foreground" />;
        return <HelpCircle className="w-5 h-5 text-amber-500" />;
    }

    const StatusCard = ({ title, data }: { title: string, data: AuthStatus }) => (
        <div className="flex flex-col p-4 border rounded-md bg-card shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-muted-foreground">{title}</span>
                <StatusIcon status={data.status} />
            </div>
            <div className="text-lg font-bold uppercase tracking-tight mb-1">{data.status}</div>
            {/* Replaced original span with new div structure for details */}
            <div className="text-xs mt-1 font-mono break-all text-muted-foreground" title={data.details}>
                {data.details}
            </div>
            {data.explanation && (
                <div className="text-xs mt-1.5 text-foreground/80 italic border-l-2 border-primary/20 pl-2">
                    {data.explanation}
                </div>
            )}
        </div>
    )

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatusCard title="SPF (Sender Policy Framework)" data={spf} />
            <StatusCard title="DKIM (DomainKeys Identified Mail)" data={dkim} />
            <StatusCard title="DMARC (Domain-based Message Auth)" data={dmarc} />
        </div>
    )
}
