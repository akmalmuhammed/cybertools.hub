interface GenericObject {
  [key: string]: unknown;
}

export interface CorsFinding {
  severity: "low" | "medium" | "high" | "critical";
  issue: string;
  evidence: string;
  recommendation: string;
}

export interface CorsAnalysisResult {
  score: number;
  findings: CorsFinding[];
  normalizedHeaders: Record<string, string>;
}

function normalizeHeaderName(name: string): string {
  return name.trim().toLowerCase();
}

function parseHeaders(input: string): Record<string, string> {
  if (!input.trim()) return {};

  try {
    const parsed = JSON.parse(input);
    if (parsed && typeof parsed === "object") {
      const entries = Object.entries(parsed as GenericObject).map(([key, value]) => [normalizeHeaderName(key), String(value ?? "")] as const);
      return Object.fromEntries(entries);
    }
  } catch {
    // fallback to raw header parsing
  }

  const map: Record<string, string> = {};
  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || !line.includes(":")) continue;
    const [header, ...rest] = line.split(":");
    map[normalizeHeaderName(header)] = rest.join(":").trim();
  }
  return map;
}

function boolHeader(value: string | undefined): boolean {
  return String(value ?? "").trim().toLowerCase() === "true";
}

export function analyzeCorsPolicy(input: string): CorsAnalysisResult {
  const headers = parseHeaders(input);
  let score = 100;
  const findings: CorsFinding[] = [];

  const allowOrigin = headers["access-control-allow-origin"] ?? "";
  const allowCredentials = boolHeader(headers["access-control-allow-credentials"]);
  const allowMethods = (headers["access-control-allow-methods"] ?? "")
    .split(",")
    .map((method) => method.trim().toUpperCase())
    .filter(Boolean);
  const vary = headers.vary ?? "";

  if (!allowOrigin) {
    score -= 20;
    findings.push({
      severity: "medium",
      issue: "Missing Access-Control-Allow-Origin header.",
      evidence: "No explicit CORS origin policy found.",
      recommendation: "Define explicit allowed origins for browser cross-origin access.",
    });
  }

  if (allowOrigin === "*" && allowCredentials) {
    score -= 45;
    findings.push({
      severity: "critical",
      issue: "Wildcard origin combined with credentials.",
      evidence: "Access-Control-Allow-Origin=* and Access-Control-Allow-Credentials=true.",
      recommendation: "Use explicit trusted origins when credentials are enabled.",
    });
  } else if (allowOrigin === "*") {
    score -= 20;
    findings.push({
      severity: "high",
      issue: "Wildcard origin policy.",
      evidence: "Access-Control-Allow-Origin=*.",
      recommendation: "Restrict CORS origins to specific trusted domains.",
    });
  }

  if (allowCredentials && allowOrigin && !vary.toLowerCase().includes("origin") && allowOrigin !== "*") {
    score -= 12;
    findings.push({
      severity: "medium",
      issue: "Missing Vary: Origin for credentialed CORS.",
      evidence: "Credentialed CORS response without Vary: Origin.",
      recommendation: "Add Vary: Origin to prevent cache confusion across origins.",
    });
  }

  if (allowMethods.includes("*") || (allowMethods.includes("PUT") && allowMethods.includes("DELETE") && allowOrigin === "*")) {
    score -= 18;
    findings.push({
      severity: "high",
      issue: "Broad method exposure in CORS policy.",
      evidence: `Methods=${allowMethods.join(", ") || "not set"}.`,
      recommendation: "Expose only required HTTP methods per endpoint.",
    });
  }

  if (!headers["access-control-allow-headers"] && allowMethods.length > 0) {
    score -= 5;
    findings.push({
      severity: "low",
      issue: "No Access-Control-Allow-Headers guidance.",
      evidence: "Allow-Headers is unset while methods are exposed.",
      recommendation: "Explicitly define allowed request headers for consistency and auditability.",
    });
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    findings: findings.sort((a, b) => {
      const weight = (severity: CorsFinding["severity"]) => {
        if (severity === "critical") return 4;
        if (severity === "high") return 3;
        if (severity === "medium") return 2;
        return 1;
      };
      return weight(b.severity) - weight(a.severity);
    }),
    normalizedHeaders: headers,
  };
}
