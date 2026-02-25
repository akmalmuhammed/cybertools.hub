import "./setup.js";
import assert from "node:assert/strict";
import test from "node:test";
import { generatePassword, parseCertificate, parseJWT } from "../src/lib/utils/crypto.js";

const sampleJwt =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ." +
  "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

test("parseJWT parses base64url payload and metadata", () => {
  const parsed = parseJWT(sampleJwt);
  assert.equal(parsed.header.alg, "HS256");
  assert.equal(parsed.payload.name, "John Doe");
  assert.equal(parsed.tokenType, "JWT");
  assert.equal(parsed.signature.length > 0, true);
});

test("parseJWT handles Bearer prefix", () => {
  const parsed = parseJWT(`Bearer ${sampleJwt}`);
  assert.equal(parsed.payload.sub, "1234567890");
});

test("generatePassword uses required character sets", () => {
  const password = generatePassword(32, {
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
  });

  assert.equal(password.length, 32);
  assert.match(password, /[A-Z]/);
  assert.match(password, /[a-z]/);
  assert.match(password, /[0-9]/);
  assert.match(password, /[^A-Za-z0-9]/);
});

test("parseCertificate extracts text fields and PEM fingerprint", () => {
  const certText = `Issuer: CN=Example CA
Subject: CN=api.example.com
Serial Number: 01:AB:CD
Not Before: Jan  1 00:00:00 2025 GMT
Not After : Jan  1 00:00:00 2027 GMT
-----BEGIN CERTIFICATE-----
AQID
-----END CERTIFICATE-----`;

  const parsed = parseCertificate(certText);
  assert.equal(parsed.issuer, "CN=Example CA");
  assert.equal(parsed.subject, "CN=api.example.com");
  assert.equal(parsed.serialNumber, "01:AB:CD");
  assert.equal(parsed.pemDetected, true);
  assert.match(parsed.fingerprintSha256 || "", /^([A-F0-9]{2}:){31}[A-F0-9]{2}$/);
});
