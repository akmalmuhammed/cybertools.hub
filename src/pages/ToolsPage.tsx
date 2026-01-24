import { ToolsList } from "@/components/tools/ToolsList"
import { motion } from "framer-motion"

export default function ToolsPage() {
    return (
        <div className="space-y-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-4"
            >
                <h1 className="text-4xl font-bold tracking-tight">Security Tools</h1>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                    A comprehensive collection of security utilities for SOC analysts, penetration testers, and developers.
                </p>
            </motion.div>

            <ToolsList />
        </div>
    )
}
