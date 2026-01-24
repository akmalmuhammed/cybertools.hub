import { ToolCard } from "@/components/tools/ToolCard"
import { TOOLS } from "@/lib/constants/tools"
import { motion } from "framer-motion"
import { useFavoritesStore } from "@/store/useFavoritesStore"
import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { useSearchParams } from "react-router-dom"
import { ToolCategory } from "@/types/tool.types"

// Helper to get readable label
const getCategoryLabel = (cat: string) => {
    switch (cat) {
        case 'security': return 'Security';
        case 'network': return 'Network';
        case 'application': return 'Application';
        case 'others': return 'Others';
        default: return 'All Tools';
    }
}

export function ToolsList() {
    const { isFavorite, toggleFavorite } = useFavoritesStore()
    const [filter, setFilter] = useState<'all' | 'favorites'>('all')
    const [searchParams, setSearchParams] = useSearchParams()

    const categoryParam = searchParams.get('category') as ToolCategory | null

    const displayedTools = useMemo(() => {
        let tools = TOOLS;

        // Filter by category if present
        if (categoryParam) {
            tools = tools.filter(tool => tool.category === categoryParam)
        }

        // Filter by favorites if selected
        if (filter === 'favorites') {
            tools = tools.filter(tool => isFavorite(tool.id))
        }

        return tools
    }, [categoryParam, filter, isFavorite])

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex gap-2">
                    <Button
                        variant={filter === 'all' ? 'secondary' : 'ghost'}
                        onClick={() => setFilter('all')}
                        size="sm"
                    >
                        All Tools
                    </Button>
                    <Button
                        variant={filter === 'favorites' ? 'secondary' : 'ghost'}
                        onClick={() => setFilter('favorites')}
                        size="sm"
                    >
                        Favorites
                    </Button>
                    {categoryParam && (
                        <Button
                            variant="ghost"
                            onClick={() => setSearchParams({})}
                            size="sm"
                            className="text-muted-foreground hover:text-foreground"
                        >
                            Clear Filter ({getCategoryLabel(categoryParam)})
                        </Button>
                    )}
                </div>
                <div className="text-sm text-muted-foreground">
                    Showing {displayedTools.length} {categoryParam ? getCategoryLabel(categoryParam) : ''} tools
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayedTools.map((tool, index) => (
                    <motion.div
                        key={tool.id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        viewport={{ once: true }}
                    >
                        <ToolCard
                            tool={tool}
                            isFavorite={isFavorite(tool.id)}
                            onToggleFavorite={(e) => {
                                e.preventDefault(); // Prevent navigation
                                e.stopPropagation();
                                toggleFavorite(tool.id);
                            }}
                        />
                    </motion.div>
                ))}

                {displayedTools.length === 0 && (
                    <div className="col-span-full py-12 text-center text-muted-foreground">
                        No tools found. {filter === 'favorites' && "Add tools to your favorites to see them here."}
                    </div>
                )}
            </div>
        </div>
    )
}
