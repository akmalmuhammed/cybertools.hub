import {
  Activity,
  AppWindow,
  Network,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { TOOLS } from "@/lib/constants/tools";
import type { Tool } from "@/types/tool.types";

export type ToolDomainId = "soc" | "network" | "application" | "utility";

export interface ToolDomain {
  id: ToolDomainId;
  name: string;
  description: string;
  icon: LucideIcon;
  accentClass: string;
}

export const TOOL_DOMAINS: ToolDomain[] = [
  {
    id: "soc",
    name: "SOC & Threat Intel",
    description: "Detection engineering, triage, and threat intelligence workflows.",
    icon: Activity,
    accentClass: "text-emerald-300 bg-emerald-500/15 border-emerald-400/30",
  },
  {
    id: "network",
    name: "Network Security",
    description: "Infrastructure analysis, DNS/IP intelligence, and exposure mapping.",
    icon: Network,
    accentClass: "text-cyan-300 bg-cyan-500/15 border-cyan-400/30",
  },
  {
    id: "application",
    name: "Application Security",
    description: "Identity, token validation, and browser security hardening tools.",
    icon: AppWindow,
    accentClass: "text-amber-300 bg-amber-500/15 border-amber-400/30",
  },
  {
    id: "utility",
    name: "Utility & Data Ops",
    description: "Everyday parsing, transformation, and engineering helper utilities.",
    icon: Wrench,
    accentClass: "text-violet-300 bg-violet-500/15 border-violet-400/30",
  },
];

const DOMAIN_TOOL_IDS: Record<ToolDomainId, string[]> = {
  soc: [
    "email",
    "ioc",
    "ioc-correlator",
    "ioc-normalizer",
    "stix-taxii",
    "cve-prioritizer",
    "reputation",
    "domain-spoof",
    "secrets-scanner",
    "sigma-helper",
    "yara-local",
    "sbom-diff",
  ],
  network: [
    "dns-toolkit",
    "whois",
    "iplookup",
    "port",
    "subnet",
    "certificate",
    "url-defang",
    "user-agent",
  ],
  application: [
    "jwt",
    "jwt-verify",
    "http-headers",
    "security-header-builder",
    "hash",
    "password",
  ],
  utility: [
    "base64",
    "json",
    "url",
    "timestamp",
    "regex",
    "diff",
    "qrcode",
    "color",
    "uuid",
    "markdown",
    "html",
  ],
};

const toolById = new Map<string, Tool>(TOOLS.map((tool) => [tool.id, tool]));

export function isToolDomainId(value: string | null | undefined): value is ToolDomainId {
  return value === "soc" || value === "network" || value === "application" || value === "utility";
}

export function getDomainById(domainId: ToolDomainId): ToolDomain {
  const found = TOOL_DOMAINS.find((domain) => domain.id === domainId);
  return found ?? TOOL_DOMAINS[0];
}

function getExplicitDomain(toolId: string): ToolDomainId | null {
  const found = (Object.keys(DOMAIN_TOOL_IDS) as ToolDomainId[]).find((domainId) =>
    DOMAIN_TOOL_IDS[domainId].includes(toolId),
  );
  return found ?? null;
}

function categoryFallbackDomain(tool: Tool): ToolDomainId {
  if (tool.category === "network") return "network";
  if (tool.category === "application") return "application";
  if (tool.category === "security") return "soc";
  return "utility";
}

export function getToolDomainId(toolId: string): ToolDomainId {
  const explicit = getExplicitDomain(toolId);
  if (explicit) return explicit;

  const tool = toolById.get(toolId);
  if (!tool) return "utility";
  return categoryFallbackDomain(tool);
}

export function getToolsForDomain(domainId: ToolDomainId): Tool[] {
  return TOOLS.filter((tool) => getToolDomainId(tool.id) === domainId);
}

export function getDomainCounts(): Record<ToolDomainId, number> {
  return {
    soc: getToolsForDomain("soc").length,
    network: getToolsForDomain("network").length,
    application: getToolsForDomain("application").length,
    utility: getToolsForDomain("utility").length,
  };
}

export function findToolByPath(pathname: string): Tool | null {
  return TOOLS.find((tool) => tool.path === pathname) ?? null;
}
