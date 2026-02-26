import { TOOLS } from "@/lib/constants/tools";
import type { ToolOutboundPolicy, ToolProcessingMode, ToolSensitivity } from "@/types/tool.types";
import { getToolOutboundPolicy, toolRequiresExplicitAction } from "@/lib/constants/tool-capabilities";

const TOOL_BY_ID = new Map(TOOLS.map((tool) => [tool.id, tool]));

export function getToolProcessingMode(toolId: string): ToolProcessingMode {
  const tool = TOOL_BY_ID.get(toolId);
  return tool?.processingMode ?? "local";
}

export function getToolSensitivity(toolId: string): ToolSensitivity {
  const tool = TOOL_BY_ID.get(toolId);
  return tool?.sensitivity ?? "medium";
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

export function getSensitivityLabel(sensitivity: ToolSensitivity): string {
  if (sensitivity === "high") return "High Sensitivity";
  if (sensitivity === "medium") return "Medium Sensitivity";
  return "Low Sensitivity";
}

export function getSensitivityDescription(sensitivity: ToolSensitivity): string {
  if (sensitivity === "high") {
    return "Often used with credentials, logs, or investigation artifacts. Prefer local-only execution.";
  }
  if (sensitivity === "medium") {
    return "May include moderate operational context; validate sharing boundaries.";
  }
  return "Typically lower sensitivity reference or transformation workflows.";
}

export function getOutboundPolicyLabel(policy: ToolOutboundPolicy): string {
  if (policy === "none") return "No Outbound Traffic";
  if (policy === "optional") return "Optional Outbound Traffic";
  return "Network Required";
}

export function getOutboundPolicyDescription(policy: ToolOutboundPolicy, explicitAction: boolean): string {
  if (policy === "none") {
    return "This tool can run fully local in your browser.";
  }
  if (policy === "optional") {
    return explicitAction
      ? "Outbound lookups are optional and only occur after explicit user action."
      : "Outbound lookups are optional.";
  }
  return explicitAction
    ? "Outbound requests are required for this workflow and run after explicit user action."
    : "Outbound requests are required for this workflow.";
}

export function getToolOutboundSummary(toolId: string): {
  policy: ToolOutboundPolicy
  requiresExplicitAction: boolean
  label: string
  description: string
} {
  const policy = getToolOutboundPolicy(toolId);
  const requiresExplicitAction = toolRequiresExplicitAction(toolId);
  return {
    policy,
    requiresExplicitAction,
    label: getOutboundPolicyLabel(policy),
    description: getOutboundPolicyDescription(policy, requiresExplicitAction),
  };
}

export function getProcessingCounts(): Record<ToolProcessingMode, number> {
  return {
    local: TOOLS.filter((tool) => tool.processingMode === "local").length,
    network: TOOLS.filter((tool) => tool.processingMode === "network").length,
    hybrid: TOOLS.filter((tool) => tool.processingMode === "hybrid").length,
  };
}

export function getSensitivityCounts(): Record<ToolSensitivity, number> {
  return {
    low: TOOLS.filter((tool) => tool.sensitivity === "low").length,
    medium: TOOLS.filter((tool) => tool.sensitivity === "medium").length,
    high: TOOLS.filter((tool) => tool.sensitivity === "high").length,
  };
}
