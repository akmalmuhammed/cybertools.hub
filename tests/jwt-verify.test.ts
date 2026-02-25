import "./setup.js";
import assert from "node:assert/strict";
import test from "node:test";
import { parseJws, verifyJwsSignature } from "../src/lib/utils/jwt-verify.js";

function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? Buffer.from(input, "utf8") : Buffer.from(input);
  return bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function toPem(spki: ArrayBuffer): string {
  const b64 = Buffer.from(spki).toString("base64");
  const lines = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----`;
}

async function signHsToken(
  secret: string,
  payload: Record<string, unknown> = { sub: "alice", iat: 1700000000 },
): Promise<string> {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadSegment = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${header}.${payloadSegment}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

test("parseJws decodes header and payload", () => {
  const token =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyIn0.x";
  const parsed = parseJws(token);
  assert.equal(parsed.header.alg, "HS256");
  assert.equal(parsed.payload.sub, "user");
});

test("verifyJwsSignature verifies HS256 token", async () => {
  const token = await signHsToken("supersecret");
  const result = await verifyJwsSignature(token, {
    keySource: { kind: "secret", secret: "supersecret" },
  });

  assert.equal(result.valid, true);
  assert.equal(result.algorithm, "HS256");
});

test("verifyJwsSignature rejects HS256 token with wrong secret", async () => {
  const token = await signHsToken("correct");
  const result = await verifyJwsSignature(token, {
    keySource: { kind: "secret", secret: "wrong" },
  });

  assert.equal(result.valid, false);
});

test("verifyJwsSignature verifies RS256 token with PEM key", async () => {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );

  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify({ sub: "bob" }));
  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    keyPair.privateKey,
    new TextEncoder().encode(signingInput),
  );
  const token = `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;

  const spki = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const pem = toPem(spki);

  const result = await verifyJwsSignature(token, {
    keySource: { kind: "pem", pem },
  });

  assert.equal(result.valid, true);
  assert.equal(result.algorithm, "RS256");
});

test("verifyJwsSignature resolves key from JWKS URL", async () => {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const publicJwk = (await crypto.subtle.exportKey("jwk", keyPair.publicKey)) as JsonWebKey & {
    kid?: string;
    alg?: string;
    use?: string;
  };
  publicJwk.kid = "kid-1";
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";

  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", kid: "kid-1" }));
  const payload = base64UrlEncode(JSON.stringify({ sub: "service" }));
  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    keyPair.privateKey,
    new TextEncoder().encode(signingInput),
  );
  const token = `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    ({
      ok: true,
      json: async () => ({ keys: [publicJwk] }),
    }) as Response;

  try {
    const result = await verifyJwsSignature(token, {
      keySource: { kind: "jwks-url", url: "https://example.com/jwks.json" },
    });
    assert.equal(result.valid, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("verifyJwsSignature flags expired token when time-claim validation is enabled", async () => {
  const token = await signHsToken("supersecret", {
    sub: "alice",
    exp: 1000,
  });
  const result = await verifyJwsSignature(token, {
    keySource: { kind: "secret", secret: "supersecret" },
    validateTimeClaims: true,
    nowMs: 2_000_000_000_000,
  });

  assert.equal(result.signatureVerified, true);
  assert.equal(result.claimsValid, false);
  assert.equal(result.valid, false);
  assert.ok(result.claimErrors.some((error) => error.toLowerCase().includes("expired")));
});

test("verifyJwsSignature validates issuer and audience expectations", async () => {
  const token = await signHsToken("supersecret", {
    sub: "alice",
    iss: "https://issuer.example",
    aud: ["api://service-a", "api://service-b"],
    exp: 4_000_000_000,
  });
  const result = await verifyJwsSignature(token, {
    keySource: { kind: "secret", secret: "supersecret" },
    expectedIssuer: "https://issuer.example",
    expectedAudience: "api://service-b",
    nowMs: 1_900_000_000_000,
  });

  assert.equal(result.signatureVerified, true);
  assert.equal(result.claimsValid, true);
  assert.equal(result.valid, true);
});
