export interface ParsedHeaders {
  [header: string]: string;
}

export interface HeaderFinding {
  header: string;
  status: "good" | "warn" | "bad";
  message: string;
  recommendation?: string;
}

export interface HttpHeadersAnalysisResult {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  findings: HeaderFinding[];
  present: string[];
  missing: string[];
}

function normalizeHeaderName(name: string): string {
  return name.trim().toLowerCase();
}

function splitHeaderLine(line: string): [string, string] | null {
  const separator = line.indexOf(":");
  if (separator <= 0) return null;
  const key = line.slice(0, separator).trim();
  const value = line.slice(separator + 1).trim();
  if (!key) return null;
  return [key, value];
}

function gradeFromScore(score: number): HttpHeadersAnalysisResult["grade"] {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function addFinding(
  findings: HeaderFinding[],
  missing: string[],
  header: string,
  status: HeaderFinding["status"],
  message: string,
  recommendation?: string,
): void {
  findings.push({ header, status, message, recommendation });
  if (status === "bad") {
    missing.push(header);
  }
}

export function parseHttpHeaders(input: string): ParsedHeaders {
  const headers: ParsedHeaders = {};
  const lines = input.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^HTTP\/\d/i.test(line)) continue;

    const parsed = splitHeaderLine(rawLine);
    if (!parsed) continue;

    const [key, value] = parsed;
    const normalized = normalizeHeaderName(key);
    if (headers[normalized]) {
      headers[normalized] = `${headers[normalized]}, ${value}`;
    } else {
      headers[normalized] = value;
    }
  }

  return headers;
}

export function analyzeHttpSecurityHeaders(headers: ParsedHeaders): HttpHeadersAnalysisResult {
  const findings: HeaderFinding[] = [];
  const missing: string[] = [];
  let score = 100;

  const hsts = headers["strict-transport-security"];
  if (!hsts) {
    score -= 15;
    addFinding(
      findings,
      missing,
      "strict-transport-security",
      "bad",
      "HSTS is missing.",
      "Add Strict-Transport-Security with max-age >= 15552000 and includeSubDomains.",
    );
  } else {
    const maxAgeMatch = hsts.match(/max-age=(\d+)/i);
    const maxAge = maxAgeMatch ? Number(maxAgeMatch[1]) : 0;
    if (!maxAge || maxAge < 15552000) {
      score -= 8;
      findings.push({
        header: "strict-transport-security",
        status: "warn",
        message: "HSTS max-age is shorter than recommended.",
        recommendation: "Set max-age to at least 15552000 (180 days).",
      });
    } else {
      findings.push({
        header: "strict-transport-security",
        status: "good",
        message: "HSTS is present with strong max-age.",
      });
    }
    if (!/includesubdomains/i.test(hsts)) {
      score -= 4;
      findings.push({
        header: "strict-transport-security",
        status: "warn",
        message: "HSTS does not include subdomains.",
        recommendation: "Add includeSubDomains for full site coverage.",
      });
    }
  }

  const csp = headers["content-security-policy"];
  if (!csp) {
    score -= 20;
    addFinding(
      findings,
      missing,
      "content-security-policy",
      "bad",
      "CSP is missing.",
      "Define a restrictive Content-Security-Policy.",
    );
  } else if (/'unsafe-inline'|'unsafe-eval'/i.test(csp)) {
    score -= 15;
    findings.push({
      header: "content-security-policy",
      status: "warn",
      message: "CSP contains unsafe-inline or unsafe-eval.",
      recommendation: "Remove unsafe directives and use nonce/hash based scripts.",
    });
  } else {
    findings.push({
      header: "content-security-policy",
      status: "good",
      message: "CSP is present without obvious unsafe directives.",
    });
  }

  const xfo = headers["x-frame-options"];
  if (!xfo) {
    score -= 10;
    addFinding(
      findings,
      missing,
      "x-frame-options",
      "bad",
      "X-Frame-Options is missing.",
      "Set X-Frame-Options to DENY or SAMEORIGIN.",
    );
  } else if (!/^(deny|sameorigin)$/i.test(xfo.trim())) {
    score -= 8;
    findings.push({
      header: "x-frame-options",
      status: "warn",
      message: "X-Frame-Options value is unusual.",
      recommendation: "Use DENY or SAMEORIGIN.",
    });
  } else {
    findings.push({
      header: "x-frame-options",
      status: "good",
      message: "X-Frame-Options is configured.",
    });
  }

  const xcto = headers["x-content-type-options"];
  if (!xcto) {
    score -= 10;
    addFinding(
      findings,
      missing,
      "x-content-type-options",
      "bad",
      "X-Content-Type-Options is missing.",
      "Set X-Content-Type-Options to nosniff.",
    );
  } else if (!/^nosniff$/i.test(xcto.trim())) {
    score -= 8;
    findings.push({
      header: "x-content-type-options",
      status: "warn",
      message: "Unexpected X-Content-Type-Options value.",
      recommendation: "Use nosniff.",
    });
  } else {
    findings.push({
      header: "x-content-type-options",
      status: "good",
      message: "X-Content-Type-Options is configured.",
    });
  }

  const referrerPolicy = headers["referrer-policy"];
  if (!referrerPolicy) {
    score -= 8;
    addFinding(
      findings,
      missing,
      "referrer-policy",
      "bad",
      "Referrer-Policy is missing.",
      "Use strict-origin-when-cross-origin or stricter.",
    );
  } else if (/unsafe-url|no-referrer-when-downgrade/i.test(referrerPolicy)) {
    score -= 6;
    findings.push({
      header: "referrer-policy",
      status: "warn",
      message: "Referrer-Policy may expose too much URL data.",
      recommendation: "Prefer strict-origin-when-cross-origin or no-referrer.",
    });
  } else {
    findings.push({
      header: "referrer-policy",
      status: "good",
      message: "Referrer-Policy appears safe.",
    });
  }

  const permissionsPolicy = headers["permissions-policy"];
  if (!permissionsPolicy) {
    score -= 8;
    addFinding(
      findings,
      missing,
      "permissions-policy",
      "bad",
      "Permissions-Policy is missing.",
      "Restrict sensitive browser features explicitly.",
    );
  } else {
    findings.push({
      header: "permissions-policy",
      status: "good",
      message: "Permissions-Policy is present.",
    });
  }

  const present = Object.keys(headers).sort();
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    grade: gradeFromScore(score),
    findings,
    present,
    missing: Array.from(new Set(missing)),
  };
}
