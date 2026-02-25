import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { parseAndConvertColor } from "@/lib/utils/color"

export default function ColorConverterTool() {
    const process = (input: string) => {
        const result = parseAndConvertColor(input)
        return JSON.stringify(result)
    }

    const renderOutput = (output: string) => {
        if (!output) return null;
        let colors;
        try { colors = JSON.parse(output) } catch { return null }

        return (
            <div className="flex flex-col gap-6">
                <div
                    className="w-full h-32 rounded-lg border shadow-inner transition-colors"
                    style={{ backgroundColor: colors.hex }}
                />

                <div className="grid gap-4">
                    <div className="p-3 bg-muted rounded-md flex justify-between items-center">
                        <span className="font-bold text-sm text-muted-foreground">HEX</span>
                        <span className="font-mono">{colors.hex}</span>
                    </div>
                    <div className="p-3 bg-muted rounded-md flex justify-between items-center">
                        <span className="font-bold text-sm text-muted-foreground">RGB</span>
                        <span className="font-mono">{colors.rgbString}</span>
                    </div>
                    <div className="p-3 bg-muted rounded-md flex justify-between items-center">
                        <span className="font-bold text-sm text-muted-foreground">HSL</span>
                        <span className="font-mono">{colors.hslString}</span>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <ToolTemplate
            toolName="Color Converter"
            description="Convert HEX, RGB, and HSL color values."
            actionLabel="Convert"
            placeholder="#10B981 or rgb(16,185,129) or hsl(158,84%,39%)"
            onProcess={process}
            renderOutput={renderOutput}
            examples={["#10B981", "rgb(255, 87, 51)", "hsl(240, 100%, 50%)"]}
        />
    )
}
