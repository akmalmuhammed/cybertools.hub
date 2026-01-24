import { ToolTemplate } from "@/components/tools/ToolTemplate"

export default function PortCheckerTool() {
    const process = async (input: string) => {
        // Mock simulation
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Simulate some open/closed ports
        return `Scanning host: ${input}

PORT      STATE    SERVICE
21/tcp    closed   ftp
22/tcp    open     ssh
80/tcp    open     http
443/tcp   open     https
3306/tcp  closed   mysql
8080/tcp  filtered http-proxy

NOTE: This is a simulation. Real port scanning requires a backend server.`;
    }

    return (
        <ToolTemplate
            toolName="Port Checker"
            description="Check open ports on a target host (Demo Mode)."
            actionLabel="Scan Ports"
            placeholder="example.com"
            onProcess={process}
            examples={["example.com", "192.168.1.1", "localhost"]}
        />
    )
}
