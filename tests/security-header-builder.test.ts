import assert from "node:assert/strict";
import test from "node:test";
import { buildSecurityHeaders } from "../src/lib/utils/security-header-builder.js";

test("buildSecurityHeaders creates strict CSP and strong score", () => {
  const result = buildSecurityHeaders({ preset: "strict" });

  assert.equal(result.csp.includes("default-src 'none'"), true);
  assert.equal(result.analysis.score >= 80, true);
  assert.equal(!!result.headers["content-security-policy"], true);
});

test("buildSecurityHeaders supports report-only mode", () => {
  const result = buildSecurityHeaders({ preset: "balanced", reportOnly: true });

  assert.equal(!!result.headers["content-security-policy-report-only"], true);
  assert.equal(result.headers["content-security-policy"] === undefined, true);
});

test("buildSecurityHeaders explains unsafe-inline tradeoff", () => {
  const result = buildSecurityHeaders({
    preset: "strict",
    allowInlineScript: true,
  });

  assert.equal(result.csp.includes("'unsafe-inline'"), true);
  assert.equal(result.tradeoffs.some((note) => note.toLowerCase().includes("unsafe-inline")), true);
});
