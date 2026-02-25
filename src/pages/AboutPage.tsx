import { Shield, Lock, Zap, ListChecks, Terminal } from "lucide-react"
import { motion } from "framer-motion"
import { SEO } from "@/components/features/SEO"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AboutPage() {
    return (
        <div className="max-w-4xl mx-auto space-y-16 py-10">
            <SEO
                title="About"
                description="Learn about the philosophy behind Secutil - local-first security tools with explicit network-intel modes."
                canonical="/about"
                keywords={[
                    "about secutil",
                    "local-first security",
                    "privacy first cybersecurity tools",
                    "browser-based security utilities",
                ]}
                breadcrumbItems={[
                    { name: "Home", url: "/" },
                    { name: "About", url: "/about" },
                ]}
                structuredData={[
                    {
                        "@context": "https://schema.org",
                        "@type": "AboutPage",
                        name: "About Secutil",
                        description: "Local-first security tooling philosophy, privacy model, and operating principles.",
                        url: "/about",
                    },
                    {
                        "@context": "https://schema.org",
                        "@type": "FAQPage",
                        mainEntity: [
                            {
                                "@type": "Question",
                                name: "Does Secutil process tool inputs locally?",
                                acceptedAnswer: {
                                    "@type": "Answer",
                                    text: "Most Secutil tools process data fully in-browser. Tools that require outbound lookups are explicitly labeled before use.",
                                },
                            },
                            {
                                "@type": "Question",
                                name: "Which teams is Secutil built for?",
                                acceptedAnswer: {
                                    "@type": "Answer",
                                    text: "Secutil is built for SOC analysts, threat-intel teams, application security engineers, cloud IAM teams, and privacy-focused defenders.",
                                },
                            },
                        ],
                    },
                ]}
            />
            {/* Hero Section */}
            <div className="text-center space-y-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="inline-block p-4 rounded-full bg-primary/10 mb-4"
                >
                    <Terminal className="h-12 w-12 text-primary" />
                </motion.div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                    Security utilities built for <span className="text-primary">clear data handling</span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                    Secutil focuses on local-first execution, explicit network disclosure, and practical workflows for analysts and developers.
                </p>
            </div>

            {/* Values Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                    {
                        icon: Lock,
                        title: "Privacy Model",
                        desc: "Most transformations run entirely in-browser. Network and hybrid tools are visibly labeled."
                    },
                    {
                        icon: Zap,
                        title: "Operational Speed",
                        desc: "Fast client-side execution removes waiting for server-side processing in common tasks."
                    },
                    {
                        icon: ListChecks,
                        title: "Deterministic UX",
                        desc: "Domain-based navigation and consistent input/output layouts reduce triage friction."
                    }
                ].map((item, i) => (
                    <motion.div
                        key={item.title}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        viewport={{ once: true }}
                    >
                        <Card className="h-full border-muted/50 hover:border-primary/50 transition-colors">
                            <CardHeader>
                                <item.icon className="h-8 w-8 text-primary mb-2" />
                                <CardTitle>{item.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground leading-relaxed">
                                    {item.desc}
                                </p>
                            </CardContent>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Philosophy Section */}
            <div className="bg-muted/30 rounded-2xl p-8 md:p-12 border border-muted/50">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                    <Shield className="h-6 w-6 text-primary" />
                    Design Principles
                </h2>
                <div className="space-y-4 text-muted-foreground leading-relaxed">
                    <p>
                        Many security workflows involve sensitive artifacts such as tokens, headers, keys, and internal indicators.
                        Sending this data to unknown backends introduces avoidable risk.
                    </p>
                    <p>
                        Secutil uses a local-first approach so analysis can run on your device by default.
                        For tools that require external lookups (WHOIS, DNS, RDAP, JWKS, or provider proxies), the interface labels this clearly so usage decisions are explicit.
                    </p>
                </div>
            </div>

        </div>
    )
}
