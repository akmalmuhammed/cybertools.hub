import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import { calculateSubnet, type SubnetInfo } from "@/lib/utils/network"
import { CopyButton } from "@/components/features/CopyButton"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

type IpClass = "private" | "public" | "loopback" | "link-local" | "multicast" | "reserved"

function parseIpAndCidr(input: string): { ip: string; cidr: number } {
  const [ipPart, cidrPart] = input.split("/")
  const ip = ipPart.trim()
  const cidr = cidrPart ? Number(cidrPart.trim()) : 24
  return { ip, cidr: Number.isFinite(cidr) ? cidr : 24 }
}

function classifyIpv4(ip: string): IpClass {
  const octets = ip.split(".").map((value) => Number(value))
  if (octets.length !== 4 || octets.some((value) => Number.isNaN(value))) return "reserved"

  const [a, b] = octets
  if (a === 10) return "private"
  if (a === 172 && b >= 16 && b <= 31) return "private"
  if (a === 192 && b === 168) return "private"
  if (a === 127) return "loopback"
  if (a === 169 && b === 254) return "link-local"
  if (a >= 224 && a <= 239) return "multicast"
  if (a === 0 || a >= 240) return "reserved"
  return "public"
}

function isBoundaryAddress(info: SubnetInfo): boolean {
  return info.ip === info.networkAddress || info.ip === info.broadcastAddress
}

export default function SubnetTool() {
  const [minimumCidr, setMinimumCidr] = useState("16")
  const [maximumUsableHosts, setMaximumUsableHosts] = useState("65534")
  const [requirePrivateSpace, setRequirePrivateSpace] = useState(true)
  const [blockSpecialRanges, setBlockSpecialRanges] = useState(true)
  const [requireUsableHostInput, setRequireUsableHostInput] = useState(true)

  const process = (input: string) => {
    const { ip, cidr } = parseIpAndCidr(input)
    const info = calculateSubnet(ip, cidr)
    const ipClass = classifyIpv4(info.ip)

    const cidrFloor = Math.max(0, Math.min(32, Number(minimumCidr) || 16))
    const hostLimit = Math.max(1, Number(maximumUsableHosts) || 65534)

    const findings: ToolFinding[] = []

    if (requirePrivateSpace && ipClass === "public") {
      findings.push({
        id: "subnet-public-space-disallowed",
        severity: "high",
        confidence: 90,
        category: "network-governance",
        title: "Public IP space violates private-only policy",
        description: `Input IP ${info.ip} is in public address space while private-only policy is enabled.`,
        remediation: "Use RFC1918 ranges for internal segmentation planning workflows.",
      })
    }

    if (blockSpecialRanges && (ipClass === "loopback" || ipClass === "link-local" || ipClass === "multicast" || ipClass === "reserved")) {
      findings.push({
        id: "subnet-special-range-blocked",
        severity: "medium",
        confidence: 84,
        category: "network-governance",
        title: "Special-use IP range detected",
        description: `Address class ${ipClass} is not approved for this subnet planning policy.`,
        remediation: "Use routable private address ranges unless testing special-case behavior explicitly.",
      })
    }

    if (info.cidr < cidrFloor) {
      findings.push({
        id: "subnet-too-broad",
        severity: info.cidr < Math.max(0, cidrFloor - 4) ? "high" : "medium",
        confidence: 82,
        category: "blast-radius",
        title: "CIDR network scope exceeds policy",
        description: `CIDR /${info.cidr} is broader than minimum allowed /${cidrFloor}.`,
        remediation: "Use smaller network segments to reduce blast radius and simplify monitoring.",
      })
    }

    if (info.usableHosts > hostLimit) {
      findings.push({
        id: "subnet-host-capacity-over-limit",
        severity: "medium",
        confidence: 80,
        category: "capacity-governance",
        title: "Usable host count exceeds policy cap",
        description: `Subnet exposes ${info.usableHosts.toLocaleString()} usable hosts; limit is ${hostLimit.toLocaleString()}.`,
        remediation: "Split into multiple smaller subnets aligned to trust boundaries.",
      })
    }

    if (requireUsableHostInput && info.cidr <= 30 && isBoundaryAddress(info)) {
      findings.push({
        id: "subnet-boundary-host-input",
        severity: "low",
        confidence: 72,
        category: "address-quality",
        title: "Input IP is a network or broadcast boundary",
        description: "Input host equals network/broadcast boundary for this CIDR and may not be assignable.",
        remediation: "Choose an IP within the usable host range for endpoint planning.",
      })
    }

    if (findings.length === 0) {
      findings.push({
        id: "subnet-policy-pass",
        severity: "info",
        confidence: 71,
        category: "network-governance",
        title: "Subnet configuration meets policy",
        description: "Subnet details satisfy configured CIDR, host-capacity, and address-class constraints.",
        remediation: "Document subnet ownership and enforce ACL controls per segment.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "Subnet analysis completed",
      text: `Calculated /${info.cidr} network with ${info.usableHosts.toLocaleString()} usable hosts.`,
      findings,
      metrics: {
        cidr: info.cidr,
        totalHosts: info.totalHosts,
        usableHosts: info.usableHosts,
      },
      baseScore: 99,
    })

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "Subnet Calculator",
        summary,
        findings,
        evidence: [
          {
            ip: info.ip,
            cidr: info.cidr,
            networkAddress: info.networkAddress,
            broadcastAddress: info.broadcastAddress,
            firstHost: info.firstHost,
            lastHost: info.lastHost,
            usableHosts: info.usableHosts,
            ipClass,
          },
        ],
        recommendations: [
          "Use smaller CIDR blocks to limit blast radius and simplify segmentation governance.",
          "Avoid assigning network/broadcast boundaries to endpoint assets.",
          "Align subnet scope with trust zones and firewall policy boundaries.",
        ],
        raw: {
          info,
          ipClass,
          config: {
            cidrFloor,
            hostLimit,
            requirePrivateSpace,
            blockSpecialRanges,
            requireUsableHostInput,
          },
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null

    const envelope = parseToolResultEnvelope(output, "Subnet Calculator")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null

    const info = raw?.info as SubnetInfo | undefined
    const ipClass = typeof raw?.ipClass === "string" ? raw.ipClass : "unknown"
    if (!info) return null

    const rows = [
      { label: "IP Address", value: info.ip },
      { label: "IP Class", value: ipClass },
      { label: "Network Address", value: info.networkAddress },
      { label: "Usable Host Range", value: `${info.firstHost} - ${info.lastHost}` },
      { label: "Broadcast Address", value: info.broadcastAddress },
      { label: "Total Hosts", value: info.totalHosts.toLocaleString() },
      { label: "Usable Hosts", value: info.usableHosts.toLocaleString() },
      { label: "Subnet Mask", value: info.netmask },
      { label: "CIDR Notation", value: `/${info.cidr}` },
    ]

    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rows.map((row) => (
            <div key={row.label} className="p-4 rounded-lg bg-muted/50 border border-border">
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">{row.label}</div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm break-all">{row.value}</span>
                <CopyButton text={row.value.toString()} className="h-6 w-6" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <ToolTemplate
      toolName="Subnet Calculator"
      description="Enterprise subnet planning with CIDR guardrails, address-class policy checks, and segmentation governance findings."
      actionLabel="Calculate"
      onProcess={process}
      renderOutput={renderOutput}
      placeholder="192.168.1.10/24"
      controls={
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Minimum CIDR allowed (e.g., 16)</Label>
              <Input value={minimumCidr} onChange={(event) => setMinimumCidr(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Maximum usable hosts</Label>
              <Input value={maximumUsableHosts} onChange={(event) => setMaximumUsableHosts(event.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="subnet-private-only">Require private IP space</Label>
              <Switch
                id="subnet-private-only"
                checked={requirePrivateSpace}
                onChange={(event) => setRequirePrivateSpace(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="subnet-block-special">Block loopback/link-local/multicast/reserved ranges</Label>
              <Switch
                id="subnet-block-special"
                checked={blockSpecialRanges}
                onChange={(event) => setBlockSpecialRanges(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="subnet-require-usable">Require input IP to be a usable host</Label>
              <Switch
                id="subnet-require-usable"
                checked={requireUsableHostInput}
                onChange={(event) => setRequireUsableHostInput(event.target.checked)}
              />
            </div>
          </div>
        </div>
      }
      examples={[
        "192.168.0.10/24",
        "10.20.30.40/20",
        "172.16.100.10/26",
      ]}
    />
  )
}
