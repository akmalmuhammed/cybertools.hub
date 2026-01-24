import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { unixToDate, dateToUnix, getCurrentUnix } from "@/lib/utils/time"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function TimestampTool() {
    const [mode, setMode] = useState<"auto" | "unix2date" | "date2unix">("auto")

    const process = (input: string) => {
        const trimmed = input.trim()

        // Auto-detection logic
        if (mode === "auto") {
            if (/^\d{1,13}$/.test(trimmed)) {
                // Likely a timestamp
                const ts = parseInt(trimmed, 10)
                return unixToDate(ts)
            } else {
                // Assume date string
                const ts = dateToUnix(trimmed)
                if (ts === 0) throw new Error("Invalid date format")
                return ts.toString()
            }
        }

        if (mode === "unix2date") {
            const ts = parseInt(trimmed, 10)
            if (isNaN(ts)) throw new Error("Invalid timestamp")
            return unixToDate(ts)
        }

        if (mode === "date2unix") {
            const ts = dateToUnix(trimmed)
            if (ts === 0) throw new Error("Invalid date format")
            return ts.toString()
        }

        return ""
    }

    return (
        <ToolTemplate
            toolName="Unix Timestamp Converter"
            description="Convert between Unix timestamps and integer dates. Supports various formats."
            actionLabel="Convert"
            controls={
                <div className="flex items-center gap-4">
                    <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-[300px]">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="auto">Auto</TabsTrigger>
                            <TabsTrigger value="unix2date">Unix to Date</TabsTrigger>
                            <TabsTrigger value="date2unix">Date to Unix</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            }
            onProcess={process}
            examples={[
                getCurrentUnix().toString(),
                "2023-01-01 12:00:00",
                "1672531200"
            ]}
        />
    )
}
