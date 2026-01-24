import { Link, useLocation } from "react-router-dom"
import { Github, Home, Info, Shield, X, Lock, Network, LayoutGrid, MoreHorizontal } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { useEffect } from "react"
import { cn } from "@/lib/utils/cn"

interface MobileNavProps {
    isOpen: boolean
    onClose: () => void
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
    const location = useLocation()

    // Close on route change
    useEffect(() => {
        onClose()
    }, [location.pathname, location.search, onClose])

    // Lock body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = "unset"
        }
    }, [isOpen])

    const menuItems = [
        { label: "Home", href: "/", icon: Home },
        { label: "All Tools", href: "/tools", icon: Shield },
        { label: "Security", href: "/tools?category=security", icon: Lock },
        { label: "Network", href: "/tools?category=network", icon: Network },
        { label: "Application", href: "/tools?category=application", icon: LayoutGrid },
        { label: "Others", href: "/tools?category=others", icon: MoreHorizontal },
        { label: "About", href: "/about", icon: Info },
    ]

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        className="fixed right-0 top-0 z-50 h-full w-[300px] border-l border-border bg-background p-6 shadow-xl"
                    >
                        <div className="flex items-center justify-between mb-8">
                            <span className="text-lg font-bold">Menu</span>
                            <Button variant="ghost" size="icon" onClick={onClose}>
                                <X className="h-5 w-5" />
                                <span className="sr-only">Close menu</span>
                            </Button>
                        </div>

                        <nav className="flex flex-col gap-4">
                            {menuItems.map((item, index) => (
                                <motion.div
                                    key={item.href}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                >
                                    <Link
                                        to={item.href}
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-3 rounded-md transition-colors",
                                            (location.pathname === item.href || (item.href.includes('?') && location.search === item.href.split('?')[1]))
                                                ? "bg-primary/10 text-primary"
                                                : "hover:bg-muted"
                                        )}
                                    >
                                        <item.icon className="h-5 w-5" />
                                        <span className="font-medium">{item.label}</span>
                                    </Link>
                                </motion.div>
                            ))}
                        </nav>

                        <div className="absolute bottom-8 left-6 right-6">
                            <div className="flex gap-4 justify-center">
                                <a href="https://github.com" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                                    <Github className="h-6 w-6" />
                                </a>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
