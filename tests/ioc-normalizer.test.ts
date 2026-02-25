import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAndCanonicalizeIocs } from "../src/lib/utils/ioc-normalizer.js";

test("normalizeAndCanonicalizeIocs refangs and deduplicates URL indicators", () => {
  const result = normalizeAndCanonicalizeIocs(
    "hxxp://Example[.]com/path http://example.com/path",
  );

  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].type, "url");
  assert.equal(result.entries[0].canonical, "http://example.com/path");
  assert.equal(result.entries[0].originals.length, 2);
});

test("normalizeAndCanonicalizeIocs deduplicates unicode and punycode domain variants", () => {
  const result = normalizeAndCanonicalizeIocs("mañana.com\nxn--maana-pta.com");

  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].type, "domain");
  assert.equal(result.entries[0].canonical, "xn--maana-pta.com");
});

test("normalizeAndCanonicalizeIocs normalizes defanged email format", () => {
  const result = normalizeAndCanonicalizeIocs("Admin[@]Example[.]COM");

  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].type, "email");
  assert.equal(result.entries[0].canonical, "admin@example.com");
});
