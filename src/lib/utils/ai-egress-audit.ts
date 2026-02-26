export type AiEgressSeverity = "low" | "medium" | "high" | "critical";

export interface AiEgressFinding {
  destination: string;
  severity: AiEgressSeverity;
  reason: string;
  evidence: string;
}

export interface AiEgressAuditResult {
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  findings: AiEgressFinding[];
  notes: string[];
}

const PII_PATTERNS: Array<{ label: string; regex: RegExp; severity: AiEgressSeverity }> = [
  { label: "SSN-like pattern", regex: /\b\d{3}-\d{2}-\d{4}\b/, severity: "critical" },
  { label: "Credit-card-like pattern", regex: /\b(?:\d[ -]*?){13,16}\b/, severity: "high" },
  { label: "API key/token marker", regex: /\b(api[- ]?key|token|secret|credential)\b/i, severity: "high" },
  { label: "Email address", regex: /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i, severity: "medium" },
];

function normalizeLines(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 500);
}

function hostFromLine(line: string): string {
  const urlMatch = line.match(/https?:\/\/([^\s/]+)/i);
  if (urlMatch?.[1]) return urlMatch[1].toLowerCase();

  const hostMatch = line.match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/i);
  if (hostMatch?.[0]) return hostMatch[0].toLowerCase();

  return "unknown-destination";
}

function severityWeight(level: AiEgressSeverity): number {
  if (level === "critical") return 4;
  if (level === "high") return 3;
  if (level === "medium") return 2;
  return 1;
}

export function auditAiConnectorEgress(input: string, options: {
  allowedDomains?: string[];
  strictMode?: boolean;
} = {}): AiEgressAuditResult {
  const allowedDomains = new Set((options.allowedDomains ?? []).map((item) => item.toLowerCase()).filter(Boolean));
  const strictMode = options.strictMode ?? false;
  const lines = normalizeLines(input);
  const findings: AiEgressFinding[] = [];

  lines.forEach((line) => {
    const destination = hostFromLine(line);

    if (destination !== "unknown-destination" && allowedDomains.size > 0 && !allowedDomains.has(destination)) {
      findings.push({
        destination,
        severity: strictMode ? "high" : "medium",
        reason: "Destination is not in allowed domain list.",
        evidence: line.slice(0, 240),
      });
    }

    PII_PATTERNS.forEach((pattern) => {
      if (!pattern.regex.test(line)) return;
      findings.push({
        destination,
        severity: pattern.severity,
        reason: `Potential sensitive-data indicator detected: ${pattern.label}.`,
        evidence: line.slice(0, 240),
      });
    });

    if (strictMode && /\b(public|pastebin|gist|share|webhook)\b/i.test(line)) {
      findings.push({
        destination,
        severity: "high",
        reason: "Strict mode flagged public-sharing or webhook-related egress language.",
        evidence: line.slice(0, 240),
      });
    }
  });

  findings.sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity));

  return {
    summary: {
      total: findings.length,
      critical: findings.filter((item) => item.severity === "critical").length,
      high: findings.filter((item) => item.severity === "high").length,
      medium: findings.filter((item) => item.severity === "medium").length,
      low: findings.filter((item) => item.severity === "low").length,
    },
    findings,
    notes: [
      "This analyzer is local-only and does not transmit payloads.",
      "Findings are heuristic. Validate with connector policy and data-classification controls.",
    ],
  };
}

