import { Link } from "react-router-dom"
import { ArrowRight, Star } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tool } from "@/types/tool.types"
import { cn } from "@/lib/utils/cn"

interface ToolCardProps {
    tool: Tool
    isFavorite?: boolean
    onToggleFavorite?: (e: React.MouseEvent) => void
}

export function ToolCard({ tool, isFavorite, onToggleFavorite }: ToolCardProps) {
    const Icon = tool.icon

    return (
        <Link to={tool.path} className="group block h-full">
            <Card className="h-full flex flex-col transition-all duration-300 hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-[0_25px_65px_-45px_rgba(16,185,129,0.9)] relative overflow-hidden rounded-2xl border-border/60 bg-card/70 backdrop-blur-md">
                {/* Hover Gradient Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />

                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div className={`p-3 rounded-lg border border-primary/30 bg-primary/10 text-primary mb-4 transition-transform group-hover:scale-105`}>
                            <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex gap-2">
                            {tool.status === 'beta' && (
                                <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20">Beta</Badge>
                            )}
                            {tool.status === 'new' && (
                                <Badge className="bg-primary/20 text-primary hover:bg-primary/30">New</Badge>
                            )}
                        </div>

                        {onToggleFavorite && (
                            <button
                                onClick={onToggleFavorite}
                                className="absolute top-4 right-4 text-muted-foreground hover:text-yellow-500 transition-colors z-10 p-1 rounded-full hover:bg-muted"
                            >
                                <Star className={cn("h-5 w-5", isFavorite ? "fill-yellow-500 text-yellow-500" : "")} />
                            </button>
                        )}
                    </div>
                    <CardTitle className="text-xl group-hover:text-primary transition-colors">{tool.name}</CardTitle>
                    <CardDescription className="line-clamp-2 mt-2 leading-relaxed">
                        {tool.description}
                    </CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                    <div className="flex flex-wrap gap-2">
                        {tool.keywords.slice(0, 3).map(keyword => (
                            <span key={keyword} className="text-xs text-muted-foreground bg-muted/75 px-2 py-1 rounded-md border border-border/50">
                                #{keyword}
                            </span>
                        ))}
                    </div>
                </CardContent>

                <CardFooter className="pt-2">
                    <div className="text-sm font-medium text-primary flex items-center opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                        Use Tool <ArrowRight className="ml-2 h-4 w-4" />
                    </div>
                </CardFooter>
            </Card>
        </Link>
    )
}
