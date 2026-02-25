import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeDmarcRecord,
  analyzeSpfRecord,
  extractDmarcRecord,
  extractSpfRecord,
  normalizeDnsQueryInput,
  runDnsToolkit,
} from "../src/lib/utils/dns-toolkit.js";

test("normalizeDnsQueryInput strips protocol and path", () => {
  const normalized = normalizeDnsQueryInput("https://WWW.Example.com/login");
  assert.equal(normalized, "example.com");
});

test("analyzeSpfRecord parses core mechanisms", () => {
  const spf = analyzeSpfRecord("v=spf1 include:_spf.example.com ~all");
  assert.equal(spf.includes[0], "_spf.example.com");
  assert.equal(spf.hasSoftFail, true);
  assert.equal(spf.hasHardFail, false);
});

test("analyzeDmarcRecord parses tags", () => {
  const dmarc = analyzeDmarcRecord(
    "v=DMARC1; p=reject; sp=quarantine; pct=50; rua=mailto:d@example.com",
  );
  assert.equal(dmarc.policy, "reject");
  assert.equal(dmarc.subdomainPolicy, "quarantine");
  assert.equal(dmarc.pct, 50);
  assert.deepEqual(dmarc.rua, ["mailto:d@example.com"]);
});

test("extractSpfRecord/extractDmarcRecord choose correct TXT entries", () => {
  const txt = ["google-site-verification=abc", "v=spf1 -all", "v=DMARC1; p=none"];
  assert.equal(extractSpfRecord(txt), "v=spf1 -all");
  assert.equal(extractDmarcRecord(txt), "v=DMARC1; p=none");
});

test("runDnsToolkit aggregates DNS lookups with mocked fetch", async () => {
  const fetchMock: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("name=example.com") && url.includes("type=TXT")) {
      return {
        ok: true,
        json: async () => ({
          Status: 0,
          Answer: [{ name: "example.com.", type: 16, TTL: 300, data: '"v=spf1 -all"' }],
        }),
      } as Response;
    }
    if (url.includes("name=_dmarc.example.com") && url.includes("type=TXT")) {
      return {
        ok: true,
        json: async () => ({
          Status: 0,
          Answer: [
            {
              name: "_dmarc.example.com.",
              type: 16,
              TTL: 300,
              data: '"v=DMARC1; p=reject; rua=mailto:sec@example.com"',
            },
          ],
        }),
      } as Response;
    }

    return {
      ok: true,
      json: async () => ({ Status: 0, Answer: [] }),
    } as Response;
  };

  const result = await runDnsToolkit("example.com", ["TXT", "MX"], {
    fetchImpl: fetchMock,
    timeoutMs: 2000,
  });

  assert.equal(result.domain, "example.com");
  assert.equal(result.spf?.hasHardFail, true);
  assert.equal(result.dmarc?.policy, "reject");
  assert.equal(result.queries.length, 2);
});
