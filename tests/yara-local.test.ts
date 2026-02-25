import assert from "node:assert/strict";
import test from "node:test";
import { runYaraLocalMatcher } from "../src/lib/utils/yara-local.js";

test("runYaraLocalMatcher matches a simple text rule", () => {
  const result = runYaraLocalMatcher(
    [
      "rule SuspiciousKeyword {",
      "  strings:",
      "    $a = \"password=\" nocase",
      "  condition:",
      "    any of them",
      "}",
    ].join("\n"),
    "PASSWORD=secret",
  );

  assert.equal(result.summary.matchedRules, 1);
  assert.equal(result.matches[0].matched, true);
});

test("runYaraLocalMatcher evaluates boolean conditions", () => {
  const result = runYaraLocalMatcher(
    [
      "rule Combo {",
      "  strings:",
      "    $a = \"alpha\"",
      "    $b = \"beta\"",
      "  condition:",
      "    $a and $b",
      "}",
    ].join("\n"),
    "alpha only",
  );

  assert.equal(result.summary.matchedRules, 0);
  assert.equal(result.matches[0].matched, false);
});
