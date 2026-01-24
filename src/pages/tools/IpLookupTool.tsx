import { ToolTemplate } from "@/components/tools/ToolTemplate"

export default function IpLookupTool() {
    const process = async (input: string) => {
        try {
            const response = await fetch(`https://ipapi.co/${input}/json/`);
            if (!response.ok) throw new Error("Failed to fetch IP data");
            const data = await response.json();
            return JSON.stringify(data, null, 2);
        } catch (e) {
            throw new Error("Could not fetch IP info (likely blocked by browser/CORS or rate limited).");
        }
    }

    return (
        <ToolTemplate
            toolName="IP Lookup"
            description="Get geolocation and network info for an IP address."
            actionLabel="Lookup"
            placeholder="8.8.8.8"
            onProcess={process}
        />
    )
}
