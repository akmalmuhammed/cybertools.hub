import { load } from "js-yaml";

interface GenericObject {
  [key: string]: unknown;
}

export interface AttackCoverageResult {
  totalRules: number;
  mappedRules: number;
  tactics: Array<{ tactic: string; count: number }>;
  techniques: Array<{ technique: string; count: number }>;
  coverageScore: number;
  gaps: string[];
}

function isObject(value: unknown): value is GenericObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseRules(input: string): GenericObject[] {
  if (!input.trim()) return [];
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => isObject(item)) as GenericObject[];
    }
    if (isObject(parsed) && Array.isArray(parsed.rules)) {
      return parsed.rules.filter((item) => isObject(item)) as GenericObject[];
    }
    if (isObject(parsed)) return [parsed];
  } catch {
    // YAML path below
  }

  const docs = input
    .split(/\n---\n/g)
    .map((doc) => doc.trim())
    .filter(Boolean);

  const rules: GenericObject[] = [];
  for (const doc of docs) {
    try {
      const parsed = load(doc);
      if (isObject(parsed)) rules.push(parsed);
    } catch {
      // ignore malformed docs
    }
  }
  return rules;
}

function readTags(rule: GenericObject): string[] {
  if (!Array.isArray(rule.tags)) return [];
  return rule.tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean);
}

function sortTactics(map: Map<string, number>): Array<{ tactic: string; count: number }> {
  return [...map.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .map(([tactic, count]) => ({ tactic, count }));
}

function sortTechniques(map: Map<string, number>): Array<{ technique: string; count: number }> {
  return [...map.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .map(([technique, count]) => ({ technique, count }));
}

export function buildAttackCoverageHeatmap(input: string): AttackCoverageResult {
  const rules = parseRules(input);
  if (rules.length === 0) {
    return {
      totalRules: 0,
      mappedRules: 0,
      tactics: [],
      techniques: [],
      coverageScore: 0,
      gaps: ["No rule metadata parsed from input."],
    };
  }

  const tacticMap = new Map<string, number>();
  const techniqueMap = new Map<string, number>();
  let mappedRules = 0;

  for (const rule of rules) {
    const tags = readTags(rule);
    const tactics = tags.filter((tag) => /^attack\.[a-z0-9_-]+$/i.test(tag) && !/^attack\.t\d{4}/i.test(tag));
    const techniques = tags.filter((tag) => /^attack\.t\d{4}(?:\.\d{3})?$/i.test(tag));

    const hasCoverage = tactics.length > 0 || techniques.length > 0;
    if (hasCoverage) mappedRules += 1;

    new Set(tactics).forEach((tactic) => tacticMap.set(tactic, (tacticMap.get(tactic) ?? 0) + 1));
    new Set(techniques).forEach((technique) => techniqueMap.set(technique, (techniqueMap.get(technique) ?? 0) + 1));
  }

  const tactics = sortTactics(tacticMap);
  const techniques = sortTechniques(techniqueMap);

  const mappedRatio = mappedRules / rules.length;
  const tacticCoverage = Math.min(1, tacticMap.size / 14); // ATT&CK Enterprise tactic count reference.
  const techniqueCoverage = Math.min(1, techniqueMap.size / 80);
  const coverageScore = Math.round((mappedRatio * 0.45 + tacticCoverage * 0.3 + techniqueCoverage * 0.25) * 10000) / 100;

  const gaps: string[] = [];
  if (mappedRules < rules.length) {
    gaps.push(`${rules.length - mappedRules} rule(s) have no ATT&CK tags.`);
  }
  if (tacticMap.size < 6) {
    gaps.push("Tactic diversity is low; validate ATT&CK tactic mapping breadth.");
  }
  if (techniqueMap.size < 10) {
    gaps.push("Technique coverage is narrow; add telemetry-aligned rules.");
  }

  return {
    totalRules: rules.length,
    mappedRules,
    tactics,
    techniques,
    coverageScore,
    gaps,
  };
}
