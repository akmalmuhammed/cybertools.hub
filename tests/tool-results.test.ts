import assert from "node:assert/strict";
import test from "node:test";
import {
  buildToolResultEnvelope,
  envelopeToMarkdown,
  parseToolResultEnvelope,
  recordsToCsv,
} from "../src/lib/utils/tool-results.js";

test("parseToolResultEnvelope preserves standard envelopes", () => {
  const envelope = buildToolResultEnvelope({
    toolName: "Unit Test Tool",
    summary: {
      status: "ok",
      score: 93,
      title: "Baseline",
      text: "All controls passed.",
    },
    findings: [
      {
        id: "finding-1",
        severity: "low",
        confidence: 92,
        category: "validation",
        title: "Header present",
        description: "CSP header is present.",
      },
    ],
    evidence: [{ header: "content-security-policy" }],
    recommendations: ["Keep strict-dynamic disabled until nonce rollout completes."],
    exports: [],
  });

  const parsed = parseToolResultEnvelope(JSON.stringify(envelope), "Unit Test Tool");
  assert.equal(parsed.summary.score, 93);
  assert.equal(parsed.findings.length, 1);
  assert.equal(parsed.evidence.length, 1);
});

test("parseToolResultEnvelope adapts legacy objects to findings/evidence", () => {
  const legacy = {
    summary: {
      total: 2,
      high: 1,
    },
    items: [
      { type: "CORS wildcard", riskLevel: "high", description: "Wildcard origin with credentials." },
      { type: "Missing HSTS", riskLevel: "medium", description: "No strict transport security header." },
    ],
    notes: ["Legacy result shape."],
  };

  const parsed = parseToolResultEnvelope(JSON.stringify(legacy), "Legacy Tool");
  assert.equal(parsed.findings.length, 2);
  assert.equal(parsed.evidence.length >= 2, true);
  assert.equal(parsed.recommendations.length, 1);
});

test("recordsToCsv and envelopeToMarkdown produce export-safe text", () => {
  const csv = recordsToCsv([
    { cve: "CVE-2024-3094", score: 98 },
    { cve: "CVE-2023-23397", score: 71 },
  ]);
  assert.equal(csv.includes("cve"), true);
  assert.equal(csv.includes("CVE-2024-3094"), true);

  const markdown = envelopeToMarkdown("KEV/CVE Prioritizer", {
    summary: {
      status: "warning",
      score: 78,
      title: "Prioritization",
      text: "Two vulnerabilities need attention.",
    },
    findings: [
      {
        id: "finding-1",
        severity: "high",
        confidence: 88,
        category: "vuln-priority",
        title: "KEV entry",
        description: "CVE listed in KEV with exploit signal.",
      },
    ],
    evidence: [{ cve: "CVE-2024-3094" }],
    recommendations: ["Patch KEV entries first."],
    exports: [],
  });

  assert.equal(markdown.includes("# KEV/CVE Prioritizer report"), true);
  assert.equal(markdown.includes("Patch KEV entries first."), true);
});

