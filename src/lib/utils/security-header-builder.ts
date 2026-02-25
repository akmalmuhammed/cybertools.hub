import { analyzeHttpSecurityHeaders, type ParsedHeaders } from "./http-headers.js";

export type CspPreset = "strict" | "balanced" | "compat";

export interface SecurityHeaderBuildOptions {
  preset?: CspPreset;
  reportOnly?: boolean;
  reportUri?: string;
  allowInlineScript?: boolean;
  allowInlineStyle?: boolean;
  allowDataImages?: boolean;
  includeUpgradeInsecureRequests?: boolean;
  scriptSources?: string[];
  connectSources?: string[];
  frameAncestors?: "none" | "self";
}

export interface SecurityHeaderBuildResult {
  csp: string;
  headers: Record<string, string>;
  tradeoffs: string[];
  analysis: {
    score: number;
    grade: "A" | "B" | "C" | "D" | "F";
  };
}

function normalizeSources(values: string[] | undefined): string[] {
  if (!values?.length) return [];
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function baseDirectives(preset: CspPreset): Record<string, string[]> {
  if (preset === "strict") {
    return {
      "default-src": ["'none'"],
      "base-uri": ["'none'"],
      "object-src": ["'none'"],
      "frame-ancestors": ["'none'"],
      "form-action": ["'self'"],
      "script-src": ["'self'"],
      "style-src": ["'self'"],
      "img-src": ["'self'"],
      "font-src": ["'self'"],
      "connect-src": ["'self'"],
    };
  }

  if (preset === "balanced") {
    return {
      "default-src": ["'self'"],
      "base-uri": ["'self'"],
      "object-src": ["'none'"],
      "frame-ancestors": ["'self'"],
      "script-src": ["'self'"],
      "style-src": ["'self'"],
      "img-src": ["'self'", "https:"],
      "font-src": ["'self'", "https:"],
      "connect-src": ["'self'", "https:"],
    };
  }

  return {
    "default-src": ["'self'", "https:"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "frame-ancestors": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", "https:"],
    "style-src": ["'self'", "'unsafe-inline'", "https:"],
    "img-src": ["'self'", "data:", "https:"],
    "font-src": ["'self'", "https:", "data:"],
    "connect-src": ["'self'", "https:"],
  };
}

function dedupeDirective(values: string[]): string[] {
  return [...new Set(values)];
}

export function buildSecurityHeaders(options: SecurityHeaderBuildOptions = {}): SecurityHeaderBuildResult {
  const preset = options.preset ?? "strict";
  const directives = baseDirectives(preset);
  const tradeoffs: string[] = [];

  if (options.allowInlineScript && !directives["script-src"].includes("'unsafe-inline'")) {
    directives["script-src"].push("'unsafe-inline'");
    tradeoffs.push("Enabled 'unsafe-inline' for script-src; increases XSS risk.");
  }

  if (options.allowInlineStyle && !directives["style-src"].includes("'unsafe-inline'")) {
    directives["style-src"].push("'unsafe-inline'");
    tradeoffs.push("Enabled 'unsafe-inline' for style-src; weakens style injection protection.");
  }

  if (options.allowDataImages && !directives["img-src"].includes("data:")) {
    directives["img-src"].push("data:");
    tradeoffs.push("Allowed data: images; useful for embeds but broadens injection surface.");
  }

  const scriptSources = normalizeSources(options.scriptSources);
  if (scriptSources.length > 0) {
    directives["script-src"].push(...scriptSources);
  }

  const connectSources = normalizeSources(options.connectSources);
  if (connectSources.length > 0) {
    directives["connect-src"].push(...connectSources);
  }

  if (options.frameAncestors === "none") {
    directives["frame-ancestors"] = ["'none'"];
  }
  if (options.frameAncestors === "self") {
    directives["frame-ancestors"] = ["'self'"];
  }

  if (options.includeUpgradeInsecureRequests) {
    directives["upgrade-insecure-requests"] = [];
  }

  if (options.reportUri?.trim()) {
    directives["report-uri"] = [options.reportUri.trim()];
  }

  const csp = Object.entries(directives)
    .map(([directive, values]) => {
      const uniqueValues = dedupeDirective(values);
      return uniqueValues.length > 0 ? `${directive} ${uniqueValues.join(" ")}` : directive;
    })
    .join("; ");

  const headers: Record<string, string> = {
    "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
    "x-content-type-options": "nosniff",
    "x-frame-options": directives["frame-ancestors"]?.includes("'none'") ? "DENY" : "SAMEORIGIN",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
  };

  if (options.reportOnly) {
    headers["content-security-policy-report-only"] = csp;
    tradeoffs.push("Policy is report-only; violations are logged but not blocked.");
  } else {
    headers["content-security-policy"] = csp;
  }

  const analysisInput: ParsedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const analysis = analyzeHttpSecurityHeaders(analysisInput);

  if (preset === "compat") {
    tradeoffs.push("Compatibility preset prioritizes legacy app support over strict isolation.");
  }
  if (preset === "strict") {
    tradeoffs.push("Strict preset may require nonce/hash adjustments for dynamic frontend frameworks.");
  }

  return {
    csp,
    headers,
    tradeoffs,
    analysis: {
      score: analysis.score,
      grade: analysis.grade,
    },
  };
}
