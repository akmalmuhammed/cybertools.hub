import { useState, useMemo } from 'react'
import ReactJson from 'react-json-view'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface JsonTreeProps {
    data: object
}

// Recursive filter function
const filterJson = (data: any, searchTerm: string): any => {
    if (!searchTerm) return data

    const lowerTerm = searchTerm.toLowerCase()

    if (typeof data === 'string') {
        return data.toLowerCase().includes(lowerTerm) ? data : undefined
    }

    if (typeof data === 'number' || typeof data === 'boolean') {
        return String(data).toLowerCase().includes(lowerTerm) ? data : undefined
    }

    if (Array.isArray(data)) {
        const filtered = data
            .map(item => filterJson(item, searchTerm))
            .filter(item => item !== undefined)
        return filtered.length > 0 ? filtered : undefined
    }

    if (typeof data === 'object' && data !== null) {
        const filtered: any = {}
        let hasMatch = false

        Object.keys(data).forEach(key => {
            // Check if key matches
            if (key.toLowerCase().includes(lowerTerm)) {
                filtered[key] = data[key]
                hasMatch = true
            } else {
                // Check if value matches (recursive)
                const filteredValue = filterJson(data[key], searchTerm)
                if (filteredValue !== undefined) {
                    filtered[key] = filteredValue
                    hasMatch = true
                }
            }
        })

        return hasMatch ? filtered : undefined
    }

    return undefined
}


export function JsonTree({ data }: JsonTreeProps) {
    const [searchTerm, setSearchTerm] = useState('')

    const [selectedPath, setSelectedPath] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    // Detect dark mode roughly or pass it in. For now, let's assume default theme or explicit prop.
    // Ideally, we check document.documentElement.classList.contains('dark')
    const isDark = document.documentElement.classList.contains('dark')

    const filteredData = useMemo(() => {
        if (!searchTerm) return data
        const result = filterJson(data, searchTerm)
        return result === undefined ? {} : result
    }, [data, searchTerm])

    const handleSelect = (select: any) => {
        // Construct path
        // select.namespace is an array of keys/indexes leading to the parent
        // select.name is the key of the selected item
        const pathSegments = [...select.namespace, select.name]
        let path = '$'

        pathSegments.forEach(segment => {
            if (typeof segment === 'number') {
                path += `[${segment}]`
            } else if (typeof segment === 'string' && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(segment)) {
                path += `.${segment}`
            } else if (typeof segment === 'string') {
                path += `["${segment}"]`
            }
        })

        setSelectedPath(path)
        setCopied(false)
    }

    const copyPath = () => {
        if (selectedPath) {
            navigator.clipboard.writeText(selectedPath)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    return (
        <div className="flex flex-col h-full gap-4">
            <div className="flex items-center space-x-2">
                <Label htmlFor="json-search" className="sr-only">Search JSON</Label>
                <Input
                    id="json-search"
                    placeholder="Search keys or values..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                />

                {selectedPath && (
                    <div className="flex-1 flex items-center justify-end gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1 rounded-md overflow-hidden">
                        <span className="truncate font-mono" title={selectedPath}>{selectedPath}</span>
                        <button
                            onClick={copyPath}
                            className="text-primary hover:text-primary/80 transition-colors p-1"
                            title="Copy Path"
                        >
                            {copied ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                            )}
                        </button>
                    </div>
                )}
            </div>

            <div className="border rounded-md bg-card p-4 h-full overflow-auto max-h-[600px] text-sm">
                <ReactJson
                    src={filteredData}
                    theme={isDark ? "google" : "rjv-default"}
                    iconStyle="triangle"
                    collapsed={searchTerm ? false : 2} // Expand all when searching
                    enableClipboard={true}
                    displayDataTypes={false}
                    displayObjectSize={true}
                    onEdit={false}
                    onAdd={false}
                    onDelete={false}
                    onSelect={handleSelect}
                    style={{ backgroundColor: 'transparent' }}
                />
            </div>
        </div>
    )
}
