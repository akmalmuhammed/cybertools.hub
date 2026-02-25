import { Shield, Lock, Zap, Code, Terminal } from "lucide-react"
import { motion } from "framer-motion"
import { SEO } from "@/components/features/SEO"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AboutPage() {
    return (
        <div className="max-w-4xl mx-auto space-y-16 py-10">
            <SEO
                title="About"
                description="Learn about the philosophy behind CyberTools Hub - local-first security tools with explicit network-intel modes."
                keywords={[
                    "about cybertools hub",
                    "local-first security",
                    "privacy first cybersecurity tools",
                    "browser-based security utilities",
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
                    Security Tools for the <span className="text-primary">Modern Web</span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                    Built for developers, penetration testers, and security enthusiasts.
                    Local-first processing with clearly marked external lookup tools.
                </p>
            </div>

            {/* Values Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                    {
                        icon: Lock,
                        title: "Privacy First",
                        desc: "Core transformations run locally. Network tools explicitly disclose outbound requests to third-party endpoints."
                    },
                    {
                        icon: Zap,
                        title: "Performance",
                        desc: "Powered by WebAssembly and modern JavaScript. Instant results without network latency."
                    },
                    {
                        icon: Code,
                        title: "Open Source",
                        desc: "Transparent code. Verify the logic yourself. Contribute to the community."
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
                    Our Philosophy
                </h2>
                <div className="space-y-4 text-muted-foreground leading-relaxed">
                    <p>
                        In an era where data breaches are common, trusting online tools with sensitive data (like API keys, JWTs, or password hashes) is risky.
                        Most online converters send your data to their backend for processing, creating a potential attack vector.
                    </p>
                    <p>
                        <strong>CyberTools Hub is different.</strong> We believe that utility tools should not require trust.
                        By leveraging modern browser capabilities, we've rebuilt essential security tools to run on your device by default.
                        For network workflows (WHOIS/IP/DNS/JWKS/port probes and reputation proxy calls), we explicitly label outbound requests.
                    </p>
                </div>
            </div>

        </div>
    )
}
