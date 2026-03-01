import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"
import { useThemeStore } from "@/store/useThemeStore"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"

export function DarkModeToggle() {
    const { theme, toggleTheme } = useThemeStore()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return null

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="relative w-9 h-9 rounded-full hover:bg-muted"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            <motion.div
                initial={false}
                animate={{ rotate: theme === 'dark' ? 180 : 0, scale: theme === 'dark' ? 0 : 1 }}
                transition={{ duration: 0.3 }}
                className="absolute"
            >
                <Sun className="h-5 w-5 text-primary" />
            </motion.div>
            <motion.div
                initial={false}
                animate={{ rotate: theme === 'dark' ? 0 : -180, scale: theme === 'dark' ? 1 : 0 }}
                transition={{ duration: 0.3 }}
                className="absolute"
            >
                <Moon className="h-5 w-5 text-primary" />
            </motion.div>
            <span className="sr-only">Toggle theme</span>
        </Button>
    )
}
