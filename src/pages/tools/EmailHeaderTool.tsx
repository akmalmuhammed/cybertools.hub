import { EmailAnalyzer } from "@/components/tools/email/EmailAnalyzer";
import { SEO } from "@/components/features/SEO";

export default function EmailHeaderTool() {
    return (
        <div className="space-y-4 h-full">
            <SEO
                title="Email Header Analyzer"
                description="Analyze SPF, DKIM, DMARC alignment, hop path integrity, and phishing delivery signals from email headers."
                canonical="/tools/email"
                keywords={[
                    "email header analyzer",
                    "spf dkim dmarc checker",
                    "phishing email analysis",
                    "mail header forensics",
                ]}
                breadcrumbItems={[
                    { name: "Home", url: "/" },
                    { name: "Tools", url: "/tools" },
                    { name: "SOC & Detection Engineering", url: "/domains/soc-detection-engineering" },
                    { name: "Email Header Analyzer", url: "/tools/email" },
                ]}
                structuredData={{
                    "@context": "https://schema.org",
                    "@type": "SoftwareApplication",
                    name: "Email Header Analyzer",
                    applicationCategory: "SOC & Threat Intel Tool",
                    operatingSystem: "Any",
                    offers: {
                        "@type": "Offer",
                        price: "0",
                        priceCurrency: "USD",
                    },
                }}
            />
            <div className="flex flex-col space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Email Header Analyzer</h1>
                <p className="text-muted-foreground">
                    Investigate email legitimacy, trace delivery paths, and analyze authentication (SPF/DKIM/DMARC) alignment.
                </p>
            </div>

            <div className="flex-1 h-full min-h-0">
                <EmailAnalyzer />
            </div>
        </div>
    )
}
