import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { parseCertificate } from "@/lib/utils/crypto"

export default function CertificateTool() {
    const process = (input: string) => {
        const info = parseCertificate(input);
        return JSON.stringify(info);
    }

    const renderOutput = (output: string) => {
        if (!output) return null
        let info
        try { info = JSON.parse(output) } catch { return null }

        return (
            <div className="flex flex-col gap-4">
                <div className="grid gap-2">
                    <div className="p-2 border rounded bg-muted/20">
                        <span className="block text-xs font-bold text-muted-foreground uppercase">Subject</span>
                        <span className="break-all font-mono text-sm">{info.subject}</span>
                    </div>
                    <div className="p-2 border rounded bg-muted/20">
                        <span className="block text-xs font-bold text-muted-foreground uppercase">Issuer</span>
                        <span className="break-all font-mono text-sm">{info.issuer}</span>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <ToolTemplate
            toolName="Certificate Decoder"
            description="Parse PEM encoded SSL/TLS certificates."
            actionLabel="Decode"
            placeholder="-----BEGIN CERTIFICATE-----..."
            onProcess={process}
            renderOutput={renderOutput}
        />
    )
}
