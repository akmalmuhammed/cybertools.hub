import assert from "node:assert/strict";
import test from "node:test";
import { simulateAlertDeduplication } from "../src/lib/utils/alert-dedupe.js";
import { runDetectionUnitHarness } from "../src/lib/utils/detection-unit-test.js";
import { buildAttackCoverageHeatmap } from "../src/lib/utils/attack-coverage.js";
import { composeIncidentTimeline } from "../src/lib/utils/event-timeline.js";
import { mapLogsToSchemaHints } from "../src/lib/utils/log-schema-mapper.js";
import { scoreIocConfidenceAndTtl } from "../src/lib/utils/ioc-confidence.js";
import { mapMispToStixBundle } from "../src/lib/utils/misp-stix-mapper.js";
import { buildArtifactIntegrityPackage } from "../src/lib/utils/artifact-integrity.js";
import { normalizeExposureImports } from "../src/lib/utils/exposure-normalizer.js";
import { analyzeFirewallAcl } from "../src/lib/utils/firewall-acl-analyzer.js";
import { explainTlsRisk } from "../src/lib/utils/tls-risk.js";
import { analyzeOpenApiAuthzGaps } from "../src/lib/utils/openapi-authz-gap.js";
import { analyzeCorsPolicy } from "../src/lib/utils/cors-policy.js";
import { minimizeScopesAndLintPolicy } from "../src/lib/utils/oauth-oidc-scope.js";
import { analyzeIamPolicy } from "../src/lib/utils/iam-policy-analyzer.js";
import { diffLockfileRisk } from "../src/lib/utils/lockfile-risk-diff.js";

test("simulateAlertDeduplication reduces repeated alerts", () => {
  const input = [
    '{"timestamp":"2026-02-25T00:00:00Z","ruleId":"rule-1","entity":"host-a","title":"Suspicious PowerShell","severity":"high"}',
    '{"timestamp":"2026-02-25T00:05:00Z","ruleId":"rule-1","entity":"host-a","title":"Suspicious PowerShell","severity":"high"}',
  ].join("\n");
  const result = simulateAlertDeduplication(input);
  assert.equal(result.totalAlerts, 2);
  assert.equal(result.uniqueAlerts, 1);
  assert.equal(result.reductionRate > 0, true);
});

test("runDetectionUnitHarness validates fixture expectations", () => {
  const payload = JSON.stringify({
    rule: [
      "title: Suspicious PowerShell",
      "detection:",
      "  selection:",
      "    Image|contains: powershell",
      "  condition: selection",
    ].join("\n"),
    fixtures: [
      { label: "hit", event: { Image: "powershell.exe" }, expectMatch: true },
      { label: "miss", event: { Image: "cmd.exe" }, expectMatch: false },
    ],
  });
  const result = runDetectionUnitHarness(payload);
  assert.equal(result.total, 2);
  assert.equal(result.failed, 0);
});

test("buildAttackCoverageHeatmap summarizes tags", () => {
  const result = buildAttackCoverageHeatmap(JSON.stringify([
    { title: "r1", tags: ["attack.execution", "attack.t1059.001"] },
    { title: "r2", tags: ["attack.persistence", "attack.t1547"] },
  ]));
  assert.equal(result.totalRules, 2);
  assert.equal(result.mappedRules, 2);
  assert.equal(result.tactics.length >= 2, true);
});

test("composeIncidentTimeline sorts events and detects gaps", () => {
  const result = composeIncidentTimeline([
    '{"timestamp":"2026-02-25T00:40:00Z","source":"SIEM","summary":"followup","severity":"high"}',
    '{"timestamp":"2026-02-25T00:00:00Z","source":"EDR","summary":"initial","severity":"medium"}',
  ].join("\n"));
  assert.equal(result.events[0].summary, "initial");
  assert.equal(result.gaps.length, 1);
});

test("mapLogsToSchemaHints maps common fields", () => {
  const result = mapLogsToSchemaHints('timestamp=2026-02-25T11:00:00Z src_ip=1.1.1.1 dst_ip=8.8.8.8 user=akmal');
  assert.equal(result.recordCount, 1);
  assert.equal(result.hints.some((hint) => hint.ecsField === "source.ip"), true);
});

test("scoreIocConfidenceAndTtl produces deterministic confidence values", () => {
  const result = scoreIocConfidenceAndTtl("malicious.example,domain,misp,2026-02-24T00:00:00Z,4", {
    nowIso: "2026-02-25T00:00:00Z",
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].confidence > 0, true);
  assert.equal(result.items[0].ttlDays >= 7, true);
});

test("mapMispToStixBundle maps supported MISP attributes", () => {
  const result = mapMispToStixBundle(JSON.stringify({
    Event: {
      Attribute: [{ type: "ip-dst", value: "8.8.8.8" }],
    },
  }));
  assert.equal(result.summary.mapped, 1);
  assert.equal(Array.isArray(result.bundle.objects), true);
});

test("buildArtifactIntegrityPackage creates deterministic package id", () => {
  const result = buildArtifactIntegrityPackage("sample.bin,sha256:abcdef", {
    custodyNotes: "Collected by analyst",
    createdAtIso: "2026-02-25T00:00:00Z",
  });
  assert.equal(result.summary.total, 1);
  assert.equal(result.packageId.length, 32);
});

test("normalizeExposureImports parses CSV exposure lines", () => {
  const result = normalizeExposureImports("host,port,protocol,service,status,source\n192.168.1.10,443,tcp,https,open,nmap");
  assert.equal(result.summary.total, 1);
  assert.equal(result.records[0].status, "open");
});

test("analyzeFirewallAcl flags permissive and conflicting rules", () => {
  const result = analyzeFirewallAcl("allow any any any any\ndeny tcp any any 443");
  assert.equal(result.summary.overPermissive >= 1, true);
  assert.equal(result.summary.conflict >= 1, true);
});

test("explainTlsRisk penalizes deprecated protocols", () => {
  const result = explainTlsRisk("Protocols: TLS1.0,TLS1.2\nCiphers: RC4-SHA");
  assert.equal(result.score < 100, true);
  assert.equal(result.findings.length > 0, true);
});

test("analyzeOpenApiAuthzGaps identifies unsecured operations", () => {
  const result = analyzeOpenApiAuthzGaps(JSON.stringify({
    openapi: "3.0.3",
    paths: {
      "/admin": {
        get: {
          responses: { 200: { description: "ok" } },
        },
      },
    },
  }));
  assert.equal(result.summary.operations, 1);
  assert.equal(result.summary.unsecured, 1);
});

test("analyzeCorsPolicy detects wildcard with credentials", () => {
  const result = analyzeCorsPolicy([
    "Access-Control-Allow-Origin: *",
    "Access-Control-Allow-Credentials: true",
  ].join("\n"));
  assert.equal(result.score < 70, true);
  assert.equal(result.findings.some((finding) => finding.severity === "critical"), true);
});

test("minimizeScopesAndLintPolicy flags excess scopes and weak token policy", () => {
  const result = minimizeScopesAndLintPolicy(JSON.stringify({
    requestedScopes: ["openid", "profile", "admin", "offline_access"],
    usedClaims: ["sub"],
    tokenPolicy: { accessTokenTtlMinutes: 120, pkceRequired: false },
  }));
  assert.equal(result.excessScopes.includes("admin"), true);
  assert.equal(result.findings.length >= 2, true);
});

test("analyzeIamPolicy flags wildcard AWS statement", () => {
  const result = analyzeIamPolicy(JSON.stringify({
    Version: "2012-10-17",
    Statement: [{ Effect: "Allow", Action: "*", Resource: "*" }],
  }));
  assert.equal(result.summary.critical >= 1, true);
});

test("diffLockfileRisk highlights suspicious added package", () => {
  const before = "left-pad@1.1.0\n@acme/core@2.0.0";
  const after = "left-pad@1.1.0\nacme-core@2.0.0";
  const result = diffLockfileRisk(before, after, "@acme");
  assert.equal(result.summary.added, 1);
  assert.equal(result.items[0].risk === "high" || result.items[0].risk === "medium", true);
});

test("local-first domain expansion utilities do not perform outbound fetch calls", () => {
  let fetchCallCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCallCount += 1;
    throw new Error("fetch should not be called in local-only utils");
  };

  try {
    simulateAlertDeduplication('{"ruleId":"r","entity":"h","title":"a"}');
    runDetectionUnitHarness(JSON.stringify({
      rule: "detection:\n  selection:\n    event: x\n  condition: selection",
      fixtures: [{ event: { event: "x" }, expectMatch: true }],
    }));
    composeIncidentTimeline('{"timestamp":"2026-02-25T00:00:00Z","source":"EDR","summary":"x","severity":"low"}');
    analyzeCorsPolicy("Access-Control-Allow-Origin: https://example.com");
    diffLockfileRisk("a@1.0.0", "a@1.0.1");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(fetchCallCount, 0);
});
