interface GenericObject {
  [key: string]: unknown;
}

export interface TlsRiskFinding {
  severity: "low" | "medium" | "high" | "critical";
  issue: string;
  evidence: string;
  recommendation: string;
}

export interface TlsRiskResult {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  findings: TlsRiskFinding[];
  parsed: {
    protocols: string[];
    ciphers: string[];
    certificateExpiry: string | null;
    selfSigned: boolean;
  };
}

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseInput(input: string): { protocols: string[]; ciphers: string[]; expiry: string | null; selfSigned: boolean } {
  if (!input.trim()) {
    return { protocols: [], ciphers: [], expiry: null, selfSigned: false };
  }

  try {
    const parsed = JSON.parse(input);
    if (parsed && typeof parsed === "object") {
      const payload = parsed as GenericObject;
      return {
        protocols: normalizeList(payload.protocols ?? payload.supportedProtocols),
        ciphers: normalizeList(payload.ciphers ?? payload.supportedCiphers),
        expiry: payload.expiresOn ? String(payload.expiresOn) : payload.certificateExpiry ? String(payload.certificateExpiry) : null,
        selfSigned: Boolean(payload.selfSigned ?? payload.isSelfSigned),
      };
    }
  } catch {
    // fallback to text parser
  }

  const protocols = [...input.matchAll(/tls\s*1\.[0-3]|ssl\s*[23]/gi)].map((match) => match[0].replace(/\s+/g, "").toUpperCase());
  const ciphers = [...input.matchAll(/\b(?:RC4|3DES|DES|NULL|MD5|SHA1|ECDHE|AES256|CHACHA20)[A-Z0-9_-]*\b/gi)]
    .map((match) => match[0].toUpperCase());
  const expiryMatch = input.match(/(?:expires|expiry|notAfter)\s*[:=]\s*([0-9TZ:.\-+ ]+)/i);
  const selfSigned = /self[-\s]?signed\s*[:=]?\s*(true|yes|1)/i.test(input);

  return {
    protocols,
    ciphers,
    expiry: expiryMatch ? expiryMatch[1].trim() : null,
    selfSigned,
  };
}

function gradeFromScore(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function explainTlsRisk(input: string): TlsRiskResult {
  const parsed = parseInput(input);
  let score = 100;
  const findings: TlsRiskFinding[] = [];

  const protocols = parsed.protocols.map((protocol) => protocol.toUpperCase());
  if (protocols.some((protocol) => protocol.includes("SSL2") || protocol.includes("SSL3"))) {
    score -= 40;
    findings.push({
      severity: "critical",
      issue: "Legacy SSL protocol enabled",
      evidence: "SSLv2/SSLv3 detected in protocol set.",
      recommendation: "Disable SSLv2/SSLv3 and enforce TLS 1.2+ only.",
    });
  }
  if (protocols.some((protocol) => protocol.includes("TLS1.0") || protocol.includes("TLS1.1"))) {
    score -= 30;
    findings.push({
      severity: "high",
      issue: "Deprecated TLS protocol enabled",
      evidence: "TLS 1.0/1.1 detected in supported protocols.",
      recommendation: "Disable TLS 1.0/1.1 and require TLS 1.2 or TLS 1.3.",
    });
  }
  if (protocols.length > 0 && !protocols.some((protocol) => protocol.includes("TLS1.3"))) {
    score -= 8;
    findings.push({
      severity: "medium",
      issue: "TLS 1.3 not observed",
      evidence: "No TLS 1.3 protocol entry detected.",
      recommendation: "Enable TLS 1.3 to improve modern cipher and handshake posture.",
    });
  }

  const ciphers = parsed.ciphers.map((cipher) => cipher.toUpperCase());
  const weakCipherHits = ciphers.filter((cipher) => /RC4|3DES|DES|NULL|MD5/.test(cipher));
  if (weakCipherHits.length > 0) {
    score -= 25;
    findings.push({
      severity: "high",
      issue: "Weak cipher suites detected",
      evidence: weakCipherHits.join(", "),
      recommendation: "Remove weak ciphers and prefer AEAD suites such as AES-GCM or CHACHA20-POLY1305.",
    });
  }

  if (parsed.selfSigned) {
    score -= 20;
    findings.push({
      severity: "medium",
      issue: "Self-signed certificate",
      evidence: "Certificate metadata indicates self-signed trust chain.",
      recommendation: "Use a publicly trusted or private PKI-managed certificate chain.",
    });
  }

  if (parsed.expiry) {
    const expiryDate = new Date(parsed.expiry);
    if (!Number.isNaN(expiryDate.getTime())) {
      const daysToExpiry = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysToExpiry < 0) {
        score -= 40;
        findings.push({
          severity: "critical",
          issue: "Certificate expired",
          evidence: `Certificate expired ${Math.abs(daysToExpiry)} day(s) ago.`,
          recommendation: "Replace the expired certificate immediately.",
        });
      } else if (daysToExpiry <= 30) {
        score -= 15;
        findings.push({
          severity: "high",
          issue: "Certificate near expiration",
          evidence: `Certificate expires in ${daysToExpiry} day(s).`,
          recommendation: "Rotate certificate before expiry and verify auto-renew workflow.",
        });
      }
    }
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    grade: gradeFromScore(score),
    findings: findings.sort((a, b) => {
      const weight = (severity: TlsRiskFinding["severity"]) => {
        if (severity === "critical") return 4;
        if (severity === "high") return 3;
        if (severity === "medium") return 2;
        return 1;
      };
      return weight(b.severity) - weight(a.severity);
    }),
    parsed: {
      protocols,
      ciphers,
      certificateExpiry: parsed.expiry,
      selfSigned: parsed.selfSigned,
    },
  };
}
