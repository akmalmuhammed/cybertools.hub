import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeDomainSpoof,
  analyzeDomainSpoofBatch,
  parseDomainAgeHints,
} from "../src/lib/utils/domain-spoof.js";

test("analyzeDomainSpoof flags risky brand-typo domains", () => {
  const finding = analyzeDomainSpoof("paypa1-login.zip", {
    brands: ["paypal"],
    createdAt: "2026-02-10",
    nowMs: Date.parse("2026-02-25T00:00:00Z"),
  });

  assert.ok(finding);
  assert.equal(finding.risk === "high" || finding.risk === "critical", true);
  assert.equal(finding.reasons.length > 0, true);
});

test("parseDomainAgeHints parses csv mapping", () => {
  const hints = parseDomainAgeHints("example.com,2026-01-01");
  assert.equal(hints.get("example.com"), "2026-01-01");
});

test("analyzeDomainSpoofBatch returns ranked findings", () => {
  const result = analyzeDomainSpoofBatch("paypa1-login.zip\nexample.com", {
    brandInput: "paypal",
    nowMs: Date.parse("2026-02-25T00:00:00Z"),
  });

  assert.equal(result.summary.total, 2);
  assert.equal(result.items[0].score >= result.items[1].score, true);
});
