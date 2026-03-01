import { motion } from "framer-motion"
import { ReactNode } from "react"
import { Header } from "./Header"
import { Footer } from "./Footer"
import { useLocation } from "react-router-dom"
import { TOOLS } from "@/lib/constants/tools"
import { ToolDomainSidebar } from "./ToolDomainSidebar"
import { AppShellNav } from "./AppShellNav"

interface PageLayoutProps {
    children: ReactNode
}

export function PageLayout({ children }: PageLayoutProps) {
    const location = useLocation()
    const isToolsRoute =
        location.pathname === "/tools" ||
        location.pathname.startsWith("/domains/") ||
        TOOLS.some((tool) => tool.path === location.pathname)

    return (
        <div className="min-h-screen bg-background font-sans antialiased flex flex-col relative overflow-x-hidden isolate lg:pl-20">
            <div className="pointer-events-none fixed inset-0 -z-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,hsl(var(--primary)/0.09),transparent_42%),radial-gradient(circle_at_85%_8%,hsl(var(--link)/0.09),transparent_44%),linear-gradient(180deg,hsl(var(--foreground)/0.03),transparent_58%)] dark:bg-[radial-gradient(circle_at_10%_10%,hsl(var(--primary)/0.16),transparent_42%),radial-gradient(circle_at_85%_8%,hsl(var(--link)/0.14),transparent_44%),linear-gradient(180deg,hsl(var(--foreground)/0.06),transparent_58%)]" />
                <div className="absolute inset-0 opacity-[0.1] [background-size:36px_36px] [background-image:linear-gradient(to_right,hsl(var(--foreground)/0.15)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--foreground)/0.15)_1px,transparent_1px)]" />
            </div>
            <AppShellNav />
            <Header />
            <main className="flex-1 flex flex-col container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 lg:pb-10 animate-in fade-in zoom-in duration-500">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.3 }}
                    className="flex-1 w-full"
                >
                    {isToolsRoute ? (
                        <div className="grid grid-cols-1 2xl:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
                            <ToolDomainSidebar />
                            <div className="min-w-0">{children}</div>
                        </div>
                    ) : (
                        children
                    )}
                </motion.div>
            </main>
            <Footer />
        </div>
    )
}
