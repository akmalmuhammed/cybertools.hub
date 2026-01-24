import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { encodeHTML, decodeHTML } from "@/lib/utils/encoders"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function HtmlEncoderTool() {
    const [mode, setMode] = useState<"encode" | "decode">("encode")

    const process = (input: string) => {
        return mode === "encode" ? encodeHTML(input) : decodeHTML(input)
    }

    return (
        <ToolTemplate
            toolName="HTML Encoder"
            description="Encode and decode HTML entities to prevent XSS."
            actionLabel={mode === "encode" ? "Encode" : "Decode"}
            controls={
                <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-[200px]">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="encode">Encode</TabsTrigger>
                        <TabsTrigger value="decode">Decode</TabsTrigger>
                    </TabsList>
                </Tabs>
            }
            onProcess={process}
            examples={[
                "<script>alert('xss')</script>",
                "&lt;div&gt;Hello&lt;/div&gt;"
            ]}
        />
    )
}
