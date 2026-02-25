import { useState, useRef, useCallback } from 'react'
import CryptoJS from 'crypto-js'
import { Upload, File, X, AlertCircle, Copy, Check } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'


const CHUNK_SIZE = 1024 * 1024 * 2 // 2MB chunks

interface FileHashResult {
    md5: string
    sha1: string
    sha256: string
    sha512: string
}

export function HashFile() {
    const [file, setFile] = useState<File | null>(null)
    const [progress, setProgress] = useState(0)
    const [isHashing, setIsHashing] = useState(false)
    const [result, setResult] = useState<FileHashResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const reset = () => {
        setFile(null)
        setProgress(0)
        setIsHashing(false)
        setResult(null)
        setError(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            reset()
            setFile(e.target.files[0])
            processFile(e.target.files[0])
        }
    }

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.dataTransfer.files?.[0]) {
            reset()
            const droppedFile = e.dataTransfer.files[0]
            setFile(droppedFile)
            processFile(droppedFile)
        }
    }, [])

    const processFile = async (file: File) => {
        setIsHashing(true)
        setError(null)

        const md5 = CryptoJS.algo.MD5.create()
        const sha1 = CryptoJS.algo.SHA1.create()
        const sha256 = CryptoJS.algo.SHA256.create()
        const sha512 = CryptoJS.algo.SHA512.create()

        let offset = 0
        const total = file.size

        const readChunk = () => {
            const reader = new FileReader()
            const slice = file.slice(offset, offset + CHUNK_SIZE)

            reader.onload = (e) => {
                if (e.target?.result) {
                    const arrayBuffer = e.target.result as ArrayBuffer
                    const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer)

                    md5.update(wordArray)
                    sha1.update(wordArray)
                    sha256.update(wordArray)
                    sha512.update(wordArray)

                    offset += arrayBuffer.byteLength
                    const currentProgress = Math.min((offset / total) * 100, 100)
                    setProgress(currentProgress)

                    if (offset < total) {
                        // Use setTimeout to allow UI updates
                        setTimeout(readChunk, 0)
                    } else {
                        setResult({
                            md5: md5.finalize().toString(),
                            sha1: sha1.finalize().toString(),
                            sha256: sha256.finalize().toString(),
                            sha512: sha512.finalize().toString(),
                        })
                        setIsHashing(false)
                    }
                }
            }

            reader.onerror = () => {
                setError("Error reading file")
                setIsHashing(false)
            }

            reader.readAsArrayBuffer(slice)
        }

        readChunk()
    }

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    return (
        <div className="space-y-6">
            {!file ? (
                <div
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center hover:bg-muted/50 transition-colors cursor-pointer"
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileSelect}
                    />
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">Drop a file here or click to select</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                        Files are hashed locally in your browser and never uploaded.
                    </p>
                </div>
            ) : (
                <div className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                                <File className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="font-medium truncate max-w-[300px]">{file.name}</p>
                                <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={reset} disabled={isHashing}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    {isHashing && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Processing...</span>
                                <span>{Math.round(progress)}%</span>
                            </div>
                            <Progress value={progress} />
                        </div>
                    )}

                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {result && (
                        <div className="grid gap-4 pt-2">
                            <HashResultRow label="MD5" hash={result.md5} />
                            <HashResultRow label="SHA-1" hash={result.sha1} />
                            <HashResultRow label="SHA-256" hash={result.sha256} />
                            <HashResultRow label="SHA-512" hash={result.sha512} />
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function HashResultRow({ label, hash }: { label: string; hash: string }) {
    const [copied, setCopied] = useState(false)

    const copy = () => {
        navigator.clipboard.writeText(hash)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">{label}</span>
                <div className="flex gap-2">
                    <a
                        href={`https://www.virustotal.com/gui/file/${hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-primary hover:underline"
                    >
                        VirusTotal
                    </a>
                    <a
                        href={`https://www.google.com/search?q=${hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-primary hover:underline"
                    >
                        Google
                    </a>
                </div>
            </div>
            <div className="flex gap-2">
                <code className="flex-1 p-2.5 rounded-md bg-muted font-mono text-xs break-all border">
                    {hash}
                </code>
                <Button variant="outline" size="icon" className="h-auto w-10 shrink-0" onClick={copy}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
            </div>
        </div>
    )
}
