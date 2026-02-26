import { TOOLS } from "./tools.js";
import type {
  Tool,
  ToolCapability,
  ToolDefaultPanel,
  ToolInputMode,
  ToolOutboundPolicy,
  ToolOutputKind,
  ToolPageMode,
} from "../../types/tool.types.js";

const TOOL_BY_ID = new Map(TOOLS.map((tool) => [tool.id, tool]));

const FILE_HEAVY_TOOL_IDS = new Set([
  "base64",
  "hash",
  "json",
  "secrets-scanner",
  "yara-local",
  "sbom-diff",
  "lockfile-risk-diff",
  "stix-taxii",
  "misp-stix-mapper",
  "artifact-integrity",
  "openapi-authz-gap",
  "detection-unit-test",
]);

const CSV_READY_TOOL_IDS = new Set([
  "cve-prioritizer",
  "reputation",
  "ioc",
  "ioc-correlator",
  "ioc-confidence-ttl",
  "exposure-normalizer",
  "firewall-acl-analyzer",
  "event-timeline",
  "log-schema-mapper",
  "lockfile-risk-diff",
]);

const JSON_HEAVY_TOOL_IDS = new Set([
  "json",
  "jwt",
  "jwt-verify",
  "stix-taxii",
  "misp-stix-mapper",
  "openapi-authz-gap",
  "iam-policy-analyzer",
  "oauth-oidc-linter",
  "sbom-diff",
  "security-header-builder",
  "detection-unit-test",
]);

const OUTPUT_KIND_OVERRIDES: Partial<Record<string, ToolOutputKind[]>> = {
  "event-timeline": ["timeline", "json", "table"],
  "security-header-builder": ["policy", "json", "table"],
  "artifact-integrity": ["manifest", "json", "table"],
  "sbom-diff": ["diff", "json", "table"],
  "lockfile-risk-diff": ["diff", "json", "table"],
  diff: ["diff", "json", "table"],
};

const TOOL_CAPABILITY_OVERRIDES: Partial<Record<string, ToolCapability>> = {
  "cve-prioritizer": {
    inputModes: ["text", "json", "csv", "batch"],
    outputKinds: ["json", "table"],
    supportsExport: true,
    supportsBatch: true,
    supportsLocalOnly: true,
  },
  "reputation": {
    inputModes: ["text", "csv", "batch"],
    outputKinds: ["json", "table"],
    supportsExport: true,
    supportsBatch: true,
    supportsLocalOnly: true,
  },
  "stix-taxii": {
    inputModes: ["json", "file", "batch"],
    outputKinds: ["json", "diff", "manifest"],
    supportsExport: true,
    supportsBatch: true,
    supportsLocalOnly: true,
  },
  "jwt-verify": {
    inputModes: ["text", "json"],
    outputKinds: ["json", "table"],
    supportsExport: true,
    supportsBatch: false,
    supportsLocalOnly: true,
  },
};

const TOOL_PAGE_MODE_OVERRIDES: Partial<Record<string, ToolPageMode>> = {
  color: "simple",
  qrcode: "simple",
  markdown: "simple",
  uuid: "simple",
  password: "simple",
};

const TOOL_PANEL_OVERRIDES: Partial<Record<string, ToolDefaultPanel[]>> = {
  email: ["findings", "evidence", "history", "export"],
  ioc: ["findings", "evidence", "export", "history"],
  reputation: ["findings", "evidence", "export"],
  "cve-prioritizer": ["findings", "evidence", "export", "history"],
};

const TOOL_OUTBOUND_POLICY_OVERRIDES: Partial<Record<string, ToolOutboundPolicy>> = {
  reputation: "optional",
  "jwt-verify": "optional",
};

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function inferInputModes(tool: Tool): ToolInputMode[] {
  const modes: ToolInputMode[] = ["text"];
  const keywords = new Set(tool.keywords.map((keyword) => keyword.toLowerCase()));

  if (JSON_HEAVY_TOOL_IDS.has(tool.id) || keywords.has("json")) {
    modes.push("json");
  }
  if (CSV_READY_TOOL_IDS.has(tool.id) || keywords.has("csv") || keywords.has("bulk")) {
    modes.push("csv");
    modes.push("batch");
  }
  if (FILE_HEAVY_TOOL_IDS.has(tool.id) || keywords.has("file")) {
    modes.push("file");
  }

  return unique(modes);
}

function inferOutputKinds(tool: Tool): ToolOutputKind[] {
  const override = OUTPUT_KIND_OVERRIDES[tool.id];
  if (override) return override;

  const kinds: ToolOutputKind[] = ["json"];
  const keywords = new Set(tool.keywords.map((keyword) => keyword.toLowerCase()));

  if (keywords.has("diff")) kinds.push("diff");
  if (keywords.has("timeline")) kinds.push("timeline");
  if (keywords.has("policy") || keywords.has("csp")) kinds.push("policy");
  if (keywords.has("manifest") || keywords.has("sbom")) kinds.push("manifest");
  kinds.push("table");

  return unique(kinds);
}

function deriveCapability(tool: Tool): ToolCapability {
  const override = TOOL_CAPABILITY_OVERRIDES[tool.id];
  if (override) return override;

  const inputModes = inferInputModes(tool);
  const outputKinds = inferOutputKinds(tool);
  const supportsBatch = inputModes.includes("batch") || inputModes.includes("csv");

  return {
    inputModes,
    outputKinds,
    supportsExport: true,
    supportsBatch,
    supportsLocalOnly: tool.processingMode !== "network",
  };
}

export function getToolCapability(toolId: string): ToolCapability {
  const tool = TOOL_BY_ID.get(toolId);
  if (!tool) {
    return {
      inputModes: ["text"],
      outputKinds: ["json"],
      supportsExport: true,
      supportsBatch: false,
      supportsLocalOnly: true,
    };
  }

  return tool.capability ?? deriveCapability(tool);
}

export function getToolOutboundPolicy(toolId: string): ToolOutboundPolicy {
  const tool = TOOL_BY_ID.get(toolId);
  if (!tool) return "none";
  if (tool.outboundPolicy) return tool.outboundPolicy;
  if (TOOL_OUTBOUND_POLICY_OVERRIDES[tool.id]) return TOOL_OUTBOUND_POLICY_OVERRIDES[tool.id] as ToolOutboundPolicy;
  if (tool.processingMode === "network") return "required";
  if (tool.processingMode === "hybrid") return "optional";
  return "none";
}

export function toolRequiresExplicitAction(toolId: string): boolean {
  const tool = TOOL_BY_ID.get(toolId);
  if (!tool) return false;
  if (typeof tool.requiresExplicitAction === "boolean") return tool.requiresExplicitAction;
  return getToolOutboundPolicy(toolId) !== "none";
}

export function getToolPageMode(toolId: string): ToolPageMode {
  const tool = TOOL_BY_ID.get(toolId);
  if (!tool) return "analyst";
  if (tool.pageMode) return tool.pageMode;
  if (TOOL_PAGE_MODE_OVERRIDES[tool.id]) return TOOL_PAGE_MODE_OVERRIDES[tool.id] as ToolPageMode;
  return tool.category === "security" || tool.category === "network" ? "analyst" : "simple";
}

export function getToolDefaultPanels(toolId: string): ToolDefaultPanel[] {
  const tool = TOOL_BY_ID.get(toolId);
  if (!tool) return ["findings", "evidence", "export"];
  if (tool.defaultPanels && tool.defaultPanels.length > 0) return tool.defaultPanels;
  if (TOOL_PANEL_OVERRIDES[tool.id]) return TOOL_PANEL_OVERRIDES[tool.id] as ToolDefaultPanel[];

  const mode = getToolPageMode(toolId);
  if (mode === "simple") return ["history", "export"];
  return ["findings", "evidence", "export"];
}

export function getToolCapabilitySummary(toolId: string): string {
  const capability = getToolCapability(toolId);
  const modeSummary = capability.supportsBatch ? "batch-ready" : "single-run";
  const localSummary = capability.supportsLocalOnly ? "local-only available" : "network-required";
  return `${capability.inputModes.join(" / ")} input | ${modeSummary} | ${localSummary}`;
}
