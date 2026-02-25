import CryptoJS from "crypto-js";

export interface CertificateInfo {
    subject: string;
    issuer: string;
    validFrom: string;
    validTo: string;
    serialNumber: string;
    fingerprintSha256?: string;
    pemDetected: boolean;
    notes: string[];
}

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

export interface ParsedJWT {
    header: JsonObject;
    payload: JsonObject;
    signature: string;
    isValidFormat: true;
    signatureVerified: false;
    verificationNote: string;
    algorithm?: string;
    tokenType?: string;
    issuedAt?: string;
    expiresAt?: string;
    notBefore?: string;
    expired?: boolean;
    notYetValid?: boolean;
}

function decodeBase64UrlUtf8(input: string): string {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

    if (typeof atob !== "function") {
        throw new Error("Base64 decoding is unavailable in this runtime");
    }

    const binary = atob(padded);
    const percentEncoded = Array.from(binary)
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join("");

    return decodeURIComponent(percentEncoded);
}

function parseJwtSegment(segment: string, label: string): JsonObject {
    try {
        const decoded = decodeBase64UrlUtf8(segment);
        const parsed = JSON.parse(decoded);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            throw new Error();
        }
        return parsed as JsonObject;
    } catch {
        throw new Error(`Invalid JWT ${label}`);
    }
}

function epochToIso(value: unknown): string | undefined {
    if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
    const date = new Date(value * 1000);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString();
}

export function parseJWT(tokenInput: string): ParsedJWT {
    const token = tokenInput.trim().replace(/^bearer\s+/i, "");
    if (!token) throw new Error("JWT token is required");

    const parts = token.split(".");
    if (parts.length !== 3 || parts.some((part) => !part)) {
        throw new Error("Invalid JWT format");
    }

    const header = parseJwtSegment(parts[0], "header");
    const payload = parseJwtSegment(parts[1], "payload");
    const signature = parts[2];

    const now = Math.floor(Date.now() / 1000);
    const exp = typeof payload.exp === "number" ? payload.exp : undefined;
    const nbf = typeof payload.nbf === "number" ? payload.nbf : undefined;

    return {
        header,
        payload,
        signature,
        isValidFormat: true,
        signatureVerified: false,
        verificationNote: "Token structure decoded only. Signature verification is not performed by this tool.",
        algorithm: typeof header.alg === "string" ? header.alg : undefined,
        tokenType: typeof header.typ === "string" ? header.typ : undefined,
        issuedAt: epochToIso(payload.iat),
        expiresAt: epochToIso(payload.exp),
        notBefore: epochToIso(payload.nbf),
        expired: typeof exp === "number" ? exp <= now : undefined,
        notYetValid: typeof nbf === "number" ? nbf > now : undefined,
    };
}

export function generateUUID(): string {
    if (crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
        const random = Math.random() * 16 | 0;
        const value = char === "x" ? random : (random & 0x3) | 0x8;
        return value.toString(16);
    });
}

function randomIndex(maxExclusive: number): number {
    if (maxExclusive <= 0) {
        throw new Error("Maximum index must be greater than zero");
    }

    const maxUint32 = 0x100000000;
    const limit = Math.floor(maxUint32 / maxExclusive) * maxExclusive;
    const sample = new Uint32Array(1);
    let value = 0;

    do {
        crypto.getRandomValues(sample);
        value = sample[0];
    } while (value >= limit);

    return value % maxExclusive;
}

export function generatePassword(length: number, options: {
    uppercase: boolean;
    lowercase: boolean;
    numbers: boolean;
    symbols: boolean;
}): string {
    if (!Number.isInteger(length) || length < 1) {
        throw new Error("Password length must be a positive integer");
    }

    const pools: string[] = [];
    if (options.uppercase) pools.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    if (options.lowercase) pools.push("abcdefghijklmnopqrstuvwxyz");
    if (options.numbers) pools.push("0123456789");
    if (options.symbols) pools.push("!@#$%^&*()_+-=[]{}|;:,.<>?");

    if (pools.length === 0) {
        throw new Error("Select at least one character set");
    }
    if (length < pools.length) {
        throw new Error("Password length is too short for selected character sets");
    }

    const allChars = pools.join("");
    const passwordChars: string[] = [];

    // Ensure at least one character from each selected character class.
    pools.forEach((pool) => {
        passwordChars.push(pool[randomIndex(pool.length)]);
    });

    while (passwordChars.length < length) {
        passwordChars.push(allChars[randomIndex(allChars.length)]);
    }

    // Fisher-Yates shuffle with secure randomness.
    for (let i = passwordChars.length - 1; i > 0; i--) {
        const j = randomIndex(i + 1);
        const temp = passwordChars[i];
        passwordChars[i] = passwordChars[j];
        passwordChars[j] = temp;
    }

    return passwordChars.join("");
}

function extractField(input: string, pattern: RegExp, fallback: string): string {
    const match = input.match(pattern);
    return match && match[1] ? match[1].trim() : fallback;
}

export function parseCertificate(input: string): CertificateInfo {
    const text = input.trim();
    if (!text) {
        throw new Error("Certificate input is required");
    }

    const subject = extractField(text, /Subject:\s*(.+)$/im, "Unknown");
    const issuer = extractField(text, /Issuer:\s*(.+)$/im, "Unknown");
    const validFrom = extractField(text, /Not Before:\s*(.+)$/im, "N/A");
    const validTo = extractField(text, /Not After\s*:?\s*(.+)$/im, "N/A");
    const serialNumber = extractField(text, /Serial Number:\s*(.+)$/im, "N/A");

    const notes: string[] = [];
    let fingerprintSha256: string | undefined;
    let pemDetected = false;

    const pemMatch = text.match(
        /-----BEGIN CERTIFICATE-----([\s\S]+?)-----END CERTIFICATE-----/m,
    );
    if (pemMatch) {
        pemDetected = true;
        const base64Body = pemMatch[1].replace(/[\r\n\s]/g, "");
        if (/^[A-Za-z0-9+/=]+$/.test(base64Body)) {
            const wordArray = CryptoJS.enc.Base64.parse(base64Body);
            const hash = CryptoJS.SHA256(wordArray).toString().toUpperCase();
            const fingerprint = hash.match(/.{1,2}/g);
            fingerprintSha256 = fingerprint ? fingerprint.join(":") : hash;
        } else {
            notes.push("PEM block detected but base64 content appears malformed.");
        }
    }

    if (!pemDetected) {
        notes.push("No PEM block detected; parsed text fields only.");
    }
    if (subject === "Unknown" && issuer === "Unknown") {
        notes.push("Paste OpenSSL text output to extract subject/issuer fields.");
    }

    return {
        subject,
        issuer,
        validFrom,
        validTo,
        serialNumber,
        fingerprintSha256,
        pemDetected,
        notes,
    };
}
