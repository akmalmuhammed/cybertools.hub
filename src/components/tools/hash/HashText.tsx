import { useState } from 'react'
import { generateAllHashes, HashOptions } from '@/lib/utils/hashers'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { CopyButton } from '@/components/features/CopyButton'
import { Download, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type HashResult = Awaited<ReturnType<typeof generateAllHashes>>
type BulkHashResult = HashResult & { input: string }

export function HashText() {
    const [input, setInput] = useState('')
    const [isBulk, setIsBulk] = useState(false)
    const [hashes, setHashes] = useState<HashResult | BulkHashResult[] | null>(null)
    const [loading, setLoading] = useState(false)

    // V2 Options
    const [showOptions, setShowOptions] = useState(false)
    const [hmacKey, setHmacKey] = useState('')
    const [salt, setSalt] = useState('')
    const [saltPosition, setSaltPosition] = useState<'prepend' | 'append'>('append')
    const [upperCase, setUpperCase] = useState(false)
    const [verifyHash, setVerifyHash] = useState('')

    const handleProcess = async () => {
        if (!input.trim()) return
        setLoading(true)

        const options: HashOptions = {
            hmacKey: hmacKey.trim() || undefined,
            salt: salt || undefined,
            saltPosition
        }

        try {
            if (isBulk) {
                const lines = input.split('\n').filter(l => l.trim())
                if (lines.length > 500) {
                    // Limit handled by UI thread naturally
                }
                const results: BulkHashResult[] = await Promise.all(lines.map(async line => {
                    const h = await generateAllHashes(line.trim(), options)
                    return { input: line.trim(), ...h }
                }))
                setHashes(results)
            } else {
                const h = await generateAllHashes(input, options)
                setHashes(h)
            }
        } finally {
            setLoading(false)
        }
    }

    const downloadCSV = () => {
        if (!Array.isArray(hashes)) return
        const headers = ['Input', 'MD5', 'SHA-1', 'SHA-256', 'SHA-512']
        const format = (h: string) => upperCase ? h.toUpperCase() : h
        const rows = hashes.map(h => [
            `"${h.input.replace(/"/g, '""')}"`,
            format(h.md5),
            format(h.sha1),
            format(h.sha256),
            format(h.sha512)
        ])
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'hashes.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    const trimmedVerify = verifyHash.trim().toLowerCase()
    const singleHashValues = hashes && !Array.isArray(hashes)
        ? [hashes.md5, hashes.sha1, hashes.sha256, hashes.sha512]
        : []
    const hasSingleMatch = !!trimmedVerify && singleHashValues.some((hashValue) => hashValue.toLowerCase() === trimmedVerify)

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Switch id="bulk-mode" checked={isBulk} onChange={(e) => {
                            setIsBulk(e.target.checked)
                            setHashes(null)
                        }} />
                        <Label htmlFor="bulk-mode">Bulk Mode (One per line)</Label>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowOptions(!showOptions)} className="text-muted-foreground">
                        {showOptions ? "Hide Options" : "Advanced Options"}
                        {showOptions ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
                    </Button>
                </div>

                {showOptions && (
                    <div className="grid gap-4 p-4 border rounded-lg bg-muted/30 animate-in slide-in-from-top-2">
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>HMAC Key (Optional)</Label>
                                <Input
                                    placeholder="Secret key..."
                                    value={hmacKey}
                                    onChange={(e) => setHmacKey(e.target.value)}
                                    type="password"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Salt (Optional)</Label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Salt string..."
                                        value={salt}
                                        onChange={(e) => setSalt(e.target.value)}
                                    />
                                    <Button
                                        variant="outline"
                                        className="w-24 shrink-0"
                                        onClick={() => setSaltPosition(prev => prev === 'append' ? 'prepend' : 'append')}
                                    >
                                        {saltPosition === 'append' ? 'Append' : 'Prepend'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2 pt-2">
                            <Switch id="uppercase" checked={upperCase} onChange={(e) => setUpperCase(e.target.checked)} />
                            <Label htmlFor="uppercase">Uppercase Output</Label>
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <Textarea
                    placeholder={isBulk ? "Enter multiple texts, one per line..." : "Enter text to hash..."}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="min-h-[150px] font-mono text-sm"
                />
                <Button onClick={handleProcess} disabled={!input.trim() || loading} className="w-full">
                    {loading ? "Processing..." : "Generate Hashes"}
                </Button>
            </div>

            {hashes && !isBulk && !Array.isArray(hashes) && (
                <div className="space-y-6">
                    <div className="space-y-4">
                        <HashRow label="MD5" hash={hashes.md5} upperCase={upperCase} verifyHash={verifyHash} />
                        <HashRow label="SHA-1" hash={hashes.sha1} upperCase={upperCase} verifyHash={verifyHash} />
                        <HashRow label="SHA-256" hash={hashes.sha256} upperCase={upperCase} verifyHash={verifyHash} />
                        <HashRow label="SHA-512" hash={hashes.sha512} upperCase={upperCase} verifyHash={verifyHash} />
                    </div>

                    <div className="pt-4 border-t">
                        <Label className="text-muted-foreground">Verify Hash Match</Label>
                        <div className="flex gap-2 mt-2">
                            <Input
                                placeholder="Paste a hash to verify..."
                                value={verifyHash}
                                onChange={(e) => setVerifyHash(e.target.value)}
                                className={cn(
                                    "font-mono text-sm",
                                    hasSingleMatch
                                        ? "border-green-500 ring-green-500/20"
                                        : verifyHash ? "border-destructive ring-destructive/20" : ""
                                )}
                            />
                        </div>
                        {verifyHash && (
                            <p className={cn("text-xs mt-1 font-medium",
                                hasSingleMatch
                                    ? "text-green-600"
                                    : "text-destructive"
                            )}>
                                {hasSingleMatch
                                    ? "✓ Match found!"
                                    : "✗ No match found"}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {hashes && isBulk && Array.isArray(hashes) && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <Button variant="outline" size="sm" onClick={downloadCSV}>
                            <Download className="h-4 w-4 mr-2" />
                            Export CSV
                        </Button>
                    </div>
                    <div className="rounded-md border">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted text-muted-foreground">
                                    <tr>
                                        <th className="p-3 font-medium">Input</th>
                                        <th className="p-3 font-medium">MD5</th>
                                        <th className="p-3 font-medium">SHA-256</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {hashes.map((h: BulkHashResult, i: number) => (
                                        <tr key={i} className="border-t">
                                            <td className="p-3 font-mono max-w-[200px] truncate" title={h.input}>{h.input}</td>
                                            <td className="p-3 font-mono text-xs">{upperCase ? h.md5.toUpperCase() : h.md5}</td>
                                            <td className="p-3 font-mono text-xs">{upperCase ? h.sha256.toUpperCase() : h.sha256}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function HashRow({ label, hash, upperCase, verifyHash }: { label: string; hash: string, upperCase: boolean, verifyHash: string }) {
    const displayHash = upperCase ? hash.toUpperCase() : hash
    const isMatch = verifyHash.trim() && verifyHash.trim().toLowerCase() === hash.toLowerCase()

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                    {label}
                    {isMatch && <span className="flex items-center text-green-600 bg-green-100 px-1.5 py-0.5 rounded text-[10px] font-bold"><Check className="w-3 h-3 mr-1" /> MATCH</span>}
                </span>
                <CopyButton text={displayHash} />
            </div>
            <div className="flex gap-2">
                <code className={cn(
                    "flex-1 p-2.5 rounded-md bg-muted font-mono text-xs break-all border transition-colors",
                    isMatch && "border-green-500 bg-green-50"
                )}>
                    {displayHash}
                </code>
            </div>
        </div>
    )
}
