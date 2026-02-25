import assert from "node:assert/strict";
import test from "node:test";
import { lintAndTranslateSigmaRule } from "../src/lib/utils/sigma-linter.js";

test("lintAndTranslateSigmaRule validates and translates a basic rule", () => {
  const result = lintAndTranslateSigmaRule([
    "title: Suspicious PowerShell",
    "id: 11111111-1111-1111-1111-111111111111",
    "logsource:",
    "  product: windows",
    "  category: process_creation",
    "tags:",
    "  - attack.execution",
    "  - attack.t1059.001",
    "detection:",
    "  selection:",
    "    Image: powershell.exe",
    "  condition: selection",
  ].join("\n"));

  assert.equal(result.valid, true);
  assert.ok(result.translated);
  assert.equal(result.attackCoverage.techniques >= 1, true);
  assert.equal(result.attackCoverage.tactics >= 1, true);
});

test("lintAndTranslateSigmaRule returns errors for malformed input", () => {
  const result = lintAndTranslateSigmaRule("title: broken");

  assert.equal(result.valid, false);
  assert.equal(result.errors.length > 0, true);
});
