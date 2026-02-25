import { TOOLS } from "@/lib/constants/tools";

export type ToolProcessingMode = "local" | "network" | "hybrid";

const NETWORK_TOOL_IDS = new Set<string>([
  "whois",
  "dns-toolkit",
  "iplookup",
  "port",
]);

const HYBRID_TOOL_IDS = new Set<string>([
  "jwt-verify",
  "reputation",
]);

export function getToolProcessingMode(toolId: string): ToolProcessingMode {
  if (NETWORK_TOOL_IDS.has(toolId)) return "network";
  if (HYBRID_TOOL_IDS.has(toolId)) return "hybrid";
  return "local";
}

export function getProcessingLabel(mode: ToolProcessingMode): string {
  if (mode === "local") return "Local Processing";
  if (mode === "network") return "Network Requests";
  return "Hybrid Mode";
}

export function getProcessingDescription(mode: ToolProcessingMode): string {
  if (mode === "local") {
    return "All data is processed locally in your browser.";
  }
  if (mode === "network") {
    return "This tool performs outbound lookups to remote endpoints.";
  }
  return "Runs locally, with optional outbound requests in specific modes.";
}

export function getProcessingCounts(): Record<ToolProcessingMode, number> {
  return {
    local: TOOLS.filter((tool) => getToolProcessingMode(tool.id) === "local").length,
    network: TOOLS.filter((tool) => getToolProcessingMode(tool.id) === "network").length,
    hybrid: TOOLS.filter((tool) => getToolProcessingMode(tool.id) === "hybrid").length,
  };
}
