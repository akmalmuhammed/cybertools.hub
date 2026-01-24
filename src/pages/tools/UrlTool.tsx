import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { encodeURL, decodeURL } from "@/lib/utils/encoders"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function UrlTool() {
    const [mode, setMode] = useState<"encode" | "decode">("encode")

    const process = (input: string) => {
        return mode === "encode" ? encodeURL(input) : decodeURL(input)
    }

    return (
        <ToolTemplate
            toolName="URL Encoder/Decoder"
            description="Encode and decode URLs to handle special characters safely."
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
                "https://example.com/search?q=hello world",
                "https%3A%2F%2Fexample.com%2Fsearch%3Fq%3Dhello%20world"
            ]}
        />
    )
}
