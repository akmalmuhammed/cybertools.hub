import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCopyToClipboard } from "@/lib/hooks/useCopyToClipboard"
import { cn } from "@/lib/utils/cn"
import { motion, AnimatePresence } from "framer-motion"

interface CopyButtonProps {
    text: string
    className?: string
    fullWidth?: boolean
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | null | undefined
    size?: "default" | "sm" | "lg" | "icon" | null | undefined
}

export function CopyButton({ text, className, fullWidth = false, variant = "outline", size }: CopyButtonProps) {
    const { isCopied, copyToClipboard } = useCopyToClipboard()

    const finalSize = size || (fullWidth ? "default" : "icon")

    return (
        <Button
            variant={variant}
            size={finalSize}
            onClick={() => copyToClipboard(text)}
            disabled={!text}
            className={cn(
                "relative transition-all duration-200",
                isCopied && "border-green-500 text-green-500 hover:text-green-600 bg-green-50 dark:bg-green-900/20",
                fullWidth && "w-full",
                className
            )}
        >
            <AnimatePresence mode="wait" initial={false}>
                {isCopied ? (
                    <motion.div
                        key="check"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        className="flex items-center gap-2"
                    >
                        <Check className="h-4 w-4" />
                        {fullWidth && <span>Copied!</span>}
                    </motion.div>
                ) : (
                    <motion.div
                        key="copy"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        className="flex items-center gap-2"
                    >
                        <Copy className="h-4 w-4" />
                        {fullWidth && <span>Copy Result</span>}
                    </motion.div>
                )}
            </AnimatePresence>
        </Button>
    )
}
