import { EmailHop } from "./HeaderParser";
import { ArrowDown, Clock, Globe, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils/cn";

interface HopsVisualizerProps {
    hops: EmailHop[];
}

export function HopsVisualizer({ hops }: HopsVisualizerProps) {
    if (hops.length === 0) return <div className="text-muted-foreground italic">No hops found.</div>;

    // Helper to format delay
    const formatDelay = (seconds: number) => {
        if (seconds < 60) return `${seconds.toFixed(1)}s`;
        if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
        return `${(seconds / 3600).toFixed(1)}h`;
    };

    return (
        <div className="space-y-4">
            <h3 className="font-semibold">Delivery Path (Hops)</h3>
            <div className="relative border-l-2 border-muted ml-3 space-y-6 pb-2">
                {hops.map((hop, index) => {
                    const isLongDelay = hop.delay > 600; // 10 mins

                    return (
                        <div key={index} className="relative pl-6">
                            {/* Dot on timeline */}
                            <div className={cn(
                                "absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 bg-background flex items-center justify-center",
                                isLongDelay && index > 0 ? "border-amber-500 text-amber-500" : "border-muted-foreground text-muted-foreground"
                            )}>
                                <div className="h-2 w-2 rounded-full bg-current" />
                            </div>

                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <span className="text-primary">{hop.from}</span>
                                    <ArrowDown className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-primary">{hop.by}</span>
                                </div>

                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1 font-mono" title={hop.time}>
                                        <Clock className="w-3 h-3" />
                                        {format(new Date(hop.timestamp), "MMM dd HH:mm:ss")}
                                    </span>
                                    {hop.ip && (
                                        <span className="flex items-center gap-1">
                                            <Globe className="w-3 h-3" />
                                            {hop.ip}
                                            <span className="text-zinc-500 text-xs ml-2">
                                                {hop.delay > 0 ? `Delay: +${hop.delay.toFixed(1)}s` : ''}
                                            </span>
                                            {hop.annotations && hop.annotations.map((note, j) => (
                                                <span key={j} className={`text-[10px] px-1.5 py-0.5 rounded-full border ml-2 ${note.includes('Delay') ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                        note.includes('Internal') ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                                            'bg-zinc-500/10 text-zinc-500'
                                                    }`}>
                                                    {note}
                                                </span>
                                            ))}
                                        </span>)}
                                </div>

                                {index > 0 && (
                                    <div className={cn(
                                        "text-xs mt-1 px-2 py-0.5 rounded w-fit flex items-center gap-1",
                                        isLongDelay ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-bold" : "bg-muted/50 text-muted-foreground"
                                    )}>
                                        {isLongDelay && <ShieldAlert className="w-3 h-3" />}
                                        Delay: +{formatDelay(hop.delay)}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
                * Timestamps normalized to local time. Bottom is newest (final destination).
            </p>
        </div>
    );
}
