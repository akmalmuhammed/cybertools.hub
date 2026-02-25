import assert from "node:assert/strict";
import test from "node:test";
import {
  parseKevCatalog,
  parseNvdFeedRecords,
  parseVulnerabilityRecords,
  runKevCvePrioritizer,
} from "../src/lib/utils/kev-prioritizer.js";

test("parseVulnerabilityRecords parses free-form vulnerability lines", () => {
  const records = parseVulnerabilityRecords(
    "CVE-2024-3094 cvss=10 epss=0.98 critical exploit\nCVE-2023-23397 cvss=9.8",
  );

  assert.equal(records.length, 2);
  assert.equal(records[0].cve, "CVE-2024-3094");
  assert.equal(records[0].assetCriticality, "critical");
  assert.equal(records[0].hasPublicExploit, true);
});

test("parseKevCatalog extracts KEV CVEs from arbitrary text", () => {
  const kev = parseKevCatalog("Known exploited: CVE-2024-3094 and cve-2023-23397");
  assert.equal(kev.has("CVE-2024-3094"), true);
  assert.equal(kev.has("CVE-2023-23397"), true);
});

test("runKevCvePrioritizer promotes KEV entries to highest priority", () => {
  const result = runKevCvePrioritizer(
    "CVE-2024-3094 cvss=10 epss=0.98 critical\nCVE-2021-1234 cvss=5.0 epss=0.02 low",
    "CVE-2024-3094",
  );

  assert.equal(result.summary.total, 2);
  assert.equal(result.items[0].cve, "CVE-2024-3094");
  assert.equal(result.items[0].priority, "P1");
  assert.ok(result.items[0].reasons.some((reason) => reason.includes("KEV")));
});

test("parseNvdFeedRecords ingests NVD feed JSON", () => {
  const nvdFeed = JSON.stringify({
    vulnerabilities: [
      {
        cve: {
          id: "CVE-2024-3094",
          metrics: {
            cvssMetricV31: [
              {
                cvssData: {
                  baseScore: 10,
                },
              },
            ],
          },
          references: [
            {
              url: "https://example.com/exploit",
              tags: ["Exploit"],
            },
          ],
        },
      },
    ],
  });

  const records = parseNvdFeedRecords(nvdFeed);
  assert.equal(records.length, 1);
  assert.equal(records[0].cve, "CVE-2024-3094");
  assert.equal(records[0].cvss, 10);
  assert.equal(records[0].hasPublicExploit, true);
});
