import assert from "node:assert/strict";
import test from "node:test";
import { correlateIocSources } from "../src/lib/utils/ioc-correlator.js";

test("correlateIocSources computes shared and unique indicators", () => {
  const sourceA = `
https://example.com/a
8.8.8.8
CVE-2024-1111
d41d8cd98f00b204e9800998ecf8427e
`;
  const sourceB = `
https://example.com/a
1.1.1.1
CVE-2024-1111
da39a3ee5e6b4b0d3255bfef95601890afd80709
`;

  const result = correlateIocSources(sourceA, sourceB);

  assert.equal(result.summary.shared, 3);
  assert.equal(result.summary.uniqueSourceA, 2);
  assert.equal(result.summary.uniqueSourceB, 2);

  const ipBucket = result.byType.find((bucket) => bucket.type === "ipv4");
  assert.ok(ipBucket);
  assert.deepEqual(ipBucket?.shared, []);
  assert.deepEqual(ipBucket?.onlySourceA, ["8.8.8.8"]);
  assert.deepEqual(ipBucket?.onlySourceB, ["1.1.1.1"]);
});

test("correlateIocSources includes private IPs when requested", () => {
  const result = correlateIocSources("10.0.0.1", "10.0.0.1", {
    includePrivateIps: true,
  });
  const ipBucket = result.byType.find((bucket) => bucket.type === "ipv4");
  assert.deepEqual(ipBucket?.shared, ["10.0.0.1"]);
});
