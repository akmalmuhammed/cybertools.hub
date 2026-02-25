type JwtObject = Record<string, unknown>;

export type SupportedJwtAlgorithm =
  | "HS256"
  | "HS384"
  | "HS512"
  | "RS256"
  | "RS384"
  | "RS512"
  | "PS256"
  | "PS384"
  | "PS512";

export type JwtKeySource =
  | { kind: "secret"; secret: string }
  | { kind: "pem"; pem: string }
  | { kind: "jwk"; jwk: JsonWebKey | string }
  | { kind: "jwks-url"; url: string };

export interface ParsedJwsToken {
  raw: string;
  signingInput: string;
  headerSegment: string;
  payloadSegment: string;
  signatureSegment: string;
  header: JwtObject;
  payload: JwtObject;
}

export interface VerifyJwsOptions {
  keySource: JwtKeySource;
  expectedAlgorithm?: SupportedJwtAlgorithm;
  timeoutMs?: number;
  expectedIssuer?: string;
  expectedAudience?: string;
  expectedSubject?: string;
  validateTimeClaims?: boolean;
  clockSkewSec?: number;
  nowMs?: number;
}

export interface VerifyJwsResult {
  valid: boolean;
  signatureVerified: boolean;
  claimsValid: boolean;
  claimErrors: string[];
  algorithm: SupportedJwtAlgorithm | null;
  keySource: JwtKeySource["kind"];
  header: JwtObject;
  payload: JwtObject;
  keyId: string | null;
  reason?: string;
}

const HASH_ALGORITHMS: Record<SupportedJwtAlgorithm, "SHA-256" | "SHA-384" | "SHA-512"> = {
  HS256: "SHA-256",
  HS384: "SHA-384",
  HS512: "SHA-512",
  RS256: "SHA-256",
  RS384: "SHA-384",
  RS512: "SHA-512",
  PS256: "SHA-256",
  PS384: "SHA-384",
  PS512: "SHA-512",
};

function isSupportedAlgorithm(value: string): value is SupportedJwtAlgorithm {
  return value in HASH_ALGORITHMS;
}

function utf8Encode(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

function utf8Decode(input: Uint8Array): string {
  return new TextDecoder().decode(input);
}

function toArrayBuffer(input: Uint8Array): ArrayBuffer {
  return Uint8Array.from(input).buffer;
}

function base64UrlToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToBase64Url(input: Uint8Array): string {
  const binary = Array.from(input)
    .map((value) => String.fromCharCode(value))
    .join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function parseJsonSegment(segment: string, label: string): JwtObject {
  try {
    const decoded = utf8Decode(base64UrlToBytes(segment));
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error();
    }
    return parsed as JwtObject;
  } catch {
    throw new Error(`Invalid JWT ${label}`);
  }
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/[\r\n\s]/g, "");
  if (!body) throw new Error("Invalid PEM input");
  return toArrayBuffer(base64UrlToBytes(body.replace(/\+/g, "-").replace(/\//g, "_")));
}

function parseJwkInput(jwk: JsonWebKey | string): JsonWebKey {
  if (typeof jwk === "string") {
    const parsed = JSON.parse(jwk);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Invalid JWK payload");
    }
    return parsed as JsonWebKey;
  }
  return jwk;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

function hashLengthBytes(hash: "SHA-256" | "SHA-384" | "SHA-512"): number {
  if (hash === "SHA-256") return 32;
  if (hash === "SHA-384") return 48;
  return 64;
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function importSecretKey(secret: string, hash: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(utf8Encode(secret)),
    { name: "HMAC", hash: { name: hash } },
    false,
    ["sign"],
  );
}

async function importPemKey(
  pem: string,
  alg: SupportedJwtAlgorithm,
): Promise<CryptoKey> {
  const hash = HASH_ALGORITHMS[alg];
  const keyData = pemToArrayBuffer(pem);
  if (alg.startsWith("PS")) {
    return crypto.subtle.importKey(
      "spki",
      keyData,
      { name: "RSA-PSS", hash: { name: hash } },
      false,
      ["verify"],
    );
  }

  return crypto.subtle.importKey(
    "spki",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: { name: hash } },
    false,
    ["verify"],
  );
}

async function importJwkKey(
  jwk: JsonWebKey,
  alg: SupportedJwtAlgorithm,
): Promise<CryptoKey> {
  const hash = HASH_ALGORITHMS[alg];

  if (alg.startsWith("HS")) {
    if (jwk.kty !== "oct" || !jwk.k) {
      throw new Error("Expected symmetric oct JWK for HS* verification.");
    }
    const secretBytes = base64UrlToBytes(jwk.k);
    return crypto.subtle.importKey(
      "raw",
      toArrayBuffer(secretBytes),
      { name: "HMAC", hash: { name: hash } },
      false,
      ["sign"],
    );
  }

  if (alg.startsWith("PS")) {
    return crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSA-PSS", hash: { name: hash } },
      false,
      ["verify"],
    );
  }

  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: { name: hash } },
    false,
    ["verify"],
  );
}

function pickJwkFromSet(
  keys: JsonWebKey[],
  header: JwtObject,
  alg: SupportedJwtAlgorithm,
): JsonWebKey | null {
  const kid = typeof header.kid === "string" ? header.kid : null;
  if (kid) {
    const exact = keys.find(
      (key) => (key as Record<string, unknown>).kid === kid,
    );
    if (exact) return exact;
  }

  const byAlg = keys.find((key) => !key.alg || key.alg === alg);
  if (byAlg) return byAlg;

  return keys[0] ?? null;
}

async function resolveVerificationKey(
  alg: SupportedJwtAlgorithm,
  header: JwtObject,
  keySource: JwtKeySource,
  timeoutMs: number,
): Promise<CryptoKey> {
  if (keySource.kind === "secret") {
    if (!alg.startsWith("HS")) {
      throw new Error("Secret key source can only verify HS* tokens.");
    }
    return importSecretKey(keySource.secret, HASH_ALGORITHMS[alg]);
  }

  if (keySource.kind === "pem") {
    if (alg.startsWith("HS")) {
      throw new Error("PEM key source cannot verify HS* tokens.");
    }
    return importPemKey(keySource.pem, alg);
  }

  if (keySource.kind === "jwk") {
    const jwk = parseJwkInput(keySource.jwk);
    return importJwkKey(jwk, alg);
  }

  const response = await fetchWithTimeout(keySource.url, timeoutMs);
  if (!response.ok) {
    throw new Error(`JWKS fetch failed with HTTP ${response.status}.`);
  }

  const payload = await response.json();
  const keys = Array.isArray((payload as Record<string, unknown>).keys)
    ? ((payload as Record<string, unknown>).keys as JsonWebKey[])
    : [];
  if (!keys.length) {
    throw new Error("JWKS response contains no keys.");
  }

  const selected = pickJwkFromSet(keys, header, alg);
  if (!selected) {
    throw new Error("No suitable key found in JWKS.");
  }

  return importJwkKey(selected, alg);
}

function verifyHmacMatch(
  expectedSignature: Uint8Array,
  generatedSignature: ArrayBuffer,
): boolean {
  return constantTimeEqual(expectedSignature, new Uint8Array(generatedSignature));
}

function validateClaims(payload: JwtObject, options: VerifyJwsOptions): string[] {
  const errors: string[] = [];
  const nowMs = options.nowMs ?? Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  const clockSkewSec = Math.max(0, Number(options.clockSkewSec ?? 60));
  const validateTimeClaims = options.validateTimeClaims ?? true;

  const exp = typeof payload.exp === "number" ? payload.exp : null;
  if (validateTimeClaims && exp !== null && nowSec > exp + clockSkewSec) {
    errors.push("Token is expired.");
  }

  const nbf = typeof payload.nbf === "number" ? payload.nbf : null;
  if (validateTimeClaims && nbf !== null && nowSec + clockSkewSec < nbf) {
    errors.push("Token is not yet valid (nbf).");
  }

  if (options.expectedIssuer) {
    const iss = typeof payload.iss === "string" ? payload.iss : null;
    if (iss !== options.expectedIssuer) {
      errors.push(`Issuer mismatch: expected ${options.expectedIssuer}.`);
    }
  }

  if (options.expectedSubject) {
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    if (sub !== options.expectedSubject) {
      errors.push(`Subject mismatch: expected ${options.expectedSubject}.`);
    }
  }

  if (options.expectedAudience) {
    const aud = payload.aud;
    const audiences = Array.isArray(aud)
      ? aud.filter((value): value is string => typeof value === "string")
      : typeof aud === "string"
        ? [aud]
        : [];
    if (!audiences.includes(options.expectedAudience)) {
      errors.push(`Audience mismatch: expected ${options.expectedAudience}.`);
    }
  }

  return errors;
}

export function parseJws(tokenInput: string): ParsedJwsToken {
  const token = tokenInput.trim().replace(/^bearer\s+/i, "");
  if (!token) throw new Error("JWT token is required.");

  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new Error("Invalid JWT format.");
  }

  const header = parseJsonSegment(parts[0], "header");
  const payload = parseJsonSegment(parts[1], "payload");

  return {
    raw: token,
    signingInput: `${parts[0]}.${parts[1]}`,
    headerSegment: parts[0],
    payloadSegment: parts[1],
    signatureSegment: parts[2],
    header,
    payload,
  };
}

export async function verifyJwsSignature(
  tokenInput: string,
  options: VerifyJwsOptions,
): Promise<VerifyJwsResult> {
  const parsed = parseJws(tokenInput);
  const declaredAlg = typeof parsed.header.alg === "string" ? parsed.header.alg : null;

  if (!declaredAlg || !isSupportedAlgorithm(declaredAlg)) {
    throw new Error("Unsupported or missing JWT algorithm.");
  }

  if (options.expectedAlgorithm && options.expectedAlgorithm !== declaredAlg) {
    return {
      valid: false,
      signatureVerified: false,
      claimsValid: false,
      claimErrors: ["Claims were not evaluated because signature verification was not attempted."],
      algorithm: declaredAlg,
      keySource: options.keySource.kind,
      header: parsed.header,
      payload: parsed.payload,
      keyId: typeof parsed.header.kid === "string" ? parsed.header.kid : null,
      reason: `Algorithm mismatch: expected ${options.expectedAlgorithm}, got ${declaredAlg}.`,
    };
  }

  const timeoutMs = options.timeoutMs ?? 8000;
  const verificationKey = await resolveVerificationKey(
    declaredAlg,
    parsed.header,
    options.keySource,
    timeoutMs,
  );
  const signatureBytes = base64UrlToBytes(parsed.signatureSegment);
  const signingBytes = utf8Encode(parsed.signingInput);

  if (declaredAlg.startsWith("HS")) {
    const generated = await crypto.subtle.sign(
      "HMAC",
      verificationKey,
      toArrayBuffer(signingBytes),
    );
    const signatureVerified = verifyHmacMatch(signatureBytes, generated);
    const claimErrors = signatureVerified ? validateClaims(parsed.payload, options) : ["Claims were not evaluated because signature verification failed."];
    const claimsValid = signatureVerified && claimErrors.length === 0;
    const valid = signatureVerified && claimsValid;
    return {
      valid,
      signatureVerified,
      claimsValid,
      claimErrors,
      algorithm: declaredAlg,
      keySource: options.keySource.kind,
      header: parsed.header,
      payload: parsed.payload,
      keyId: typeof parsed.header.kid === "string" ? parsed.header.kid : null,
      reason: !signatureVerified
        ? "HMAC signature mismatch."
        : claimErrors[0],
    };
  }

  if (declaredAlg.startsWith("PS")) {
    const hash = HASH_ALGORITHMS[declaredAlg];
    const signatureVerified = await crypto.subtle.verify(
      { name: "RSA-PSS", saltLength: hashLengthBytes(hash) },
      verificationKey,
      toArrayBuffer(signatureBytes),
      toArrayBuffer(signingBytes),
    );
    const claimErrors = signatureVerified ? validateClaims(parsed.payload, options) : ["Claims were not evaluated because signature verification failed."];
    const claimsValid = signatureVerified && claimErrors.length === 0;
    const valid = signatureVerified && claimsValid;
    return {
      valid,
      signatureVerified,
      claimsValid,
      claimErrors,
      algorithm: declaredAlg,
      keySource: options.keySource.kind,
      header: parsed.header,
      payload: parsed.payload,
      keyId: typeof parsed.header.kid === "string" ? parsed.header.kid : null,
      reason: !signatureVerified
        ? "RSA-PSS signature mismatch."
        : claimErrors[0],
    };
  }

  const signatureVerified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    verificationKey,
    toArrayBuffer(signatureBytes),
    toArrayBuffer(signingBytes),
  );
  const claimErrors = signatureVerified ? validateClaims(parsed.payload, options) : ["Claims were not evaluated because signature verification failed."];
  const claimsValid = signatureVerified && claimErrors.length === 0;
  const valid = signatureVerified && claimsValid;
  return {
    valid,
    signatureVerified,
    claimsValid,
    claimErrors,
    algorithm: declaredAlg,
    keySource: options.keySource.kind,
    header: parsed.header,
    payload: parsed.payload,
    keyId: typeof parsed.header.kid === "string" ? parsed.header.kid : null,
    reason: !signatureVerified
      ? "RSA signature mismatch."
      : claimErrors[0],
  };
}

export function createUnsignedJwt(header: JwtObject, payload: JwtObject): string {
  const headerSegment = bytesToBase64Url(utf8Encode(JSON.stringify(header)));
  const payloadSegment = bytesToBase64Url(utf8Encode(JSON.stringify(payload)));
  return `${headerSegment}.${payloadSegment}`;
}
