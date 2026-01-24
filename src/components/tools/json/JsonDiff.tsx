import { useEffect, useRef, useState } from 'react'
import * as jsondiffpatch from 'jsondiffpatch'
import './jsondiffpatch.css'
import { Label } from '@/components/ui/label'
import { JsonEditor } from './JsonEditor'


interface JsonDiffProps {
    initialLeft?: string
    initialRight?: string
}

export function JsonDiff({ initialLeft = '{}', initialRight = '{}' }: JsonDiffProps) {
    const [leftInput, setLeftInput] = useState(initialLeft)
    const [rightInput, setRightInput] = useState(initialRight)
    const [leftJson, setLeftJson] = useState<any>(null)
    const [rightJson, setRightJson] = useState<any>(null)
    const [leftError, setLeftError] = useState<string | null>(null)
    const [rightError, setRightError] = useState<string | null>(null)
    const diffContainerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        try {
            setLeftJson(JSON.parse(leftInput))
            setLeftError(null)
        } catch (e) {
            setLeftJson(null)
            setLeftError("Invalid JSON")
        }
    }, [leftInput])

    useEffect(() => {
        try {
            setRightJson(JSON.parse(rightInput))
            setRightError(null)
        } catch (e) {
            setRightJson(null)
            setRightError("Invalid JSON")
        }
    }, [rightInput])

    useEffect(() => {
        if (!diffContainerRef.current) return
        diffContainerRef.current.innerHTML = ''

        if (leftJson && rightJson) {
            const instance = jsondiffpatch.create({
                objectHash: function (obj: any) {
                    // Try to identify objects by ID or Name if possible, else default
                    return obj._id || obj.id || obj.name || JSON.stringify(obj);
                }
            });
            const delta = instance.diff(leftJson, rightJson)

            if (delta) {
                // @ts-ignore - formatting is available in browser build
                const html = jsondiffpatch.formatters.html.format(delta, leftJson)
                diffContainerRef.current.innerHTML = html
            } else {
                diffContainerRef.current.innerHTML = '<div class="p-4 text-muted-foreground">No differences found. Objects are identical.</div>'
            }
        }
    }, [leftJson, rightJson])

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="grid grid-cols-2 gap-4 h-1/3 min-h-[200px]">
                <div className="flex flex-col gap-2 relative">
                    <Label>Original (Left)</Label>
                    <div className="flex-1 border rounded-md overflow-hidden relative">
                        <JsonEditor value={leftInput} onChange={setLeftInput} />
                        {leftError && <div className="absolute bottom-2 left-2 text-xs text-destructive bg-background/80 px-2 py-1 rounded">{leftError}</div>}
                    </div>
                </div>
                <div className="flex flex-col gap-2 relative">
                    <Label>Modified (Right)</Label>
                    <div className="flex-1 border rounded-md overflow-hidden relative">
                        <JsonEditor value={rightInput} onChange={setRightInput} />
                        {rightError && <div className="absolute bottom-2 left-2 text-xs text-destructive bg-background/80 px-2 py-1 rounded">{rightError}</div>}
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col gap-2 min-h-0">
                <Label>Structural Diff</Label>
                <div className="border rounded-md bg-white dark:bg-black/20 p-4 flex-1 overflow-auto">
                    <div ref={diffContainerRef} className="jsondiffpatch-visualizer" />
                </div>
            </div>

            <style>{`
                .jsondiffpatch-delta pre { font-family: monospace; }
                .jsondiffpatch-visualizer { font-size: 14px; }
                .dark .jsondiffpatch-unchanged { color: #888; }
                .dark .jsondiffpatch-added .jsondiffpatch-value { background: rgba(0, 255, 0, 0.2); border: 1px solid rgba(0, 255, 0, 0.3); }
                .dark .jsondiffpatch-deleted .jsondiffpatch-value { background: rgba(255, 0, 0, 0.2); text-decoration: line-through; border: 1px solid rgba(255, 0, 0, 0.3); }
                .dark .jsondiffpatch-modified .jsondiffpatch-left-value { background: rgba(255, 0, 0, 0.2); }
                .dark .jsondiffpatch-modified .jsondiffpatch-right-value { background: rgba(0, 255, 0, 0.2); }
             `}</style>
        </div>
    )
}
