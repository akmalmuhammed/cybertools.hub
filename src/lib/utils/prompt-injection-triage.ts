export type PromptInjectionSeverity = "low" | "medium" | "high" | "critical";

export interface PromptInjectionFinding {
  pattern: string;
  severity: PromptInjectionSeverity;
  evidence: string;
  rationale: string;
}

export interface PromptInjectionTriageResult {
  score: number;
  risk: "low" | "medium" | "high" | "critical";
  findings: PromptInjectionFinding[];
  recommendations: string[];
}

interface Rule {
  pattern: string;
  severity: PromptInjectionSeverity;
  regex: RegExp;
  rationale: string;
}

const RULES: Rule[] = [
  {
    pattern: "Instruction Override",
    severity: "high",
    regex: /\b(ignore|override|bypass)\b.{0,30}\b(previous|system|policy|instructions?)\b/i,
    rationale: "Attempts to override higher-priority instructions indicate prompt injection behavior.",
  },
  {
    pattern: "System Prompt Exfiltration",
    severity: "critical",
    regex: /\b(reveal|print|show|leak)\b.{0,30}\b(system prompt|hidden prompt|developer message)\b/i,
    rationale: "Direct request for hidden prompt or policy text is a high-confidence exfiltration signal.",
  },
  {
    pattern: "Tool Abuse Directive",
    severity: "high",
    regex: /\b(call|invoke|run|execute)\b.{0,30}\btool|function|plugin\b/i,
    rationale: "Manipulating tool invocation paths can bypass intended authorization checks.",
  },
  {
    pattern: "Credential Exfil Signal",
    severity: "critical",
    regex: /\b(api[- ]?key|token|password|secret|credential)\b.{0,40}\b(send|export|exfiltrate|post)\b/i,
    rationale: "Sensitive credential exfiltration language detected.",
  },
  {
    pattern: "Remote Fetch/Callback",
    severity: "medium",
    regex: /\b(fetch|curl|wget|http request|webhook)\b.{0,50}\bhttps?:\/\//i,
    rationale: "External callback instructions can be used for data extraction or policy bypass.",
  },
  {
    pattern: "Encoding Evasion",
    severity: "medium",
    regex: /\b(base64|hex|rot13|encode|decode)\b.{0,40}\b(hidden|payload|command|instruction)\b/i,
    rationale: "Encoding language around payloads may indicate obfuscation attempts.",
  },
];

function severityWeight(severity: PromptInjectionSeverity): number {
  if (severity === "critical") return 28;
  if (severity === "high") return 20;
  if (severity === "medium") return 12;
  return 6;
}

function riskFromScore(score: number): "low" | "medium" | "high" | "critical" {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function extractEvidence(text: string, matchIndex: number, length: number): string {
  const start = Math.max(0, matchIndex - 30);
  const end = Math.min(text.length, matchIndex + length + 30);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export function triagePromptInjection(input: string): PromptInjectionTriageResult {
  const text = input ?? "";
  const findings: PromptInjectionFinding[] = [];

  RULES.forEach((rule) => {
    const regex = new RegExp(rule.regex.source, rule.regex.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      findings.push({
        pattern: rule.pattern,
        severity: rule.severity,
        evidence: extractEvidence(text, match.index, match[0].length),
        rationale: rule.rationale,
      });
      if (findings.length >= 60) break;
    }
  });

  findings.sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity));

  const score = Math.min(
    100,
    findings.reduce((total, finding) => total + severityWeight(finding.severity), 0),
  );
  const risk = riskFromScore(score);

  const recommendations = [
    "Apply strict system/developer instruction boundaries and deny instruction-overrides by default.",
    "Require explicit tool-authorization checks before executing model-requested actions.",
    "Add output filtering for secret material and prompt leakage indicators.",
  ];

  if (findings.length === 0) {
    recommendations.unshift("No strong injection patterns detected in current sample.");
  }

  return {
    score,
    risk,
    findings,
    recommendations,
  };
}

