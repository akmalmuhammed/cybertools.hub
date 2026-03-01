import { Link } from "react-router-dom"
import { ArrowRight, Star } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tool } from "@/types/tool.types"
import { cn } from "@/lib/utils/cn"
import { ToolTrustBadges } from "@/components/tools/ToolTrustBadges"

interface ToolCardProps {
    tool: Tool
    isFavorite?: boolean
    onToggleFavorite?: (e: React.MouseEvent) => void
}

export function ToolCard({ tool, isFavorite, onToggleFavorite }: ToolCardProps) {
    const Icon = tool.icon

    return (
        <Link to={tool.path} className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 rounded-2xl">
            <Card className="h-full flex flex-col transition-colors duration-200 hover:border-primary/45 relative overflow-hidden rounded-2xl border-border/60 bg-card/90">

                <CardHeader>
                    <div className="flex items-start justify-between gap-2 pr-8">
                        <div className={`p-3 rounded-lg border border-primary/30 bg-primary/10 text-primary mb-3`}>
                            <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex gap-2 items-center">
                            {tool.status === 'beta' && (
                                <Badge variant="secondary" className="border border-amber-500/35 bg-amber-500/12 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300 uppercase tracking-wide text-[11px]">Beta</Badge>
                            )}
                            {tool.status === 'new' && (
                                <Badge className="bg-primary/20 text-primary hover:bg-primary/30 uppercase tracking-wide text-[11px]">New</Badge>
                            )}
                            {tool.status === 'planned' && (
                                <Badge variant="outline" className="border-border/70 bg-muted/70 text-muted-foreground uppercase tracking-wide text-[11px]">Planned</Badge>
                            )}
                        </div>

                        {onToggleFavorite && (
                            <button
                                onClick={onToggleFavorite}
                                className="absolute top-4 right-4 text-muted-foreground hover:text-primary transition-colors z-10 p-1 rounded-full hover:bg-muted"
                                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                                title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                            >
                                <Star className={cn("h-5 w-5", isFavorite ? "fill-primary text-primary" : "")} />
                            </button>
                        )}
                    </div>
                    <ToolTrustBadges toolId={tool.id} compact />
                    <CardTitle className="text-xl group-hover:text-primary transition-colors">{tool.name}</CardTitle>
                    <CardDescription className="line-clamp-2 mt-2 leading-relaxed">
                        {tool.description}
                    </CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                    <div className="flex flex-wrap gap-2">
                        {tool.keywords.slice(0, 3).map(keyword => (
                            <span key={keyword} className="text-xs text-muted-foreground bg-muted/75 px-2 py-1 rounded-md border border-border/50">
                                {keyword}
                            </span>
                        ))}
                    </div>
                </CardContent>

                <CardFooter className="pt-2">
                    <div className="text-sm font-medium text-primary flex items-center">
                        {tool.status === "planned" ? "View Plan" : "Open Tool"} <ArrowRight className="ml-2 h-4 w-4" />
                    </div>
                </CardFooter>
            </Card>
        </Link>
    )
}
