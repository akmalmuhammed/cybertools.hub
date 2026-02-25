export interface YaraPattern {
  id: string;
  type: "text" | "regex";
  value: string;
  modifiers: string[];
}

export interface ParsedYaraRule {
  name: string;
  tags: string[];
  patterns: YaraPattern[];
  condition: string;
}

export interface YaraRuleMatch {
  rule: string;
  matched: boolean;
  condition: string;
  matchedPatterns: string[];
}

export interface YaraScanResult {
  parsedRules: number;
  parseErrors: string[];
  matches: YaraRuleMatch[];
  summary: {
    matchedRules: number;
    unmatchedRules: number;
  };
}

function unescapeYaraString(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function extractSection(body: string, section: "strings" | "condition"): string {
  if (section === "strings") {
    const match = body.match(/strings\s*:\s*([\s\S]*?)\bcondition\s*:/i);
    return match?.[1]?.trim() ?? "";
  }
  const match = body.match(/condition\s*:\s*([\s\S]*)$/i);
  return match?.[1]?.trim() ?? "";
}

function parsePatternLine(line: string): YaraPattern | null {
  const textMatch = line.match(/^\s*(\$[A-Za-z0-9_]+)\s*=\s*"((?:\\.|[^"])*)"\s*([A-Za-z\s]*)$/);
  if (textMatch) {
    const modifiers = textMatch[3]
      .split(/\s+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    return {
      id: textMatch[1],
      type: "text",
      value: unescapeYaraString(textMatch[2]),
      modifiers,
    };
  }

  const regexMatch = line.match(/^\s*(\$[A-Za-z0-9_]+)\s*=\s*\/((?:\\\/|[^/])+)\/([A-Za-z]*)\s*([A-Za-z\s]*)$/);
  if (regexMatch) {
    const tailModifiers = regexMatch[4]
      .split(/\s+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    const inlineFlags = regexMatch[3]
      .split("")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    return {
      id: regexMatch[1],
      type: "regex",
      value: regexMatch[2].replace(/\\\//g, "/"),
      modifiers: [...inlineFlags, ...tailModifiers],
    };
  }

  return null;
}

export function parseYaraRules(ruleInput: string): { rules: ParsedYaraRule[]; errors: string[] } {
  const errors: string[] = [];
  const rules: ParsedYaraRule[] = [];

  const ruleRegex = /rule\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?::\s*([^{]+))?\s*\{([\s\S]*?)\}/gi;
  let match: RegExpExecArray | null;

  while ((match = ruleRegex.exec(ruleInput)) !== null) {
    const name = match[1];
    const tags = match[2]
      ? match[2]
          .split(/\s+/)
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];
    const body = match[3];

    const stringsSection = extractSection(body, "strings");
    const condition = extractSection(body, "condition");
    if (!condition) {
      errors.push(`Rule ${name}: missing condition section.`);
      continue;
    }

    const patterns: YaraPattern[] = [];
    if (stringsSection) {
      stringsSection
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => {
          const parsed = parsePatternLine(line);
          if (parsed) {
            patterns.push(parsed);
            return;
          }
          if (!line.startsWith("//") && !line.startsWith("#")) {
            errors.push(`Rule ${name}: unsupported strings line '${line}'.`);
          }
        });
    }

    rules.push({
      name,
      tags,
      patterns,
      condition: condition.replace(/\s+/g, " ").trim(),
    });
  }

  if (rules.length === 0 && ruleInput.trim()) {
    errors.push("No valid YARA rules found.");
  }

  return { rules, errors };
}

function patternMatches(pattern: YaraPattern, target: string): boolean {
  const nocase = pattern.modifiers.includes("nocase");

  if (pattern.type === "text") {
    if (nocase) {
      return target.toLowerCase().includes(pattern.value.toLowerCase());
    }
    return target.includes(pattern.value);
  }

  const flags = new Set<string>(["g"]);
  if (nocase || pattern.modifiers.includes("i")) {
    flags.add("i");
  }

  try {
    const regex = new RegExp(pattern.value, [...flags].join(""));
    return regex.test(target);
  } catch {
    return false;
  }
}

function evaluateBooleanExpression(expression: string): boolean {
  const sanitized = expression.trim();
  if (!sanitized) return false;
  if (/[^()\s!&|truefalsTRUEFALS]/.test(sanitized)) {
    return false;
  }
  try {
    // Expression is sanitized to booleans/operators only.
    const evaluator = new Function(`return (${sanitized});`);
    const result = evaluator();
    return Boolean(result);
  } catch {
    return false;
  }
}

function evaluateCondition(condition: string, matches: Map<string, boolean>): boolean {
  const normalized = condition.trim().toLowerCase();
  const total = matches.size;
  const positives = [...matches.values()].filter(Boolean).length;

  const anyMatch = normalized.match(/^(?:any|1)\s+of\s+them$/i);
  if (anyMatch) return positives >= 1;

  const allMatch = normalized.match(/^all\s+of\s+them$/i);
  if (allMatch) return total > 0 && positives === total;

  const numericMatch = normalized.match(/^(\d+)\s+of\s+them$/i);
  if (numericMatch) {
    const threshold = Number(numericMatch[1]);
    return positives >= threshold;
  }

  let expression = condition;
  matches.forEach((value, key) => {
    const pattern = new RegExp(`\\${key}\\b`, "g");
    expression = expression.replace(pattern, value ? "true" : "false");
  });

  expression = expression
    .replace(/\band\b/gi, "&&")
    .replace(/\bor\b/gi, "||")
    .replace(/\bnot\b/gi, "!")
    .replace(/\btrue\b/gi, "true")
    .replace(/\bfalse\b/gi, "false");

  return evaluateBooleanExpression(expression);
}

export function runYaraLocalMatcher(ruleInput: string, target: string): YaraScanResult {
  const parsed = parseYaraRules(ruleInput);

  const matches = parsed.rules.map((rule) => {
    const patternMatchesMap = new Map<string, boolean>();
    rule.patterns.forEach((pattern) => {
      patternMatchesMap.set(pattern.id, patternMatches(pattern, target));
    });

    const matched = evaluateCondition(rule.condition, patternMatchesMap);
    return {
      rule: rule.name,
      matched,
      condition: rule.condition,
      matchedPatterns: [...patternMatchesMap.entries()]
        .filter((entry) => entry[1])
        .map((entry) => entry[0])
        .sort((a, b) => a.localeCompare(b)),
    };
  });

  return {
    parsedRules: parsed.rules.length,
    parseErrors: parsed.errors,
    matches,
    summary: {
      matchedRules: matches.filter((item) => item.matched).length,
      unmatchedRules: matches.filter((item) => !item.matched).length,
    },
  };
}
