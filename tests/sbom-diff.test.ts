import assert from "node:assert/strict";
import test from "node:test";
import { diffSboms } from "../src/lib/utils/sbom-diff.js";

test("diffSboms detects version upgrades", () => {
  const before = JSON.stringify({
    bomFormat: "CycloneDX",
    components: [{ name: "openssl", version: "3.0.12" }],
  });
  const after = JSON.stringify({
    bomFormat: "CycloneDX",
    components: [{ name: "openssl", version: "3.0.13" }],
  });

  const result = diffSboms(before, after);
  assert.equal(result.summary.upgraded, 1);
  assert.equal(result.items[0].change, "upgraded");
});

test("diffSboms raises risk when vulnerability hints are present", () => {
  const before = JSON.stringify({
    bomFormat: "CycloneDX",
    components: [{ name: "openssl", version: "3.0.12" }],
  });
  const after = JSON.stringify({
    bomFormat: "CycloneDX",
    components: [{ name: "openssl", version: "3.0.13" }],
  });

  const result = diffSboms(before, after, "openssl,CVE-2024-5535,critical");
  assert.equal(result.items[0].risk === "high" || result.items[0].risk === "critical", true);
  assert.equal(result.items[0].vulnerabilities.length, 1);
});
