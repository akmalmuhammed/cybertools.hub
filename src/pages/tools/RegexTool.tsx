import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"

export default function RegexTool() {
    const [pattern, setPattern] = useState("")
    const [flags, setFlags] = useState("g")

    const process = (input: string) => {
        // We don't change default output, we custom render
        if (!pattern) throw new Error("Please enter a regex pattern")
        return input // We pass input to render for highlighting
    }

    const renderOutput = (output: string) => {
        if (!pattern) return null


        try {
            new RegExp(pattern, flags)
        } catch {
            return <div className="text-destructive">Invalid Regex Pattern</div>
        }

        const parts = []
        let lastIndex = 0
        let match

        // We need to re-create regex with 'g' to iterate if not present, but user controls flags.
        // However, for highlighting all matches, we assume global usually, or just finding first.
        // Let's force 'g' for display iteration if user didn't add it?
        // Actually `exec` loop works best if 'g' is set.
        const displayRegex = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g')

        // Dangerous loop if empty match
        // Prevent infinite loop
        let safety = 0
        while ((match = displayRegex.exec(output)) !== null && safety < 1000) {
            safety++
            // Text before match
            if (match.index > lastIndex) {
                parts.push(<span key={lastIndex}>{output.substring(lastIndex, match.index)}</span>)
            }
            // Match
            parts.push(
                <span key={match.index} className="bg-yellow-500/30 text-yellow-500 font-bold rounded px-0.5 border border-yellow-500/50">
                    {match[0]}
                </span>
            )
            lastIndex = displayRegex.lastIndex

            if (match[0].length === 0) {
                displayRegex.lastIndex++ // avoid infinite loop on zero-length match
            }
        }
        // Remaining text
        if (lastIndex < output.length) {
            parts.push(<span key={lastIndex}>{output.substring(lastIndex)}</span>)
        }

        // Matches list?
        const matches = output.match(new RegExp(pattern, flags)) || []

        return (
            <div className="flex flex-col gap-4 h-full">
                <div className="p-4 rounded-md bg-muted/50 font-mono text-sm whitespace-pre-wrap break-all min-h-[200px] border border-border">
                    {parts.length > 0 ? parts : output}
                </div>
                <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
                    Found {matches.length} matches.
                </div>
            </div>
        )
    }

    return (
        <ToolTemplate
            toolName="Regex Tester"
            description="Test regular expressions with real-time highlighting."
            actionLabel="Test Matches"
            examples={["\\d+", "[a-z]+", "\\w+@\\w+\\.\\w+"]}
            initialInput="Hello 123 World 456"
            controls={
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={pattern}
                            onChange={e => setPattern(e.target.value)}
                            placeholder="Pattern (e.g. \d+)"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <input
                            type="text"
                            value={flags}
                            onChange={e => setFlags(e.target.value)}
                            placeholder="Flags (e.g. gmi)"
                            className="flex h-10 w-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                    </div>
                </div>
            }
            onProcess={process}
            renderOutput={renderOutput}
        />
    )
}
