import { ToolTemplate } from "@/components/tools/ToolTemplate"

export default function ColorConverterTool() {
    const process = (input: string) => {
        // Basic HEX to RGB/HSL converter logic
        let hex = input.replace('#', '');
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }

        if (!/^[0-9A-Fa-f]{6}$/.test(hex)) throw new Error("Invalid HEX color");

        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        // RGB to HSL
        let r_ = r / 255, g_ = g / 255, b_ = b / 255;
        let max = Math.max(r_, g_, b_), min = Math.min(r_, g_, b_);
        let h = 0, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0; // achromatic
        } else {
            let d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r_: h = (g_ - b_) / d + (g_ < b_ ? 6 : 0); break;
                case g_: h = (b_ - r_) / d + 2; break;
                case b_: h = (r_ - g_) / d + 4; break;
            }
            h /= 6;
        }

        h = Math.round(h * 360);
        s = Math.round(s * 100);
        l = Math.round(l * 100);

        return JSON.stringify({
            hex: `#${hex.toUpperCase()}`,
            rgb: `rgb(${r}, ${g}, ${b})`,
            hsl: `hsl(${h}, ${s}%, ${l}%)`
        });
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
                        <span className="font-mono">{colors.rgb}</span>
                    </div>
                    <div className="p-3 bg-muted rounded-md flex justify-between items-center">
                        <span className="font-bold text-sm text-muted-foreground">HSL</span>
                        <span className="font-mono">{colors.hsl}</span>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <ToolTemplate
            toolName="Color Converter"
            description="Convert HEX colors to RGB and HSL values."
            actionLabel="Convert"
            placeholder="#10B981"
            onProcess={process}
            renderOutput={renderOutput}
            examples={["#10B981", "#FF5733", "#000000"]}
        />
    )
}
