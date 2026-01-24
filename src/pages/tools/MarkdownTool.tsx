import { ToolTemplate } from "@/components/tools/ToolTemplate"
import ReactMarkdown from 'react-markdown'

export default function MarkdownTool() {
    const process = (input: string) => {
        return input // Just pass through for rendering
    }

    const renderOutput = (output: string) => {
        if (!output) return null

        return (
            <div className="prose dark:prose-invert max-w-none p-4 overflow-y-auto max-h-[500px] border rounded-md">
                <ReactMarkdown>{output}</ReactMarkdown>
            </div>
        )
    }

    return (
        <ToolTemplate
            toolName="Markdown Preview"
            description="Live preview for Markdown text."
            actionLabel="Preview"
            placeholder="# Hello World\n\n**Bold text** and *italic*."
            onProcess={process}
            renderOutput={renderOutput}
            examples={["# Title\n\nBody text with [link](https://example.com)."]}
        />
    )
}
