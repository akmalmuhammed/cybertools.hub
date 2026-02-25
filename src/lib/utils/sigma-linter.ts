import { load } from "js-yaml";

export interface SigmaLintResult {
  valid: boolean;
  title: string | null;
  errors: string[];
  warnings: string[];
  translated: {
    kql: string;
    splunk: string;
    elastic: string;
  } | null;
  attackCoverage: {
    techniques: number;
    tactics: number;
  };
}

type Backend = "kql" | "splunk" | "elastic";

interface SigmaRule {
  title?: unknown;
  id?: unknown;
  status?: unknown;
  tags?: unknown;
  logsource?: unknown;
  detection?: unknown;
  [key: string]: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function quote(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function renderFieldComparison(field: string, value: unknown, backend: Backend): string {
  const comparator = backend === "kql" ? ":" : backend === "splunk" ? "=" : ":";

  if (Array.isArray(value)) {
    const parts = value.map((item) => renderFieldComparison(field, item, backend));
    return `(${parts.join(" OR ")})`;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return `${field}${comparator}${value}`;
  }

  if (value && typeof value === "object") {
    const safeObject = value as Record<string, unknown>;
    if ("contains" in safeObject) {
      const needle = String(safeObject.contains);
      if (backend === "kql") return `${field} : ${quote(`*${needle}*`)}`;
      if (backend === "splunk") return `${field}=${quote(`*${needle}*`)}`;
      return `${field}:${quote(`*${needle}*`)}`;
    }
    if ("startswith" in safeObject) {
      const prefix = String(safeObject.startswith);
      if (backend === "kql") return `${field} : ${quote(`${prefix}*`)}`;
      if (backend === "splunk") return `${field}=${quote(`${prefix}*`)}`;
      return `${field}:${quote(`${prefix}*`)}`;
    }
    if ("endswith" in safeObject) {
      const suffix = String(safeObject.endswith);
      if (backend === "kql") return `${field} : ${quote(`*${suffix}`)}`;
      if (backend === "splunk") return `${field}=${quote(`*${suffix}`)}`;
      return `${field}:${quote(`*${suffix}`)}`;
    }
  }

  const text = String(value);
  if (backend === "kql") return `${field} : ${quote(text)}`;
  if (backend === "splunk") return `${field}=${quote(text)}`;
  return `${field}:${quote(text)}`;
}

function detectionBlockToQuery(block: unknown, backend: Backend): string {
  if (!isObject(block)) return "";
  const comparisons = Object.entries(block).map(([field, value]) => renderFieldComparison(field, value, backend));
  return comparisons.length > 1 ? `(${comparisons.join(" AND ")})` : comparisons[0] ?? "";
}

function translateCondition(
  condition: string,
  selectors: Map<string, string>,
  backend: Backend,
): string {
  let translated = condition;

  selectors.forEach((query, key) => {
    const pattern = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "g");
    translated = translated.replace(pattern, query || "false");
  });

  translated = translated.replace(/\b1 of them\b/gi, "(true)");
  translated = translated.replace(/\bany of them\b/gi, "(true)");
  translated = translated.replace(/\ball of them\b/gi, "(true)");

  translated = translated.replace(/\band\b/gi, "AND");
  translated = translated.replace(/\bor\b/gi, "OR");
  translated = translated.replace(/\bnot\b/gi, "NOT");

  if (backend === "splunk") {
    return translated;
  }
  return translated;
}

export function lintAndTranslateSigmaRule(input: string): SigmaLintResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let parsed: unknown;
  try {
    parsed = load(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown YAML parsing error.";
    return {
      valid: false,
      title: null,
      errors: [`YAML parsing failed: ${message}`],
      warnings,
      translated: null,
      attackCoverage: {
        techniques: 0,
        tactics: 0,
      },
    };
  }

  if (!isObject(parsed)) {
    return {
      valid: false,
      title: null,
      errors: ["Sigma rule must be a YAML object."],
      warnings,
      translated: null,
      attackCoverage: {
        techniques: 0,
        tactics: 0,
      },
    };
  }

  const rule = parsed as SigmaRule;
  const title = typeof rule.title === "string" ? rule.title : null;
  if (!title) errors.push("Missing required field: title.");

  if (!rule.id) {
    warnings.push("Missing rule ID; cross-referencing and change control become harder.");
  }

  if (!isObject(rule.logsource)) {
    errors.push("Missing or invalid logsource section.");
  }

  const tags = asStringArray(rule.tags);
  const attackTechniqueTags = tags.filter((tag) => /^attack\.t\d{4}(?:\.\d{3})?$/i.test(tag));
  const attackTacticTags = tags.filter((tag) => /^attack\.[a-z0-9_-]+$/i.test(tag) && !/^attack\.t\d{4}/i.test(tag));

  if (attackTechniqueTags.length === 0) {
    warnings.push("No ATT&CK technique tags found (expected attack.t#### style tags).");
  }
  if (attackTacticTags.length === 0) {
    warnings.push("No ATT&CK tactic tags found (e.g. attack.execution, attack.persistence).");
  }

  if (!isObject(rule.detection)) {
    errors.push("Missing or invalid detection section.");
  }

  let translated: SigmaLintResult["translated"] = null;
  if (isObject(rule.detection)) {
    const conditionRaw = rule.detection.condition;
    if (typeof conditionRaw !== "string" || !conditionRaw.trim()) {
      errors.push("Detection section must include a non-empty condition string.");
    } else {
      const selectors = new Map<string, string>();
      Object.entries(rule.detection).forEach(([key, value]) => {
        if (key === "condition") return;
        selectors.set(key, detectionBlockToQuery(value, "kql"));
      });

      const kqlSelectors = new Map<string, string>();
      const splunkSelectors = new Map<string, string>();
      const elasticSelectors = new Map<string, string>();
      Object.entries(rule.detection).forEach(([key, value]) => {
        if (key === "condition") return;
        kqlSelectors.set(key, detectionBlockToQuery(value, "kql"));
        splunkSelectors.set(key, detectionBlockToQuery(value, "splunk"));
        elasticSelectors.set(key, detectionBlockToQuery(value, "elastic"));
      });

      translated = {
        kql: translateCondition(conditionRaw, kqlSelectors, "kql"),
        splunk: translateCondition(conditionRaw, splunkSelectors, "splunk"),
        elastic: translateCondition(conditionRaw, elasticSelectors, "elastic"),
      };

      if (selectors.size === 0) {
        warnings.push("No selector blocks found under detection; translator output may be empty.");
      }
    }
  }

  return {
    valid: errors.length === 0,
    title,
    errors,
    warnings,
    translated,
    attackCoverage: {
      techniques: attackTechniqueTags.length,
      tactics: attackTacticTags.length,
    },
  };
}
