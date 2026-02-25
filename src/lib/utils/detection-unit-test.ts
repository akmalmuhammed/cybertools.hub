import { load } from "js-yaml";

interface GenericObject {
  [key: string]: unknown;
}

export interface DetectionFixture {
  label?: string;
  event: GenericObject;
  expectMatch: boolean;
}

export interface DetectionUnitCaseResult {
  label: string;
  expectMatch: boolean;
  actualMatch: boolean;
  passed: boolean;
}

export interface DetectionUnitHarnessResult {
  ruleTitle: string | null;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  results: DetectionUnitCaseResult[];
  notes: string[];
}

function isObject(value: unknown): value is GenericObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseInput(input: string): unknown {
  if (!input.trim()) {
    throw new Error("Input is empty. Provide harness JSON/YAML.");
  }
  try {
    return JSON.parse(input);
  } catch {
    return load(input);
  }
}

function getNestedValue(event: GenericObject, path: string): unknown {
  const tokens = path.split(".");
  let current: unknown = event;
  for (const token of tokens) {
    if (!isObject(current)) return undefined;
    current = current[token];
  }
  return current;
}

function compareField(operator: string, actual: unknown, expected: unknown): boolean {
  const actualText = String(actual ?? "");
  const expectedText = String(expected ?? "");

  if (operator === "contains") {
    return actualText.toLowerCase().includes(expectedText.toLowerCase());
  }
  if (operator === "startswith") {
    return actualText.toLowerCase().startsWith(expectedText.toLowerCase());
  }
  if (operator === "endswith") {
    return actualText.toLowerCase().endsWith(expectedText.toLowerCase());
  }
  if (Array.isArray(expected)) {
    return expected.some((item) => compareField("equals", actual, item));
  }
  if (typeof expected === "number" || typeof expected === "boolean") {
    return actual === expected;
  }
  return actualText.toLowerCase() === expectedText.toLowerCase();
}

function evaluateSelector(event: GenericObject, selector: GenericObject): boolean {
  return Object.entries(selector).every(([rawField, expected]) => {
    const [field, operator = "equals"] = rawField.split("|");
    const actual = getNestedValue(event, field);
    return compareField(operator, actual, expected);
  });
}

function evaluateCondition(condition: string, selectorResults: Record<string, boolean>): boolean {
  const oneOfThem = Object.values(selectorResults).some(Boolean);
  const allOfThem = Object.values(selectorResults).every(Boolean);

  let expression = condition.toLowerCase();
  for (const [name, value] of Object.entries(selectorResults)) {
    const escaped = name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    expression = expression.replace(new RegExp(`\\b${escaped}\\b`, "g"), value ? "true" : "false");
  }
  expression = expression.replace(/\b1 of them\b/g, oneOfThem ? "true" : "false");
  expression = expression.replace(/\bany of them\b/g, oneOfThem ? "true" : "false");
  expression = expression.replace(/\ball of them\b/g, allOfThem ? "true" : "false");
  expression = expression.replace(/\band\b/g, "&&");
  expression = expression.replace(/\bor\b/g, "||");
  expression = expression.replace(/\bnot\b/g, "!");

  if (!/^[truefals&|!()\s]+$/.test(expression)) {
    throw new Error("Condition contains unsupported tokens.");
  }

  try {
    return Boolean(Function(`"use strict"; return (${expression});`)());
  } catch {
    throw new Error("Condition evaluation failed.");
  }
}

function normalizeFixtures(value: unknown): DetectionFixture[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => isObject(item) && isObject(item.event))
    .map((item, index) => {
      const event = item.event as GenericObject;
      return {
        label: typeof item.label === "string" ? item.label : `fixture-${index + 1}`,
        event,
        expectMatch: Boolean(item.expectMatch),
      };
    });
}

function parseRule(ruleInput: unknown): GenericObject {
  if (isObject(ruleInput)) return ruleInput;
  if (typeof ruleInput === "string") {
    const parsed = load(ruleInput);
    if (isObject(parsed)) return parsed;
  }
  throw new Error("Rule input must be an object or YAML string.");
}

export function runDetectionUnitHarness(input: string): DetectionUnitHarnessResult {
  const parsed = parseInput(input);
  if (!isObject(parsed)) {
    throw new Error("Harness payload must be an object with rule and fixtures.");
  }

  const rule = parseRule(parsed.rule ?? parsed);
  const detection = isObject(rule.detection) ? rule.detection : null;
  if (!detection) {
    throw new Error("Rule must contain a detection section.");
  }

  const condition = typeof detection.condition === "string"
    ? detection.condition
    : "selection";

  const selectors = Object.entries(detection).filter(([key, value]) => key !== "condition" && isObject(value));
  if (selectors.length === 0) {
    throw new Error("Rule detection section must include at least one selector.");
  }

  const fixtures = normalizeFixtures(parsed.fixtures);
  if (fixtures.length === 0) {
    throw new Error("Harness requires at least one fixture with {event, expectMatch}.");
  }

  const results = fixtures.map((fixture) => {
    const selectorResults: Record<string, boolean> = {};
    selectors.forEach(([name, selector]) => {
      selectorResults[name] = evaluateSelector(fixture.event, selector as GenericObject);
    });
    const actualMatch = evaluateCondition(condition, selectorResults);
    return {
      label: fixture.label ?? "fixture",
      expectMatch: fixture.expectMatch,
      actualMatch,
      passed: fixture.expectMatch === actualMatch,
    };
  });

  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;
  const passRate = Math.round((passed / results.length) * 10000) / 100;

  return {
    ruleTitle: typeof rule.title === "string" ? rule.title : null,
    total: results.length,
    passed,
    failed,
    passRate,
    results,
    notes: [
      `Condition evaluated as: ${condition}`,
      "Supported selector operators: equals, contains, startswith, endswith.",
    ],
  };
}
