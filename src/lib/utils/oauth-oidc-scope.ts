interface GenericObject {
  [key: string]: unknown;
}

export interface OAuthOidcFinding {
  severity: "low" | "medium" | "high";
  issue: string;
  recommendation: string;
}

export interface OAuthOidcLinterResult {
  requestedScopes: string[];
  recommendedScopes: string[];
  excessScopes: string[];
  findings: OAuthOidcFinding[];
  tokenPolicy: {
    accessTokenTtlMinutes: number | null;
    refreshTokenDays: number | null;
    pkceRequired: boolean | null;
  };
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(/[,\s]+/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function parseInput(input: string): {
  requestedScopes: string[];
  usedClaims: string[];
  policy: GenericObject;
} {
  if (!input.trim()) {
    return { requestedScopes: [], usedClaims: [], policy: {} };
  }
  try {
    const parsed = JSON.parse(input);
    if (parsed && typeof parsed === "object") {
      const payload = parsed as GenericObject;
      return {
        requestedScopes: asStringArray(payload.requestedScopes ?? payload.scopes),
        usedClaims: asStringArray(payload.usedClaims ?? payload.claims),
        policy: (payload.tokenPolicy && typeof payload.tokenPolicy === "object")
          ? payload.tokenPolicy as GenericObject
          : {},
      };
    }
  } catch {
    // fallback
  }

  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const requestedScopes = lines.length > 0 ? asStringArray(lines[0]) : [];
  const usedClaims = lines.length > 1 ? asStringArray(lines[1]) : [];
  return { requestedScopes, usedClaims, policy: {} };
}

const CLAIM_TO_SCOPE: Record<string, string[]> = {
  sub: ["openid"],
  email: ["openid", "email"],
  profile: ["openid", "profile"],
  phone_number: ["openid", "phone"],
  groups: ["groups"],
};

const HIGH_RISK_SCOPES = ["admin", "root", "write:all", "full_access", "offline_access"];

export function minimizeScopesAndLintPolicy(input: string): OAuthOidcLinterResult {
  const parsed = parseInput(input);
  const requestedScopes = Array.from(new Set(parsed.requestedScopes.map((scope) => scope.toLowerCase())));
  const usedClaims = Array.from(new Set(parsed.usedClaims.map((claim) => claim.toLowerCase())));

  const recommended = new Set<string>();
  if (requestedScopes.includes("openid")) {
    recommended.add("openid");
  } else if (usedClaims.length > 0) {
    recommended.add("openid");
  }
  usedClaims.forEach((claim) => {
    (CLAIM_TO_SCOPE[claim] ?? []).forEach((scope) => recommended.add(scope));
  });
  if (recommended.size === 0 && requestedScopes.length > 0) {
    recommended.add(requestedScopes[0]);
  }

  const recommendedScopes = [...recommended].sort((a, b) => a.localeCompare(b));
  const excessScopes = requestedScopes.filter((scope) => !recommended.has(scope));

  const findings: OAuthOidcFinding[] = [];
  if (excessScopes.length > 0) {
    findings.push({
      severity: "medium",
      issue: `Detected ${excessScopes.length} scope(s) not required by declared claims.`,
      recommendation: "Remove excess scopes to enforce least-privilege token grants.",
    });
  }

  const riskyRequested = requestedScopes.filter((scope) => HIGH_RISK_SCOPES.includes(scope));
  if (riskyRequested.length > 0) {
    findings.push({
      severity: "high",
      issue: `High-risk scopes requested: ${riskyRequested.join(", ")}.`,
      recommendation: "Justify or replace high-risk scopes with granular delegated scopes.",
    });
  }

  const accessTokenTtlMinutes = Number.isFinite(Number(parsed.policy.accessTokenTtlMinutes))
    ? Number(parsed.policy.accessTokenTtlMinutes)
    : null;
  const refreshTokenDays = Number.isFinite(Number(parsed.policy.refreshTokenDays))
    ? Number(parsed.policy.refreshTokenDays)
    : null;
  const pkceRequired = typeof parsed.policy.pkceRequired === "boolean"
    ? parsed.policy.pkceRequired
    : null;

  if (accessTokenTtlMinutes !== null && accessTokenTtlMinutes > 60) {
    findings.push({
      severity: "medium",
      issue: `Access token TTL is ${accessTokenTtlMinutes} minutes.`,
      recommendation: "Use short-lived access tokens (typically 5-60 minutes).",
    });
  }
  if (refreshTokenDays !== null && refreshTokenDays > 30) {
    findings.push({
      severity: "medium",
      issue: `Refresh token lifetime is ${refreshTokenDays} days.`,
      recommendation: "Reduce refresh token lifetime or bind with rotation and reuse detection.",
    });
  }
  if (pkceRequired === false) {
    findings.push({
      severity: "high",
      issue: "PKCE is disabled.",
      recommendation: "Require PKCE for public clients and authorization-code flows.",
    });
  }

  return {
    requestedScopes,
    recommendedScopes,
    excessScopes,
    findings,
    tokenPolicy: {
      accessTokenTtlMinutes,
      refreshTokenDays,
      pkceRequired,
    },
  };
}
