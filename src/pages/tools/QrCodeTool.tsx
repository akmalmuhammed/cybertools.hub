import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { QRCodeCanvas } from "qrcode.react"

export default function QrCodeTool() {
    const process = (input: string) => {
        return input // We rely on input state change to re-render output
    }

    const renderOutput = (output: string) => {
        if (!output) return null

        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4 bg-white p-8 rounded-lg">
                <QRCodeCanvas value={output} size={256} />
                <p className="text-sm text-muted-foreground mt-4">Scan with your mobile device</p>
            </div>
        )
    }

    return (
        <ToolTemplate
            toolName="QR Code Generator"
            description="Generate QR codes from text or URLs."
            actionLabel="Generate"
            placeholder="https://example.com"
            onProcess={process}
            renderOutput={renderOutput}
            examples={["https://google.com", "WIFI:S:MyNetwork;T:WPA;P:password;;"]}
        />
    )
}
