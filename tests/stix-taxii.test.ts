import assert from "node:assert/strict";
import test from "node:test";
import {
  compareStixBundles,
  exportStixBundle,
  parseStixOrTaxii,
  validateStixBundle,
} from "../src/lib/utils/stix-taxii.js";

test("parseStixOrTaxii parses and validates a minimal STIX bundle", () => {
  const bundle = parseStixOrTaxii(
    JSON.stringify({
      type: "bundle",
      id: "bundle--11111111-1111-4111-8111-111111111111",
      spec_version: "2.1",
      objects: [
        {
          type: "indicator",
          id: "indicator--11111111-1111-4111-8111-111111111111",
          spec_version: "2.1",
          pattern: "[ipv4-addr:value = '8.8.8.8']",
          pattern_type: "stix",
        },
      ],
    }),
  );

  const validation = validateStixBundle(bundle);
  assert.equal(validation.valid, true);
  assert.equal(validation.objectCount, 1);
});

test("compareStixBundles reports changed and added objects", () => {
  const before = parseStixOrTaxii(
    JSON.stringify({
      type: "bundle",
      id: "bundle--22222222-2222-4222-8222-222222222222",
      spec_version: "2.1",
      objects: [
        { type: "indicator", id: "indicator--a", pattern: "[ipv4-addr:value = '1.1.1.1']" },
      ],
    }),
  );

  const after = parseStixOrTaxii(
    JSON.stringify({
      type: "bundle",
      id: "bundle--33333333-3333-4333-8333-333333333333",
      spec_version: "2.1",
      objects: [
        { type: "indicator", id: "indicator--a", pattern: "[ipv4-addr:value = '8.8.8.8']" },
        { type: "malware", id: "malware--b", name: "test" },
      ],
    }),
  );

  const diff = compareStixBundles(before, after);
  assert.equal(diff.changed.includes("indicator--a"), true);
  assert.equal(diff.added.includes("malware--b"), true);
});

test("exportStixBundle wraps objects in bundle JSON", () => {
  const json = exportStixBundle(
    [{ type: "indicator", id: "indicator--x" }],
    { id: "bundle--44444444-4444-4444-8444-444444444444" },
  );
  const parsed = JSON.parse(json);
  assert.equal(parsed.type, "bundle");
  assert.equal(Array.isArray(parsed.objects), true);
  assert.equal(parsed.objects.length, 1);
});
