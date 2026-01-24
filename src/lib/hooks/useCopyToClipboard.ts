import { useState, useCallback } from "react"
import { useToast } from "@/components/ui/use-toast"

export function useCopyToClipboard() {
    const [isCopied, setIsCopied] = useState(false)
    const { toast } = useToast()

    const copyToClipboard = useCallback(async (text: string) => {
        if (!text) return

        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(text)
                setIsCopied(true)
                toast({
                    title: "Copied to clipboard",
                    description: "The content has been copied to your clipboard.",
                    duration: 2000,
                })
                setTimeout(() => setIsCopied(false), 2000)
            } else {
                throw new Error("Clipboard not supported")
            }
        } catch (error) {
            console.warn("Copy failed", error)
            toast({
                title: "Copy failed",
                description: "Could not copy text to clipboard.",
                variant: "destructive",
            })
            setIsCopied(false)
        }
    }, [toast])

    return { isCopied, copyToClipboard }
}
