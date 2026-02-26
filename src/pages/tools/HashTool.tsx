
import { useState } from "react"
import { HashText } from "@/components/tools/hash/HashText"
import { HashFile } from "@/components/tools/hash/HashFile"
import { HashCompare } from "@/components/tools/hash/HashCompare"
import type { HashRunReport } from "@/components/tools/hash/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SEO } from "@/components/features/SEO"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { useAnalystSession } from "@/lib/hooks/useAnalystSession"
import { AnalystSessionPanel } from "@/components/tools/AnalystSessionPanel"

export default function HashTool() {
    const session = useAnalystSession("hash")
    const [latestRun, setLatestRun] = useState<HashRunReport | null>(null)

    const handleRun = (run: HashRunReport) => {
        setLatestRun(run)
        session.recordRun({
            durationMs: run.durationMs,
            status: run.status,
            score: run.score,
            findings: run.findings,
            summary: run.summary,
            mode: run.mode,
            metrics: run.metrics,
        })
    }

    const exportEvidencePack = () => {
        const payload = session.attachContext({
            toolName: "Hash Generator",
            exportedAt: new Date().toISOString(),
            latestRun,
            notes: "Hash operations were executed locally in browser.",
        })
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement("a")
        anchor.href = url
        anchor.download = "hash-session-evidence.json"
        document.body.appendChild(anchor)
        anchor.click()
        document.body.removeChild(anchor)
        URL.revokeObjectURL(url)
    }

    return (
        <div className="space-y-6">
            <SEO
                title="Hash Generator"
                description="Generate MD5, SHA1, SHA256, and SHA512 hashes locally for text and files, and compare hash integrity values."
                canonical="/tools/hash"
                keywords={[
                    "hash generator",
                    "sha256 generator",
                    "md5 hash tool",
                    "file hash checker",
                ]}
                breadcrumbItems={[
                    { name: "Home", url: "/" },
                    { name: "Tools", url: "/tools" },
                    { name: "Data Security & Privacy Engineering", url: "/domains/data-security-privacy-engineering" },
                    { name: "Hash Generator", url: "/tools/hash" },
                ]}
                structuredData={{
                    "@context": "https://schema.org",
                    "@type": "SoftwareApplication",
                    name: "Hash Generator",
                    applicationCategory: "Application Security Tool",
                    operatingSystem: "Any",
                    offers: {
                        "@type": "Offer",
                        price: "0",
                        priceCurrency: "USD",
                    },
                }}
            />
            <div className="flex flex-col space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Hash Generator</h1>
                <p className="text-muted-foreground">
                    Generate cryptographic hashes for text and files, or compare them.
                </p>
                <div className="pt-2">
                    <Button variant="outline" size="sm" onClick={exportEvidencePack}>
                        <Download className="h-4 w-4 mr-2" /> Export Session Evidence
                    </Button>
                </div>
            </div>

            <AnalystSessionPanel
                caseId={session.caseId}
                setCaseId={session.setCaseId}
                caseOwner={session.caseOwner}
                setCaseOwner={session.setCaseOwner}
                caseTags={session.caseTags}
                setCaseTags={session.setCaseTags}
                normalizedTags={session.normalizedTags}
                runs={session.runs}
                onClearRuns={session.clearRuns}
            />

            <Tabs defaultValue="text" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="text">Text & Bulk</TabsTrigger>
                    <TabsTrigger value="file">File (Client-side)</TabsTrigger>
                    <TabsTrigger value="compare">Compare</TabsTrigger>
                </TabsList>

                <div className="mt-6 border rounded-xl p-6 bg-card/50 backdrop-blur-sm">
                    <TabsContent value="text" className="mt-0">
                        <HashText onRun={handleRun} />
                    </TabsContent>

                    <TabsContent value="file" className="mt-0">
                        <HashFile onRun={handleRun} />
                    </TabsContent>

                    <TabsContent value="compare" className="mt-0">
                        <HashCompare onRun={handleRun} />
                    </TabsContent>
                </div>
            </Tabs>

            <div className="rounded-lg border bg-muted/50 p-4">
                <h4 className="mb-2 font-semibold">Algorithm Guidance</h4>
                <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    <li className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">MD5</span>
                        <span>Legacy / Broken. Use only for non-security checks.</span>
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">SHA-1</span>
                        <span>Deprecated. Weak collision resistance.</span>
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">SHA-256</span>
                        <span>Standard. Secure for most use cases.</span>
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">SHA-512</span>
                        <span>Strongest. High performance on 64-bit systems.</span>
                    </li>
                </ul>
            </div>
        </div>
    )
}
