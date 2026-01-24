import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ShieldCheck, ShieldAlert, AlertTriangle, AlertCircle } from "lucide-react"

interface VerdictBannerProps {
    verdict: 'likely_legit' | 'suspicious' | 'high_risk' | 'neutral';
    score: number;
}

export function VerdictBanner({ verdict, score }: VerdictBannerProps) {
    const config = {
        likely_legit: {
            icon: ShieldCheck,
            title: "Likely Legitimate",
            description: "Authentication checks passed and no major anomalies found.",
            variant: "default" as const, // We'll need to style this green manually or use a custom variant if available
            color: "text-green-600 dark:text-green-400",
            borderColor: "border-green-200 dark:border-green-900",
            bgColor: "bg-green-50 dark:bg-green-900/20"
        },
        suspicious: {
            icon: AlertTriangle,
            title: "Suspicious",
            description: "Some checks failed or anomalies were detected. Use caution.",
            variant: "destructive" as const, // warning-ish
            color: "text-amber-600 dark:text-amber-400",
            borderColor: "border-amber-200 dark:border-amber-900",
            bgColor: "bg-amber-50 dark:bg-amber-900/20"
        },
        high_risk: {
            icon: ShieldAlert,
            title: "High Risk",
            description: "Critical authentication checks failed. Do not trust.",
            variant: "destructive" as const,
            color: "text-red-700 dark:text-red-500",
            borderColor: "border-red-200 dark:border-red-900",
            bgColor: "bg-red-50 dark:bg-red-900/20"
        },
        neutral: {
            icon: AlertCircle,
            title: "Neutral / Insufficient Data",
            description: "Could not determine a strong verdict. Review headers manually.",
            variant: "default" as const,
            color: "text-blue-600 dark:text-blue-400",
            borderColor: "border-blue-200 dark:border-blue-900",
            bgColor: "bg-blue-50 dark:bg-blue-900/20"
        }
    };

    const current = config[verdict];
    const Icon = current.icon;

    return (
        <Alert className={`${current.bgColor} ${current.borderColor} transition-colors duration-200`}>
            <Icon className={`h-5 w-5 ${current.color}`} />
            <div className="ml-2">
                <AlertTitle className={`text-lg font-bold ${current.color} flex items-center justify-between`}>
                    {current.title}
                    <span className="text-xs opacity-70 font-mono border px-2 py-0.5 rounded-full border-current">Score: {score}/100</span>
                </AlertTitle>
                <AlertDescription className="text-muted-foreground mt-1">
                    {current.description}
                </AlertDescription>
            </div>
        </Alert>
    )
}
