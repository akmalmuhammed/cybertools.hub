import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { CheckCircle2, XCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export function HashCompare() {
    const [hashA, setHashA] = useState('')
    const [hashB, setHashB] = useState('')
    const [result, setResult] = useState<'match' | 'mismatch' | null>(null)

    useEffect(() => {
        if (!hashA.trim() || !hashB.trim()) {
            setResult(null)
            return
        }

        const cleanA = hashA.trim().toLowerCase()
        const cleanB = hashB.trim().toLowerCase()

        setResult(cleanA === cleanB ? 'match' : 'mismatch')
    }, [hashA, hashB])

    return (
        <div className="space-y-8">
            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label>Hash A</Label>
                    <Textarea
                        placeholder="Paste first hash..."
                        value={hashA}
                        onChange={(e) => setHashA(e.target.value)}
                        className={cn("font-mono text-xs", result === 'mismatch' && "border-destructive")}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Hash B</Label>
                    <Textarea
                        placeholder="Paste second hash..."
                        value={hashB}
                        onChange={(e) => setHashB(e.target.value)}
                        className={cn("font-mono text-xs", result === 'mismatch' && "border-destructive")}
                    />
                </div>
            </div>

            {result && (
                <div className={cn(
                    "flex flex-col items-center justify-center p-8 rounded-lg border-2 border-dashed transition-all",
                    result === 'match'
                        ? "border-green-500/50 bg-green-500/5"
                        : "border-destructive/50 bg-destructive/5"
                )}>
                    {result === 'match' ? (
                        <>
                            <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                            <h3 className="text-2xl font-bold text-green-500">MATCH</h3>
                            <p className="text-muted-foreground text-center mt-2">
                                The hashes are identical.
                            </p>
                        </>
                    ) : (
                        <>
                            <XCircle className="h-16 w-16 text-destructive mb-4" />
                            <h3 className="text-2xl font-bold text-destructive">NO MATCH</h3>
                            <p className="text-muted-foreground text-center mt-2">
                                These hashes do not match.
                            </p>
                        </>
                    )}
                </div>
            )}

            <div className="flex justify-center">
                <Button variant="outline" onClick={() => { setHashA(''); setHashB('') }} disabled={!hashA && !hashB}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset
                </Button>
            </div>
        </div>
    )
}
