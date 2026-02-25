export type SecretFindingSeverity = "low" | "medium" | "high" | "critical";

export interface SecretFinding {
  type: string;
  severity: SecretFindingSeverity;
  start: number;
  end: number;
  value: string;
  maskedValue: string;
  confidence: "low" | "medium" | "high";
  recommendation: string;
}

export interface SecretScanSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface SecretScanResult {
  findings: SecretFinding[];
  summary: SecretScanSummary;
  notes: string[];
}

interface SecretPattern {
  type: string;
  regex: RegExp;
  severity: SecretFindingSeverity;
  confidence: "low" | "medium" | "high";
  recommendation: string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  {
    type: "AWS Access Key ID",
    regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
    severity: "high",
    confidence: "high",
    recommendation: "Rotate IAM credentials immediately and review CloudTrail activity.",
  },
  {
    type: "GitHub Token",
    regex: /\bgh[pousr]_[A-Za-z0-9]{20,255}\b/g,
    severity: "high",
    confidence: "high",
    recommendation: "Revoke token in GitHub settings and replace with least-privilege token.",
  },
  {
    type: "Slack Token",
    regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
    severity: "high",
    confidence: "high",
    recommendation: "Revoke token in Slack admin/API settings and rotate associated app secrets.",
  },
  {
    type: "Stripe Secret Key",
    regex: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
    severity: "high",
    confidence: "high",
    recommendation: "Rotate Stripe API key and audit recent API events.",
  },
  {
    type: "Google API Key",
    regex: /\bAIza[0-9A-Za-z_-]{35}\b/g,
    severity: "medium",
    confidence: "medium",
    recommendation: "Restrict API key by referrer/IP/service and rotate if exposure is confirmed.",
  },
  {
    type: "JWT",
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    severity: "medium",
    confidence: "medium",
    recommendation: "Treat token as sensitive. Revoke or expire token if exposed.",
  },
  {
    type: "Private Key Block",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
    severity: "critical",
    confidence: "high",
    recommendation: "Immediately rotate key material and investigate unauthorized access.",
  },
];

const ENTROPY_TOKEN_REGEX = /\b[A-Za-z0-9+/=_-]{20,}\b/g;

function maskSecret(value: string): string {
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}${"*".repeat(Math.max(4, value.length - 8))}${value.slice(-4)}`;
}

function shannonEntropy(input: string): number {
  if (!input) return 0;
  const frequency = new Map<string, number>();
  for (const char of input) {
    frequency.set(char, (frequency.get(char) ?? 0) + 1);
  }

  let entropy = 0;
  const length = input.length;
  for (const count of frequency.values()) {
    const p = count / length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function pushFinding(
  findings: SecretFinding[],
  seen: Set<string>,
  finding: Omit<SecretFinding, "maskedValue">,
): void {
  const key = `${finding.type}:${finding.start}:${finding.value}`;
  if (seen.has(key)) return;
  seen.add(key);
  findings.push({
    ...finding,
    maskedValue: maskSecret(finding.value),
  });
}

export function scanSecrets(
  input: string,
  options: { enableEntropyScan?: boolean; entropyThreshold?: number } = {},
): SecretScanResult {
  const text = input ?? "";
  const findings: SecretFinding[] = [];
  const seen = new Set<string>();

  SECRET_PATTERNS.forEach((pattern) => {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      pushFinding(findings, seen, {
        type: pattern.type,
        severity: pattern.severity,
        start: match.index,
        end: match.index + match[0].length,
        value: match[0],
        confidence: pattern.confidence,
        recommendation: pattern.recommendation,
      });
    }
  });

  const enableEntropyScan = options.enableEntropyScan ?? true;
  const entropyThreshold = options.entropyThreshold ?? 4.2;

  if (enableEntropyScan) {
    const regex = new RegExp(ENTROPY_TOKEN_REGEX.source, ENTROPY_TOKEN_REGEX.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const token = match[0];
      if (token.length < 24) continue;
      const entropy = shannonEntropy(token);
      if (entropy < entropyThreshold) continue;

      pushFinding(findings, seen, {
        type: "High-Entropy Token",
        severity: "medium",
        start: match.index,
        end: match.index + token.length,
        value: token,
        confidence: entropy >= 4.8 ? "high" : "medium",
        recommendation: "Review whether this token is a credential. If yes, rotate and remove from shared channels.",
      });
    }
  }

  findings.sort((a, b) => {
    const severityWeight =
      a.severity === "critical" ? 4 : a.severity === "high" ? 3 : a.severity === "medium" ? 2 : 1;
    const otherWeight =
      b.severity === "critical" ? 4 : b.severity === "high" ? 3 : b.severity === "medium" ? 2 : 1;
    if (severityWeight !== otherWeight) return otherWeight - severityWeight;
    return a.start - b.start;
  });

  const summary: SecretScanSummary = {
    total: findings.length,
    critical: findings.filter((finding) => finding.severity === "critical").length,
    high: findings.filter((finding) => finding.severity === "high").length,
    medium: findings.filter((finding) => finding.severity === "medium").length,
    low: findings.filter((finding) => finding.severity === "low").length,
  };

  const notes: string[] = [];
  if (findings.length === 0) {
    notes.push("No obvious secrets detected.");
  } else {
    notes.push("Pattern and entropy checks are heuristic; review findings before remediation.");
  }
  if (!enableEntropyScan) {
    notes.push("Entropy-based detection disabled.");
  }

  return {
    findings,
    summary,
    notes,
  };
}
