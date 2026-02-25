import "./setup.js";
import assert from "node:assert/strict";
import test from "node:test";
import { HeaderParser } from "../src/components/tools/email/HeaderParser.js";
import { SignalNormalizer } from "../src/components/tools/email/scoring/SignalNormalizer.js";

test("HeaderParser normalizes parsed header keys to lowercase", async () => {
  const raw = [
    "From: CEO <ceo@example.com>",
    "To: user@example.net",
    "Return-Path: <bounce@example.com>",
    "Authentication-Results: mx.example; spf=pass smtp.mailfrom=example.com; dkim=pass; dmarc=pass",
    "Received: from mail-a.example.com by mx1.example.net; Tue, 02 Jan 2024 10:00:00 +0000",
    "",
    "Body",
  ].join("\n");

  const result = await HeaderParser.parse(raw);
  assert.equal(result.headers["from"], "CEO <ceo@example.com>");
  assert.equal(result.headers["to"], "user@example.net");
  assert.equal(result.headers["return-path"], "<bounce@example.com>");
  assert.equal((result.headers as Record<string, unknown>)["From"], undefined);
});

test("HeaderParser scoring no longer double-counts baseline", async () => {
  const result = await HeaderParser.parse("From: user@example.com\n\nBody");

  assert.ok(result.score <= 35);
  assert.equal(result.verdict, "high_risk");
  assert.equal(
    result.scoreFactors.find((factor) => factor.label === "Base Score")?.score,
    50,
  );
});

test("SignalNormalizer marks authenticationResultsPresent only when auth header exists", async () => {
  const result = await HeaderParser.parse("From: user@example.com\n\nBody");
  const normalized = SignalNormalizer.normalize(result, null, {
    checkBody: false,
    checkAttachments: false,
  });

  assert.equal(normalized.authenticationResultsPresent, false);
});

test("SignalNormalizer detects reversed hop chronology", async () => {
  const raw = [
    "From: analyst@example.com",
    "Authentication-Results: mx.example; spf=pass; dkim=pass; dmarc=pass",
    "Received: from mx2.example.net by mx3.example.net; Tue, 02 Jan 2024 10:05:00 +0000",
    "Received: from mx1.example.net by mx2.example.net; Tue, 02 Jan 2024 10:00:00 +0000",
    "",
    "Body",
  ].join("\n");

  const parsed = await HeaderParser.parse(raw);
  assert.ok(parsed.hops.length >= 2);

  const reversed = {
    ...parsed,
    hops: [...parsed.hops].reverse(),
  };
  const normalized = SignalNormalizer.normalize(reversed, null, {
    checkBody: false,
    checkAttachments: false,
  });

  assert.equal(normalized.receivedTimestampsValid, false);
});
