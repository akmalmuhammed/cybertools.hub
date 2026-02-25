import "./setup.js";
import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyIp,
  lookupIpIntel,
  normalizeIpInput,
  parseRdapIpResponse,
} from "../src/lib/utils/ip-intel.js";
import { assessPorts, parsePortCheckerInput } from "../src/lib/utils/port-intel.js";
import {
  isValidDomain,
  lookupWhois,
  normalizeDomainInput,
  parseRdapDomainResponse,
} from "../src/lib/utils/whois.js";

test("normalizeDomainInput strips protocol and path", () => {
  const normalized = normalizeDomainInput("https://www.Example.com/path");
  assert.equal(normalized, "example.com");
  assert.equal(isValidDomain(normalized), true);
});

test("parseRdapDomainResponse extracts core WHOIS fields", () => {
  const parsed = parseRdapDomainResponse({
    ldhName: "example.com",
    status: ["client transfer prohibited"],
    events: [
      { eventAction: "registration", eventDate: "2020-01-01T00:00:00Z" },
      { eventAction: "expiration", eventDate: "2030-01-01T00:00:00Z" },
    ],
    entities: [
      {
        roles: ["registrar"],
        vcardArray: [[], [["org", {}, "text", "Example Registrar"]]],
      },
    ],
    nameservers: [{ ldhName: "ns1.example.com" }, { ldhName: "ns2.example.com" }],
    secureDNS: { delegationSigned: true },
  });

  assert.equal(parsed.domain, "example.com");
  assert.equal(parsed.registrar, "Example Registrar");
  assert.equal(parsed.expiresAt, "2030-01-01T00:00:00Z");
  assert.deepEqual(parsed.nameservers, ["ns1.example.com", "ns2.example.com"]);
  assert.equal(parsed.dnssec, "signed");
});

test("normalizeIpInput strips URL and keeps host IP", () => {
  assert.equal(normalizeIpInput("https://8.8.8.8:443/path"), "8.8.8.8");
});

test("classifyIp marks private/public IPv4 correctly", () => {
  assert.equal(classifyIp("10.0.0.1").scope, "private");
  assert.equal(classifyIp("8.8.8.8").scope, "public");
});

test("parseRdapIpResponse extracts summary fields", () => {
  const parsed = parseRdapIpResponse({
    handle: "NET-8-8-8-0-1",
    name: "GOOGLE",
    startAddress: "8.8.8.0",
    endAddress: "8.8.8.255",
    country: "US",
    entities: [
      {
        vcardArray: [[], [["org", {}, "text", "Google LLC"]]],
      },
    ],
  });

  assert.equal(parsed.handle, "NET-8-8-8-0-1");
  assert.equal(parsed.name, "GOOGLE");
  assert.deepEqual(parsed.entities, ["Google LLC"]);
});

test("parsePortCheckerInput supports host + explicit ports", () => {
  const parsed = parsePortCheckerInput("example.com 22,80,443");
  assert.equal(parsed.host, "example.com");
  assert.deepEqual(parsed.ports, [22, 80, 443]);
});

test("assessPorts returns deterministic intelligence when probing disabled", async () => {
  const report = await assessPorts("example.com 22,443", { probeWebPorts: false });
  assert.equal(report.host, "example.com");
  assert.equal(report.results.length, 2);
  assert.equal(report.results[0].state, "not_tested");
  assert.equal(report.results[1].service, "https");
});

test("lookupWhois maps timeout to user-facing error", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.reject(
      new DOMException("Request aborted", "AbortError"),
    )) as typeof fetch;
  try {
    await assert.rejects(
      () => lookupWhois("example.com", { timeoutMs: 10 }),
      /timed out/i,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("lookupIpIntel returns RDAP source when fetch succeeds", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    ({
      ok: true,
      json: async () => ({
        handle: "NET-8-8-8-0-1",
        name: "GOOGLE",
        country: "US",
      }),
    }) as Response;

  try {
    const result = await lookupIpIntel("8.8.8.8", true, 10);
    assert.equal(result.source, "rdap");
    assert.equal(result.rdap?.handle, "NET-8-8-8-0-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
