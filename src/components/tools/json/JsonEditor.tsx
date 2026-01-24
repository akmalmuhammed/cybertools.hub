
import Editor from 'react-simple-code-editor'
import Prism from 'prismjs'
import 'prismjs/components/prism-json'
import 'prismjs/themes/prism.css' // We might need to customize this or use a different theme

interface JsonEditorProps {
    value: string
    onChange: (value: string) => void
    errorLine?: number | null
}

export function JsonEditor({ value, onChange, errorLine }: JsonEditorProps) {
    // Simple highlight function using Prism
    const highlight = (code: string) => (
        Prism.highlight(code, Prism.languages.json, 'json')
            .split('\n')
            .map((line, i) => {
                const lineNumber = i + 1
                const isError = errorLine === lineNumber
                return `<span class="line-number text-muted-foreground select-none pr-4 text-right w-8 inline-block text-xs opacity-50">${lineNumber}</span><span class="${isError ? 'bg-destructive/20 w-full inline-block rounded-sm' : ''}">${line}</span>`
            })
            .join('\n')
    )

    return (
        <div className="font-mono text-sm border rounded-md bg-muted/30 max-h-[600px] overflow-auto relative">
            <style>{`
                .prism-editor textarea { outline: none !important; }
            `}</style>
            <Editor
                value={value}
                onValueChange={onChange}
                highlight={highlight}
                padding={16}
                className="prism-editor min-h-[400px]"
                textareaClassName="focus:outline-none"
                style={{
                    fontFamily: '"Fira code", "Fira Mono", monospace',
                    fontSize: 14,
                    backgroundColor: 'transparent',
                }}
            />
        </div>
    )
}
