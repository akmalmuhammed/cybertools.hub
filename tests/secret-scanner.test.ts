import assert from "node:assert/strict";
import test from "node:test";
import { scanSecrets } from "../src/lib/utils/secret-scanner.js";

test("scanSecrets detects known credential patterns", () => {
  const awsLike = ["AKIA", "ABCDEFGHIJKLMNOP"].join("");
  const slackLike = ["xoxb", "1234567890", "abcdefghijklmnop"].join("-");
  const result = scanSecrets(`${awsLike} ${slackLike}`);

  assert.ok(result.findings.some((finding) => finding.type === "AWS Access Key ID"));
  assert.ok(result.findings.some((finding) => finding.type === "Slack Token"));
  assert.equal(result.summary.high >= 2, true);
});

test("scanSecrets detects private key blocks as critical", () => {
  const input = [
    "-----BEGIN PRIVATE KEY-----",
    "MIIEvQIBADANBgkqhkiG9w0BAQEFAASC...",
    "-----END PRIVATE KEY-----",
  ].join("\n");

  const result = scanSecrets(input, { enableEntropyScan: false });
  assert.ok(result.findings.some((finding) => finding.type === "Private Key Block"));
  assert.equal(result.summary.critical, 1);
});

test("scanSecrets includes entropy findings when enabled", () => {
  const entropyLike = "aA1bB2cC3dD4eE5fF6gG7hH8iI9jJ0kK1lL2mM3nN4oO5pP6qQ7rR8";
  const result = scanSecrets(entropyLike, {
    enableEntropyScan: true,
    entropyThreshold: 4.0,
  });

  assert.ok(result.findings.some((finding) => finding.type === "High-Entropy Token"));
});
