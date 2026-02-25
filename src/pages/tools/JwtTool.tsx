import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { parseJWT } from "@/lib/utils/crypto"
import { CopyButton } from "@/components/features/CopyButton"

export default function JwtTool() {
    const process = (input: string) => {
        // Just validation here
        // We do parsing in renderOutput because we want structural output
        // But onProcess expects a string return.
        // simpler: parse here, stringify, then parse in renderOutput
        const parsed = parseJWT(input)
        return JSON.stringify(parsed)
    }

    const renderOutput = (output: string) => {
        if (!output) return null
        let data
        try {
            data = JSON.parse(output)
        } catch {
            return null
        }

        const { header, payload, signature } = data

        return (
            <div className="flex flex-col gap-4 overflow-y-auto max-h-[500px] pr-2">
                <div className="p-3 rounded-md border bg-muted/20 text-sm">
                    <div><span className="font-semibold">Algorithm:</span> {data.algorithm || "Unknown"}</div>
                    <div><span className="font-semibold">Type:</span> {data.tokenType || "Unknown"}</div>
                    <div className="text-amber-700 dark:text-amber-400">
                        <span className="font-semibold">Verification:</span> Signature not verified
                    </div>
                    {data.expiresAt && <div><span className="font-semibold">Expires:</span> {data.expiresAt}</div>}
                    {typeof data.expired === "boolean" && (
                        <div className={data.expired ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>
                            <span className="font-semibold">Token Status:</span> {data.expired ? "Expired" : "Not expired"}
                        </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                        {data.verificationNote}
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase">Header</h3>
                        <CopyButton text={JSON.stringify(header, null, 2)} />
                    </div>
                    <pre className="p-4 rounded-md bg-muted font-mono text-xs overflow-x-auto text-red-500">
                        {JSON.stringify(header, null, 2)}
                    </pre>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase">Payload</h3>
                        <CopyButton text={JSON.stringify(payload, null, 2)} />
                    </div>
                    <pre className="p-4 rounded-md bg-muted font-mono text-xs overflow-x-auto text-purple-500">
                        {JSON.stringify(payload, null, 2)}
                    </pre>
                </div>

                <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase">Signature</h3>
                    <div className="p-4 rounded-md bg-muted font-mono text-xs break-all text-blue-500">
                        {signature}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <ToolTemplate
            toolName="JWT Decoder"
            description="Decode JSON Web Tokens (JWT) to inspect header and payload."
            actionLabel="Decode"
            onProcess={process}
            renderOutput={renderOutput}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        />
    )
}
