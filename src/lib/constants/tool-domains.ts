import {
  Bug,
  Bot,
  CloudCog,
  Fingerprint,
  Satellite,
  Swords,
  Network,
  PackageSearch,
  Radar,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { TOOLS } from "@/lib/constants/tools";
import type { Tool, ToolDomainId } from "@/types/tool.types";
export type { ToolDomainId } from "@/types/tool.types";

export interface ToolDomain {
  id: ToolDomainId;
  slug: string;
  name: string;
  description: string;
  privacyNotice: string;
  icon: LucideIcon;
  accentClass: string;
}

export const TOOL_DOMAINS: ToolDomain[] = [
  {
    id: "soc",
    slug: "soc-detection-engineering",
    name: "SOC & Detection Engineering",
    description: "Alert triage speed, rule quality, and incident response workflow acceleration.",
    privacyNotice: "Mostly local analytics; optional enrichment is explicitly gated.",
    icon: ShieldAlert,
    accentClass: "text-emerald-700 dark:text-emerald-300 bg-emerald-500/12 border-emerald-500/30",
  },
  {
    id: "threat-intel",
    slug: "threat-intel-dfir",
    name: "Threat Intel & DFIR",
    description: "IOC quality scoring, exchange format normalization, and forensic packaging.",
    privacyNotice: "Intel normalization runs local-first with optional external context lookups.",
    icon: Radar,
    accentClass: "text-cyan-700 dark:text-cyan-300 bg-cyan-500/12 border-cyan-500/30",
  },
  {
    id: "network",
    slug: "network-exposure-security",
    name: "Network & Exposure Security",
    description: "Exposure import normalization, ACL conflict detection, and TLS risk analysis.",
    privacyNotice: "Analysis is local by default; probes are network-labeled before execution.",
    icon: Network,
    accentClass: "text-blue-700 dark:text-blue-300 bg-blue-500/12 border-blue-500/30",
  },
  {
    id: "application",
    slug: "application-api-security",
    name: "Application & API Security",
    description: "API contract abuse checks, authz drift detection, and browser policy hardening.",
    privacyNotice: "Contract linting and policy checks process documents fully in-browser.",
    icon: Bug,
    accentClass: "text-amber-700 dark:text-amber-300 bg-amber-500/12 border-amber-500/30",
  },
  {
    id: "cloud-iam",
    slug: "cloud-iam-security",
    name: "Cloud & IAM Security",
    description: "Identity policy review and least-privilege hygiene across cloud providers.",
    privacyNotice: "Policy linting is local; no cloud credentials are required by default.",
    icon: CloudCog,
    accentClass: "text-sky-700 dark:text-sky-300 bg-sky-500/12 border-sky-500/30",
  },
  {
    id: "supply-chain",
    slug: "software-supply-chain-security",
    name: "Software Supply Chain Security",
    description: "Dependency risk diffing, tamper evidence, and provenance-oriented checks.",
    privacyNotice: "SBOM and lockfile analysis remain local unless users opt into lookups.",
    icon: PackageSearch,
    accentClass: "text-rose-700 dark:text-rose-300 bg-rose-500/12 border-rose-500/30",
  },
  {
    id: "osint",
    slug: "osint-reconnaissance",
    name: "OSINT & Reconnaissance",
    description: "Passive intelligence collection, query orchestration, and investigation pivot acceleration.",
    privacyNotice: "Primarily local query generation and normalization, with optional operator-initiated lookups.",
    icon: Satellite,
    accentClass: "text-violet-700 dark:text-violet-300 bg-violet-500/12 border-violet-500/30",
  },
  {
    id: "pentest",
    slug: "pentest-utilities",
    name: "Pentest Utilities",
    description: "Authorized testing planning utilities, command profiles, and reproducible assessment workflows.",
    privacyNotice: "Runs local by default with explicit authorized-testing guardrails and no silent egress.",
    icon: Swords,
    accentClass: "text-orange-700 dark:text-orange-300 bg-orange-500/12 border-orange-500/30",
  },
  {
    id: "ai-llm",
    slug: "ai-llm-security",
    name: "AI / LLM Security",
    description: "Prompt injection triage, connector egress controls, and model-adjacent risk validation workflows.",
    privacyNotice: "Analysis executes in-browser; optional network checks are explicit and policy-gated.",
    icon: Bot,
    accentClass: "text-teal-700 dark:text-teal-300 bg-teal-500/12 border-teal-500/30",
  },
  {
    id: "data-privacy",
    slug: "data-security-privacy-engineering",
    name: "Data Security & Privacy Engineering",
    description: "Sensitive-data handling, leakage detection, and privacy-preserving processing.",
    privacyNotice: "Privacy-focused tools prioritize local-only processing and explicit consent.",
    icon: Fingerprint,
    accentClass: "text-lime-700 dark:text-lime-300 bg-lime-500/12 border-lime-500/30",
  },
];

const DOMAIN_BY_ID = new Map<ToolDomainId, ToolDomain>(
  TOOL_DOMAINS.map((domain) => [domain.id, domain]),
);

const DOMAIN_BY_SLUG = new Map<string, ToolDomain>(
  TOOL_DOMAINS.map((domain) => [domain.slug, domain]),
);

const TOOL_BY_ID = new Map<string, Tool>(TOOLS.map((tool) => [tool.id, tool]));

export type ToolDomainSlug = (typeof TOOL_DOMAINS)[number]["slug"];

export function isToolDomainId(value: string | null | undefined): value is ToolDomainId {
  return typeof value === "string" && DOMAIN_BY_ID.has(value as ToolDomainId);
}

export function isToolDomainSlug(value: string | null | undefined): value is ToolDomainSlug {
  return typeof value === "string" && DOMAIN_BY_SLUG.has(value);
}

export function getDomainById(domainId: ToolDomainId): ToolDomain {
  return DOMAIN_BY_ID.get(domainId) ?? TOOL_DOMAINS[0];
}

export function getDomainBySlug(slug: string): ToolDomain | null {
  return DOMAIN_BY_SLUG.get(slug) ?? null;
}

export function getDomainCanonicalPath(domainId: ToolDomainId): string {
  const domain = getDomainById(domainId);
  return `/domains/${domain.slug}`;
}

export function getDomainQueryPath(domainId: ToolDomainId): string {
  return `/tools?domain=${domainId}`;
}

export function findDomainByPath(pathname: string): ToolDomain | null {
  const match = pathname.match(/^\/domains\/([^/]+)$/);
  if (!match) return null;
  return getDomainBySlug(match[1]);
}

export function getToolDomainId(toolId: string): ToolDomainId {
  const tool = TOOL_BY_ID.get(toolId);
  return tool?.domainId ?? "soc";
}

export function getToolsForDomain(domainId: ToolDomainId): Tool[] {
  return TOOLS.filter((tool) => tool.domainId === domainId);
}

export function getDomainCounts(): Record<ToolDomainId, number> {
  const counts = {} as Record<ToolDomainId, number>;
  TOOL_DOMAINS.forEach((domain) => {
    counts[domain.id] = 0;
  });
  TOOLS.forEach((tool) => {
    counts[tool.domainId] += 1;
  });
  return counts;
}

export function findToolByPath(pathname: string): Tool | null {
  return TOOLS.find((tool) => tool.path === pathname) ?? null;
}
