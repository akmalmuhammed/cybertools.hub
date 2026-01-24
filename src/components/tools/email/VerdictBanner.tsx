import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ShieldCheck, ShieldAlert, AlertTriangle, AlertCircle } from "lucide-react"

interface VerdictBannerProps {
    verdict: 'Likely Legitimate' | 'Suspicious' | 'High Risk' | 'Unknown';
    score: number; // Trust Score
    confidence: {
        score: number;
        level: "High" | "Medium" | "Low";
    };
    reason?: string;
    factors?: { label: string; score: number }[];
}

export function VerdictBanner({ verdict, score, confidence, reason, factors }: VerdictBannerProps) {
    const config = {
        'Likely Legitimate': {
            icon: ShieldCheck,
            title: "Likely Legitimate",
            variant: "default" as const,
            color: "text-green-600 dark:text-green-400",
            borderColor: "border-green-200 dark:border-green-900",
            bgColor: "bg-green-50 dark:bg-green-900/20"
        },
        'Suspicious': {
            icon: AlertTriangle,
            title: "Suspicious",
            variant: "destructive" as const,
            color: "text-amber-600 dark:text-amber-400",
            borderColor: "border-amber-200 dark:border-amber-900",
            bgColor: "bg-amber-50 dark:bg-amber-900/20"
        },
        'High Risk': {
            icon: ShieldAlert,
            title: "High Risk",
            variant: "destructive" as const,
            color: "text-red-700 dark:text-red-500",
            borderColor: "border-red-200 dark:border-red-900",
            bgColor: "bg-red-50 dark:bg-red-900/20"
        },
        'Unknown': {
            icon: AlertCircle,
            title: "Unknown Verdict",
            variant: "default" as const,
            color: "text-blue-600 dark:text-blue-400",
            borderColor: "border-blue-200 dark:border-blue-900",
            bgColor: "bg-blue-50 dark:bg-blue-900/20"
        }
    };

    const current = config[verdict] || config['Unknown'];
    const Icon = current.icon;

    return (
        <Alert className={`${current.bgColor} ${current.borderColor} transition-colors duration-200`}>
            <div className="flex items-start gap-4">
                <Icon className={`h-6 w-6 mt-1 ${current.color}`} />
                <div className="flex-1">
                    <AlertTitle className={`text-xl font-bold ${current.color} flex items-center justify-between mb-2`}>
                        {current.title}
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider bg-background/50 px-2 py-1 rounded border">
                                Confidence: <span className={confidence.level === 'High' ? 'text-green-600 font-bold' : confidence.level === 'Medium' ? 'text-amber-600 font-bold' : 'text-red-600 font-bold'}>{confidence.level}</span>
                            </span>
                            <span className="text-sm font-mono border px-3 py-1 rounded-full border-current bg-background/50">
                                Trust Score: <span className="font-bold">{score}/100</span>
                            </span>
                        </div>
                    </AlertTitle>
                    {reason && (
                        <AlertDescription className="text-base font-medium opacity-90 mb-2">
                            {reason}
                        </AlertDescription>
                    )}

                    {factors && factors.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5 space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Score Confidence Breakdown</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                                {factors.map((f, i) => (
                                    <div key={i} className="flex justify-between text-xs items-center">
                                        <span className="text-foreground/80">{f.label}</span>
                                        <span className={`font-mono font-medium ${f.score > 0 ? 'text-green-600' : f.score < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                            {f.score > 0 ? '+' : ''}{f.score}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Alert>
    )
}
