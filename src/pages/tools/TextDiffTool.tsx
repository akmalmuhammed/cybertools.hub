import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { diffText } from "@/lib/utils/text"
import type { Change } from "diff"

export default function TextDiffTool() {
    // Diff tool needs 2 inputs. ToolTemplate is 1 input.
    // We can use 'controls' for the second input?
    // Or modify ToolTemplate controls handling.
    // I'll put text2 in 'controls' via a Textarea component.

    // Actually, passing `text2` via state and updating it via controls is fine.

    // Wait, I need state for text2.
    // I can't easily add state to TextDiffTool without it being a component content.
    // It is a component.

    // Implementation details...
    return (
        <TextDiffToolInternal />
    )
}

import { useState } from "react"
import { Textarea } from "@/components/ui/textarea"

function TextDiffToolInternal() {
    const [text2, setText2] = useState("")

    const process = (input: string) => {
        const diffs = diffText(input, text2);
        return JSON.stringify(diffs);
    }

    const renderOutput = (output: string) => {
        if (!output) return null;
        let diffs: Change[];
        try {
            const parsed = JSON.parse(output) as unknown;
            if (!Array.isArray(parsed)) return null;
            diffs = parsed as Change[];
        } catch {
            return null;
        }

        return (
            <div className="bg-muted/50 p-4 rounded-md font-mono text-sm whitespace-pre-wrap border border-border min-h-[300px]">
                {diffs.map((part: Change, i: number) => {
                    const color = part.added ? 'bg-green-500/30 text-green-700 dark:text-green-400' :
                        part.removed ? 'bg-red-500/30 text-red-700 dark:text-red-400' :
                            'text-foreground';
                    return (
                        <span key={i} className={color}>
                            {part.value}
                        </span>
                    )
                })}
            </div>
        )
    }

    return (
        <ToolTemplate
            toolName="Text Diff"
            description="Compare two text snippets and highlight differences."
            actionLabel="Compare"
            placeholder="Original text..."
            controls={
                <div className="space-y-2 mb-4">
                    <label className="text-sm font-medium">Modified Text</label>
                    <Textarea
                        value={text2}
                        onChange={(e) => setText2(e.target.value)}
                        placeholder="Modified text..."
                        className="min-h-[150px] font-mono"
                    />
                </div>
            }
            onProcess={process}
            renderOutput={renderOutput}
        />
    )
}
