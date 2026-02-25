import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeHttpSecurityHeaders,
  parseHttpHeaders,
} from "../src/lib/utils/http-headers.js";

test("parseHttpHeaders handles status line and repeated headers", () => {
  const parsed = parseHttpHeaders(
    [
      "HTTP/1.1 200 OK",
      "Server: nginx",
      "Cache-Control: no-cache",
      "Cache-Control: no-store",
      "",
    ].join("\n"),
  );

  assert.equal(parsed.server, "nginx");
  assert.equal(parsed["cache-control"], "no-cache, no-store");
});

test("analyzeHttpSecurityHeaders scores hardened profile highly", () => {
  const parsed = parseHttpHeaders(
    [
      "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload",
      "Content-Security-Policy: default-src 'self'",
      "X-Frame-Options: DENY",
      "X-Content-Type-Options: nosniff",
      "Referrer-Policy: strict-origin-when-cross-origin",
      "Permissions-Policy: geolocation=()",
    ].join("\n"),
  );
  const analysis = analyzeHttpSecurityHeaders(parsed);
  assert.equal(analysis.grade, "A");
  assert.ok(analysis.score >= 90);
});

test("analyzeHttpSecurityHeaders penalizes missing headers", () => {
  const parsed = parseHttpHeaders("Server: Apache");
  const analysis = analyzeHttpSecurityHeaders(parsed);
  assert.equal(analysis.grade, "F");
  assert.ok(analysis.missing.includes("content-security-policy"));
  assert.ok(analysis.missing.includes("strict-transport-security"));
});
