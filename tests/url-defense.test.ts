import "./setup.js";
import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalizeUrl,
  canonicalizeUrlsFromText,
  defangText,
  refangText,
} from "../src/lib/utils/url-defense.js";

test("defangText defangs protocol and hostname", () => {
  const input = "Visit https://Example.com/login?x=1#frag now";
  const output = defangText(input);
  assert.equal(
    output,
    "Visit hxxps://example[.]com/login?x=1#frag now",
  );
});

test("refangText restores protocol and host separators", () => {
  const input = "hxxps://portal[.]example[.]com/path";
  const output = refangText(input);
  assert.equal(output, "https://portal.example.com/path");
});

test("canonicalizeUrl normalizes host, default port, query, and fragment", () => {
  const result = canonicalizeUrl("HTTPS://Example.COM:443/a//b/?b=2&a=1#x");
  assert.equal(result.canonical, "https://example.com/a/b?a=1&b=2");
  assert.equal(result.host, "example.com");
  assert.equal(result.port, null);
});

test("canonicalizeUrlsFromText extracts unique URLs", () => {
  const result = canonicalizeUrlsFromText(
    "one https://example.com?a=1 two https://example.com?a=1 three http://example.com:80/path",
  );
  assert.equal(result.length, 2);
  assert.equal(result[0].host, "example.com");
});
