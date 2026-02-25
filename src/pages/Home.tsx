import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight, Shield, Zap, Lock, Code } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToolsList } from "@/components/tools/ToolsList"
import { SEO } from "@/components/features/SEO"

export default function Home() {
    return (
        <div className="space-y-20">
            <SEO
                title="Free Security Tools"
                description="A comprehensive suite of free, local-first security tools for developers and analysts, with optional network intel lookups."
            />
            {/* Hero Section */}
            <section className="relative py-20 md:py-32 overflow-hidden">
                <div className="container relative z-10 flex flex-col items-center text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium bg-background/50 backdrop-blur-sm mb-6">
                            <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
                            v1.0.0 Ready for Production
                        </div>
                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
                            Your Security Arsenal, <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500">Simplified</span>
                        </h1>
                        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
                            Free, privacy-first security utilities for SOC analysts, penetration testers, and developers.
                            Core analysis runs locally in your browser, with clearly marked optional network lookups (RDAP, DNS, JWKS, and reputation proxy).
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button size="lg" asChild className="h-12 px-8 text-lg">
                                <Link to="/tools">
                                    Explore Tools
                                    <ArrowRight className="ml-2 h-5 w-5" />
                                </Link>
                            </Button>
                            <Button size="lg" variant="outline" asChild className="h-12 px-8 text-lg">
                                <Link to="/about">Learn More</Link>
                            </Button>
                        </div>
                    </motion.div>
                </div>

                {/* Abstract Background Shapes */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-3xl -z-10 opacity-30 animate-pulse" />
            </section>

            {/* Features Grid */}
            <section className="container">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {[
                        {
                            icon: Lock,
                            title: "Privacy First",
                            desc: "Local-first processing, with explicit opt-in network lookups for intel tools."
                        },
                        {
                            icon: Zap,
                            title: "Lightning Fast",
                            desc: "Instant results with optimized WebAssembly and JS."
                        },
                        {
                            icon: Shield,
                            title: "100% Free",
                            desc: "No subscriptions, no ads, no hidden fees. Forever."
                        },
                        {
                            icon: Code,
                            title: "Built by Analysts",
                            desc: "Tools designed for real-world security workflows."
                        }
                    ].map((feature, i) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className="p-6 rounded-xl border bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-colors"
                        >
                            <feature.icon className="h-10 w-10 text-primary mb-4" />
                            <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                            <p className="text-muted-foreground">{feature.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Tools Preview */}
            <section className="container space-y-8">
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold tracking-tight">Popular Tools</h2>
                    <Link to="/tools" className="text-primary hover:underline">View all &rarr;</Link>
                </div>
                <ToolsList />
            </section>
        </div>
    )
}
