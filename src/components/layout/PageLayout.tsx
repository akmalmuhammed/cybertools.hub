import { motion } from "framer-motion"
import { ReactNode } from "react"
import { Header } from "./Header"
import { Footer } from "./Footer"

interface PageLayoutProps {
    children: ReactNode
}

export function PageLayout({ children }: PageLayoutProps) {
    return (
        <div className="min-h-screen bg-background font-sans antialiased flex flex-col relative overflow-x-hidden">
            <Header />
            <main className="flex-1 flex flex-col container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in zoom-in duration-500">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.3 }}
                    className="flex-1 w-full"
                >
                    {children}
                </motion.div>
            </main>
            <Footer />
        </div>
    )
}
