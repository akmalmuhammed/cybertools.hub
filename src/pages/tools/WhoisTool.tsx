import { ToolTemplate } from "@/components/tools/ToolTemplate"

export default function WhoisTool() {
    const process = async (input: string) => {
        // Mock simulation
        await new Promise(resolve => setTimeout(resolve, 1000));
        return `Domain Name: ${input.toUpperCase()}
Registry Domain ID: 123456789_DOMAIN_COM-VRSN
Registrar WHOIS Server: whois.example.com
Registrar URL: http://www.example.com
Updated Date: 2023-12-01T12:00:00Z
Creation Date: 2020-01-01T12:00:00Z
Registry Expiry Date: 2025-01-01T12:00:00Z
Registrar: Example Registrar, Inc.
Registrar IANA ID: 123
Registrar Abuse Contact Email: abuse@example.com
Registrar Abuse Contact Phone: +1.5555555555
Domain Status: clientTransferProhibited https://icann.org/epp#clientTransferProhibited
Name Server: NS1.EXAMPLE.COM
Name Server: NS2.EXAMPLE.COM

NOTE: Real WHOIS lookups require a backend server due to CORS restrictions. This is a simulation.`;
    }

    return (
        <ToolTemplate
            toolName="Whois Lookup"
            description="Retrieve WHOIS registration data for domains (Demo Mode)."
            actionLabel="Lookup"
            placeholder="example.com"
            onProcess={process}
        />
    )
}
