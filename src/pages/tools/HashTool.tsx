
import { HashText } from "@/components/tools/hash/HashText"
import { HashFile } from "@/components/tools/hash/HashFile"
import { HashCompare } from "@/components/tools/hash/HashCompare"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Helmet } from "react-helmet-async"

export default function HashTool() {
    return (
        <div className="space-y-6">
            <Helmet>
                <title>Free Hash Generator (MD5, SHA256) | CyberTools.Hub</title>
                <meta name="description" content="Generate MD5, SHA1, SHA256, and SHA512 hashes locally in your browser. Secure, fast, and free online hash generator for developers." />
                <link rel="canonical" href="https://cybertools.hub/hash-generator" />
            </Helmet>
            <div className="flex flex-col space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Hash Generator</h1>
                <p className="text-muted-foreground">
                    Generate cryptographic hashes for text and files, or compare them.
                </p>
            </div>

            <Tabs defaultValue="text" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="text">Text & Bulk</TabsTrigger>
                    <TabsTrigger value="file">File (Client-side)</TabsTrigger>
                    <TabsTrigger value="compare">Compare</TabsTrigger>
                </TabsList>

                <div className="mt-6 border rounded-xl p-6 bg-card/50 backdrop-blur-sm">
                    <TabsContent value="text" className="mt-0">
                        <HashText />
                    </TabsContent>

                    <TabsContent value="file" className="mt-0">
                        <HashFile />
                    </TabsContent>

                    <TabsContent value="compare" className="mt-0">
                        <HashCompare />
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
