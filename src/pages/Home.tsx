import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight, Shield, Network, AppWindow } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToolCard } from "@/components/tools/ToolCard"
import { SEO } from "@/components/features/SEO"
import { TOOLS } from "@/lib/constants/tools"
import { getProcessingCounts } from "@/lib/constants/tool-trust"

export default function Home() {
    const previewToolIds = [
        "cve-prioritizer",
        "secrets-scanner",
        "jwt-verify",
        "domain-spoof",
        "dns-toolkit",
        "ioc",
    ]
    const previewTools = previewToolIds
        .map((toolId) => TOOLS.find((tool) => tool.id === toolId))
        .filter((tool): tool is (typeof TOOLS)[number] => tool !== undefined)
    const processingCounts = getProcessingCounts()

    return (
        <div className="space-y-14">
            <SEO
                title="Free Security Tools"
                description="A comprehensive suite of free, local-first security tools for developers and analysts, with optional network intel lookups."
                keywords={[
                    "free security tools",
                    "cybersecurity toolkit",
                    "soc analyst tools",
                    "network security tools",
                    "application security tools",
                ]}
                structuredData={{
                    "@context": "https://schema.org",
                    "@type": "WebApplication",
                    name: "CyberTools Hub",
                    description: "Local-first cybersecurity tools for SOC, network, and application workflows.",
                    applicationCategory: "SecurityApplication",
                    operatingSystem: "Any",
                    offers: {
                        "@type": "Offer",
                        price: "0",
                        priceCurrency: "USD",
                    },
                }}
            />
            <section className="rounded-3xl border border-border/60 bg-card/60 p-6 md:p-10">
                <div className="max-w-4xl space-y-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="inline-flex items-center rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-4">
                            Security Utility Platform
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
                            Local-first security tools for SOC, network, and AppSec workflows
                        </h1>
                        <p className="text-base md:text-lg text-muted-foreground max-w-3xl mb-8">
                            Use browser-native tools for parsing, triage, and validation with explicit processing labels.
                            Local mode keeps data on-device, and network/hybrid mode clearly indicates outbound lookups.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Button size="lg" asChild className="h-12 px-8 text-lg">
                                <Link to="/tools">
                                    Open Tool Inventory
                                    <ArrowRight className="ml-2 h-5 w-5" />
                                </Link>
                            </Button>
                            <Button size="lg" variant="outline" asChild className="h-12 px-8 text-lg">
                                <Link to="/about">Learn More</Link>
                            </Button>
                        </div>
                    </motion.div>
                </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-emerald-300">Local</div>
                    <div className="text-2xl font-semibold mt-1">{processingCounts.local}</div>
                    <div className="text-sm text-muted-foreground">no outbound requests</div>
                </div>
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-sky-300">Hybrid</div>
                    <div className="text-2xl font-semibold mt-1">{processingCounts.hybrid}</div>
                    <div className="text-sm text-muted-foreground">optional lookups</div>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-amber-300">Network</div>
                    <div className="text-2xl font-semibold mt-1">{processingCounts.network}</div>
                    <div className="text-sm text-muted-foreground">external intel queries</div>
                </div>
            </section>

            <section>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        {
                            icon: Shield,
                            title: "Transparent Processing",
                            desc: "Every tool surfaces local, hybrid, or network mode so analysts know where data is handled."
                        },
                        {
                            icon: Network,
                            title: "Domain-Aligned Navigation",
                            desc: "SOC, Network, AppSec, and Utility navigation maps directly to operational workflows."
                        },
                        {
                            icon: AppWindow,
                            title: "Tooling for Daily Triage",
                            desc: "Prioritization, parsing, header hardening, IOC workflows, and format utilities in one shell."
                        }
                    ].map((feature, i) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className="p-6 rounded-xl border bg-card/50 backdrop-blur-sm hover:bg-card/70 transition-colors"
                        >
                            <feature.icon className="h-10 w-10 text-primary mb-4" />
                            <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                            <p className="text-muted-foreground">{feature.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            <section className="space-y-8">
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold tracking-tight">Commonly Used Tools</h2>
                    <Link to="/tools" className="text-primary hover:underline">View all tools &rarr;</Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {previewTools.map((tool, index) => (
                        <motion.div
                            key={tool.id}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.04 }}
                            viewport={{ once: true }}
                        >
                            <ToolCard tool={tool} />
                        </motion.div>
                    ))}
                </div>
            </section>
        </div>
    )
}
