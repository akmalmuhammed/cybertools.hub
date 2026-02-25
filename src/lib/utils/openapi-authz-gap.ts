import { load } from "js-yaml";

interface GenericObject {
  [key: string]: unknown;
}

export interface OpenApiAuthzFinding {
  severity: "low" | "medium" | "high" | "critical";
  path: string;
  method: string;
  issue: string;
  recommendation: string;
}

export interface OpenApiAuthzResult {
  findings: OpenApiAuthzFinding[];
  summary: {
    operations: number;
    unsecured: number;
    weakScoped: number;
    riskyApiKeyQuery: number;
  };
  notes: string[];
}

function isObject(value: unknown): value is GenericObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseSpec(input: string): GenericObject {
  if (!input.trim()) throw new Error("OpenAPI spec is empty.");
  try {
    const parsed = JSON.parse(input);
    if (isObject(parsed)) return parsed;
  } catch {
    const parsed = load(input);
    if (isObject(parsed)) return parsed;
  }
  throw new Error("OpenAPI spec must be valid JSON or YAML object.");
}

const OPERATION_METHODS = ["get", "post", "put", "patch", "delete", "head", "options", "trace"] as const;

function readSecurityArray(value: unknown): GenericObject[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => isObject(item)) as GenericObject[];
}

export function analyzeOpenApiAuthzGaps(input: string): OpenApiAuthzResult {
  const spec = parseSpec(input);
  const paths = isObject(spec.paths) ? spec.paths : {};
  const globalSecurity = readSecurityArray(spec.security);
  const securitySchemes = isObject(spec.components) && isObject(spec.components.securitySchemes)
    ? spec.components.securitySchemes
    : {};

  const findings: OpenApiAuthzFinding[] = [];
  let operations = 0;
  let unsecured = 0;
  let weakScoped = 0;
  let riskyApiKeyQuery = 0;

  Object.entries(paths).forEach(([path, rawPathItem]) => {
    if (!isObject(rawPathItem)) return;
    OPERATION_METHODS.forEach((method) => {
      if (!isObject(rawPathItem[method])) return;
      operations += 1;
      const operation = rawPathItem[method] as GenericObject;
      const operationSecurity = readSecurityArray(operation.security);
      const hasExplicitAnonymous = Array.isArray(operation.security) && operationSecurity.length === 0;
      const effectiveSecurity = hasExplicitAnonymous
        ? []
        : operationSecurity.length > 0
          ? operationSecurity
          : globalSecurity;

      if (effectiveSecurity.length === 0) {
        unsecured += 1;
        findings.push({
          severity: "high",
          path,
          method: method.toUpperCase(),
          issue: "Operation has no authentication/authorization requirement.",
          recommendation: "Attach a security requirement or explicitly justify anonymous access.",
        });
        return;
      }

      effectiveSecurity.forEach((requirement) => {
        Object.entries(requirement).forEach(([schemeName, scopes]) => {
          const scheme = isObject(securitySchemes[schemeName]) ? securitySchemes[schemeName] as GenericObject : null;
          const scopeList = Array.isArray(scopes) ? scopes.map((scope) => String(scope).toLowerCase()) : [];
          if (scopeList.some((scope) => scope === "*" || scope.includes("admin") || scope.includes("write:all"))) {
            weakScoped += 1;
            findings.push({
              severity: "medium",
              path,
              method: method.toUpperCase(),
              issue: `Broad OAuth scope detected in ${schemeName}.`,
              recommendation: "Minimize scopes to least privilege per operation.",
            });
          }

          if (scheme && String(scheme.type).toLowerCase() === "apiKey" && String(scheme.in).toLowerCase() === "query") {
            riskyApiKeyQuery += 1;
            findings.push({
              severity: "medium",
              path,
              method: method.toUpperCase(),
              issue: `API key scheme ${schemeName} is passed in query parameters.`,
              recommendation: "Move API keys to headers and enforce rotation and audit controls.",
            });
          }
        });
      });
    });
  });

  return {
    findings,
    summary: {
      operations,
      unsecured,
      weakScoped,
      riskyApiKeyQuery,
    },
    notes: [
      "Analysis inspects operation-level and global security requirements.",
      "Findings are deterministic heuristics; validate business exceptions separately.",
    ],
  };
}
