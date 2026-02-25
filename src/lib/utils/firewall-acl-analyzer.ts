export interface FirewallRule {
  line: number;
  action: "allow" | "deny";
  protocol: string;
  source: string;
  destination: string;
  port: string;
  raw: string;
}

export interface FirewallFinding {
  severity: "low" | "medium" | "high" | "critical";
  type: "duplicate" | "shadowed" | "conflict" | "over-permissive";
  message: string;
  lines: number[];
}

export interface FirewallAnalysisResult {
  rules: FirewallRule[];
  findings: FirewallFinding[];
  summary: {
    totalRules: number;
    duplicate: number;
    shadowed: number;
    conflict: number;
    overPermissive: number;
  };
  notes: string[];
}

function isWildcard(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "any" || normalized === "*" || normalized === "0.0.0.0/0";
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function parseRule(line: string, lineNo: number): FirewallRule | null {
  const cleaned = line.replace(/#.*/, "").trim();
  if (!cleaned) return null;
  const tokens = cleaned.split(/\s+/);
  if (tokens.length < 5) return null;

  const action = normalizeToken(tokens[0]);
  if (action !== "allow" && action !== "deny") return null;

  const protocol = normalizeToken(tokens[1]);
  const source = normalizeToken(tokens[2]);
  const destination = normalizeToken(tokens[3]);
  const port = normalizeToken(tokens[4]);

  return {
    line: lineNo,
    action,
    protocol,
    source,
    destination,
    port,
    raw: cleaned,
  };
}

function fieldCovers(a: string, b: string): boolean {
  if (isWildcard(a)) return true;
  return normalizeToken(a) === normalizeToken(b);
}

function ruleCovers(a: FirewallRule, b: FirewallRule): boolean {
  return (
    fieldCovers(a.protocol, b.protocol) &&
    fieldCovers(a.source, b.source) &&
    fieldCovers(a.destination, b.destination) &&
    fieldCovers(a.port, b.port)
  );
}

function sameRule(a: FirewallRule, b: FirewallRule): boolean {
  return (
    a.action === b.action &&
    a.protocol === b.protocol &&
    a.source === b.source &&
    a.destination === b.destination &&
    a.port === b.port
  );
}

export function analyzeFirewallAcl(input: string): FirewallAnalysisResult {
  const rules = input
    .split(/\r?\n/)
    .map((line, index) => parseRule(line, index + 1))
    .filter((rule): rule is FirewallRule => !!rule);

  const findings: FirewallFinding[] = [];

  for (let i = 0; i < rules.length; i += 1) {
    const current = rules[i];

    if (
      current.action === "allow" &&
      isWildcard(current.protocol) &&
      isWildcard(current.source) &&
      isWildcard(current.destination) &&
      isWildcard(current.port)
    ) {
      findings.push({
        severity: "critical",
        type: "over-permissive",
        message: "Rule allows all protocols, sources, destinations, and ports.",
        lines: [current.line],
      });
    }

    for (let j = 0; j < i; j += 1) {
      const previous = rules[j];
      if (sameRule(previous, current)) {
        findings.push({
          severity: "medium",
          type: "duplicate",
          message: "Duplicate rule detected.",
          lines: [previous.line, current.line],
        });
        continue;
      }

      if (!ruleCovers(previous, current)) continue;

      if (previous.action !== current.action) {
        findings.push({
          severity: "high",
          type: "conflict",
          message: "Earlier rule conflicts with a later rule over the same traffic scope.",
          lines: [previous.line, current.line],
        });
      } else {
        findings.push({
          severity: "medium",
          type: "shadowed",
          message: "Later rule is shadowed by an earlier broader rule with same action.",
          lines: [previous.line, current.line],
        });
      }
    }
  }

  const uniqueFindings = findings.filter((finding, index, arr) => {
    const key = `${finding.type}|${finding.lines.join("-")}|${finding.message}`;
    return arr.findIndex((candidate) => `${candidate.type}|${candidate.lines.join("-")}|${candidate.message}` === key) === index;
  });

  return {
    rules,
    findings: uniqueFindings,
    summary: {
      totalRules: rules.length,
      duplicate: uniqueFindings.filter((finding) => finding.type === "duplicate").length,
      shadowed: uniqueFindings.filter((finding) => finding.type === "shadowed").length,
      conflict: uniqueFindings.filter((finding) => finding.type === "conflict").length,
      overPermissive: uniqueFindings.filter((finding) => finding.type === "over-permissive").length,
    },
    notes: [
      "Rule order matters. Earlier rules may shadow or conflict with later rules.",
      "Parser expects: action protocol source destination port.",
    ],
  };
}
