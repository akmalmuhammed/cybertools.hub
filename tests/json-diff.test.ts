import "./setup.js";
import assert from "node:assert/strict";
import test from "node:test";
import { renderJsonDiffHtml } from "../src/lib/utils/json-diff.js";

test("renderJsonDiffHtml returns unchanged message for identical objects", () => {
  const result = renderJsonDiffHtml({ a: 1 }, { a: 1 });
  assert.equal(result.hasChanges, false);
  assert.match(result.html, /No differences found/);
});

test("renderJsonDiffHtml returns html diff for changed objects", () => {
  const result = renderJsonDiffHtml({ a: 1 }, { a: 2 });
  assert.equal(result.hasChanges, true);
  assert.match(result.html, /jsondiffpatch-delta/);
  assert.match(result.html, /jsondiffpatch-modified/);
});
