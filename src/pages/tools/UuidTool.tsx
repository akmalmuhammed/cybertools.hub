import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { generateUUID } from "@/lib/utils/crypto"


export default function UuidTool() {
    const process = () => {
        return generateUUID()
    }

    const renderOutput = (output: string) => {
        if (!output) return null

        return (
            <div className="flex flex-col justify-center items-center h-full gap-4">
                <div className="text-3xl font-mono font-bold text-primary break-all text-center p-4">
                    {output}
                </div>
                <p className="text-muted-foreground">UUID v4 (Random)</p>
            </div>
        )
    }

    return (
        <ToolTemplate
            toolName="UUID Generator"
            description="Generate standard UUID v4 identifiers."
            actionLabel="Generate New UUID"
            placeholder="Click Generate to create a new UUID"
            onProcess={process}
            renderOutput={renderOutput}
        />
    )
}
