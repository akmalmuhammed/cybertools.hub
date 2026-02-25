import assert from "node:assert/strict";
import test from "node:test";
import {
  enrichBulkReputation,
  parseBulkIndicators,
} from "../src/lib/utils/reputation.js";

test("parseBulkIndicators extracts unique domains and IPs", () => {
  const indicators = parseBulkIndicators(
    "8.8.8.8 example.com 8.8.8.8 https://portal.example.com/path",
  );

  assert.equal(indicators.filter((indicator) => indicator.type === "ip").length, 1);
  assert.ok(
    indicators.some(
      (indicator) => indicator.type === "domain" && indicator.value === "example.com",
    ),
  );
  assert.ok(
    indicators.some(
      (indicator) =>
        indicator.type === "domain" && indicator.value === "portal.example.com",
    ),
  );
});

test("enrichBulkReputation returns local-only results when no provider selected", async () => {
  const result = await enrichBulkReputation("10.0.0.1 example.com", {
    includeRdap: false,
    provider: "none",
  });

  assert.equal(result.summary.total, 2);
  assert.ok(result.items.some((item) => item.indicator.value === "10.0.0.1"));
  assert.ok(result.items.some((item) => item.indicator.value === "example.com"));
});

test("enrichBulkReputation applies provider proxy score when mocked (abuseipdb)", async () => {
  const fetchMock: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("proxy.example")) {
      const request = JSON.parse(String(init?.body ?? "{}")) as {
        provider?: string;
        indicator?: { value?: string };
      };
      assert.equal(request.provider, "abuseipdb");
      assert.equal(request.indicator?.value, "8.8.8.8");
      return {
        ok: true,
        json: async () => ({
          scoreDelta: 65,
          details: ["AbuseIPDB proxy confidence score: 90."],
          providerData: { abuseConfidenceScore: 90, totalReports: 123 },
        }),
      } as Response;
    }

    return {
      ok: true,
      json: async () => ({
        handle: "NET-8-8-8-0-1",
        name: "GOOGLE",
        country: "US",
      }),
    } as Response;
  };

  const result = await enrichBulkReputation("8.8.8.8", {
    provider: "abuseipdb",
    providerProxyUrl: "https://proxy.example/reputation",
    includeRdap: false,
    fetchImpl: fetchMock,
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].riskLevel, "high");
  assert.ok(result.items[0].details.some((detail) => detail.includes("proxy")));
});

test("enrichBulkReputation applies provider proxy score when mocked (virustotal)", async () => {
  const fetchMock: typeof fetch = async () =>
    ({
      ok: true,
      json: async () => ({
        scoreDelta: 61,
        details: ["VirusTotal proxy detections: malicious=3, suspicious=2."],
        providerData: { malicious: 3, suspicious: 2, harmless: 10, undetected: 20 },
      }),
    }) as Response;

  const result = await enrichBulkReputation("example.com", {
    provider: "virustotal",
    providerProxyUrl: "https://proxy.example/reputation",
    includeRdap: false,
    fetchImpl: fetchMock,
  });

  assert.equal(result.items.length, 1);
  assert.ok(result.items[0].riskScore >= 70);
  assert.equal(result.items[0].riskLevel, "high");
});

test("enrichBulkReputation warns when provider is set without proxy URL", async () => {
  const result = await enrichBulkReputation("8.8.8.8", {
    provider: "abuseipdb",
    includeRdap: false,
  });
  assert.ok(result.notes.some((note) => note.toLowerCase().includes("proxy")));
});
