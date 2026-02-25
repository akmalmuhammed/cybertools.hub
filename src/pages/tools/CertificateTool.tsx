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
                    <div className="p-2 border rounded bg-muted/20">
                        <span className="block text-xs font-bold text-muted-foreground uppercase">Validity</span>
                        <span className="break-all font-mono text-sm">
                            {info.validFrom} → {info.validTo}
                        </span>
                    </div>
                    <div className="p-2 border rounded bg-muted/20">
                        <span className="block text-xs font-bold text-muted-foreground uppercase">Serial Number</span>
                        <span className="break-all font-mono text-sm">{info.serialNumber}</span>
                    </div>
                    {info.fingerprintSha256 && (
                        <div className="p-2 border rounded bg-muted/20">
                            <span className="block text-xs font-bold text-muted-foreground uppercase">SHA-256 Fingerprint</span>
                            <span className="break-all font-mono text-sm">{info.fingerprintSha256}</span>
                        </div>
                    )}
                </div>

                {Array.isArray(info.notes) && info.notes.length > 0 && (
                    <div className="p-3 border rounded bg-muted/20">
                        <h3 className="text-sm font-semibold mb-2">Notes</h3>
                        <ul className="text-sm text-muted-foreground space-y-1">
                            {info.notes.map((note: string, idx: number) => (
                                <li key={idx}>• {note}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        )
    }

    return (
        <ToolTemplate
            toolName="Certificate Decoder"
            description="Parse certificate text fields and derive SHA-256 fingerprint from PEM."
            actionLabel="Decode"
            placeholder="-----BEGIN CERTIFICATE-----..."
            onProcess={process}
            renderOutput={renderOutput}
            examples={[
                "-----BEGIN CERTIFICATE-----\nMIIB...==\n-----END CERTIFICATE-----",
                "Issuer: CN=Example CA\nSubject: CN=api.example.com\nNot Before: Jan 1 00:00:00 2025 GMT\nNot After : Jan 1 00:00:00 2027 GMT",
            ]}
        />
    )
}
