import assert from "node:assert/strict";
import test from "node:test";
import { extractIocs, flattenIocs } from "../src/lib/utils/ioc.js";

const MD5_EMPTY = "d41d8cd98f00b204e9800998ecf8427e";
const SHA1_EMPTY = "da39a3ee5e6b4b0d3255bfef95601890afd80709";
const SHA256_EMPTY =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const SHA512_EMPTY =
  "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";

test("extractIocs parses mixed IOC types with normalization", () => {
  const input = `
Incident includes URL https://Example.com/login?next=%2Fdashboard#frag
Contact support@example.com
Observed IPs: 8.8.8.8 and 10.0.0.2
Hashes: ${MD5_EMPTY} ${SHA1_EMPTY} ${SHA256_EMPTY} ${SHA512_EMPTY}
Reference CVE-2024-12345 and cve-2023-9999
Standalone domain: login.microsoftonline.com
`;

  const result = extractIocs(input);

  assert.equal(result.counts.url, 1);
  assert.equal(result.items.url[0], "https://example.com/login?next=%2Fdashboard");

  assert.deepEqual(result.items.email, ["support@example.com"]);
  assert.equal(result.counts.domain, 2);
  assert.deepEqual(result.items.domain, [
    "example.com",
    "login.microsoftonline.com",
  ]);

  // Private IPv4 excluded by default.
  assert.deepEqual(result.items.ipv4, ["8.8.8.8"]);
  assert.equal(result.counts.ipv4, 1);

  assert.deepEqual(result.items.md5, [MD5_EMPTY]);
  assert.deepEqual(result.items.sha1, [SHA1_EMPTY]);
  assert.deepEqual(result.items.sha256, [SHA256_EMPTY]);
  assert.deepEqual(result.items.sha512, [SHA512_EMPTY]);
  assert.deepEqual(result.items.cve, ["CVE-2023-9999", "CVE-2024-12345"]);
});

test("extractIocs includes private/reserved IPs when enabled", () => {
  const result = extractIocs("10.10.10.10 ::1 2001:4860:4860::8888", {
    includePrivateIps: true,
  });

  assert.equal(result.counts.ipv4, 1);
  assert.equal(result.counts.ipv6, 2);
  assert.ok(result.items.ipv6.includes("::1"));
  assert.ok(result.items.ipv6.includes("2001:4860:4860::8888"));
});

test("extractIocs can disable domain derivation from URLs and emails", () => {
  const result = extractIocs(
    "https://portal.example.com/reset user@example.com",
    {
      includeDomainsFromUrls: false,
      includeDomainsFromEmails: false,
    },
  );

  assert.equal(result.counts.url, 1);
  assert.equal(result.counts.email, 1);
  assert.equal(result.counts.domain, 0);
});

test("flattenIocs returns flat entries matching total count", () => {
  const result = extractIocs(
    `https://example.com ${MD5_EMPTY} CVE-2025-1111 8.8.8.8`,
  );
  const flattened = flattenIocs(result);

  assert.equal(flattened.length, result.total);
  assert.ok(flattened.some((entry) => entry.type === "url"));
  assert.ok(flattened.some((entry) => entry.type === "md5"));
  assert.ok(flattened.some((entry) => entry.type === "cve"));
  assert.ok(flattened.some((entry) => entry.type === "ipv4"));
});
