import { normalizeDomainInput } from "./whois.js";

export type DomainSpoofRisk = "low" | "medium" | "high" | "critical";

export interface DomainSpoofFinding {
  input: string;
  domain: string;
  score: number;
  risk: DomainSpoofRisk;
  reasons: string[];
  matchedBrands: string[];
  ageDays: number | null;
}

export interface DomainSpoofBatchResult {
  items: DomainSpoofFinding[];
  summary: {
    total: number;
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  notes: string[];
}

const DEFAULT_BRANDS = [
  "microsoft",
  "google",
  "apple",
  "amazon",
  "paypal",
  "github",
  "okta",
  "cloudflare",
  "adobe",
  "dropbox",
  "chase",
  "wellsfargo",
  "bankofamerica",
];

const SUSPICIOUS_TLDS = new Set([
  "zip",
  "mov",
  "xyz",
  "top",
  "click",
  "work",
  "loan",
  "cam",
  "pw",
  "gq",
  "cf",
  "tk",
]);

const PHISHING_KEYWORDS = ["login", "secure", "verify", "update", "account", "auth", "support"];

const CONFUSABLE_MAP: Record<string, string> = {
  // Cyrillic
  а: "a",
  е: "e",
  о: "o",
  р: "p",
  с: "c",
  х: "x",
  у: "y",
  к: "k",
  м: "m",
  т: "t",
  в: "b",
  н: "h",
  і: "i",
  ј: "j",
  ѕ: "s",
  ԁ: "d",
  // Greek
  Α: "a",
  Β: "b",
  Ε: "e",
  Ζ: "z",
  Η: "h",
  Ι: "i",
  Κ: "k",
  Μ: "m",
  Ν: "n",
  Ο: "o",
  Ρ: "p",
  Τ: "t",
  Υ: "y",
  Χ: "x",
  α: "a",
  β: "b",
  γ: "y",
  δ: "d",
  ε: "e",
  η: "n",
  ι: "i",
  κ: "k",
  ο: "o",
  ρ: "p",
  τ: "t",
  υ: "u",
  χ: "x",
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeToAsciiDomain(domainInput: string): string {
  const refanged = domainInput
    .replace(/hxxps:\/\//gi, "https://")
    .replace(/hxxp:\/\//gi, "http://")
    .replace(/\[(?:\.)\]|\(\.\)|\{\.\}/g, ".")
    .replace(/\[@\]/g, "@");
  const normalized = normalizeDomainInput(refanged);
  if (!normalized) return "";
  try {
    return new URL(`http://${normalized}`).hostname.toLowerCase();
  } catch {
    return normalized.toLowerCase();
  }
}

function domainRoot(domain: string): string {
  const labels = domain.split(".").filter(Boolean);
  if (labels.length < 2) return domain;
  return labels[labels.length - 2];
}

function domainTld(domain: string): string {
  const labels = domain.split(".").filter(Boolean);
  return labels.length > 0 ? labels[labels.length - 1] : "";
}

function skeletonize(input: string): string {
  const normalized = input.normalize("NFKC").toLowerCase();
  return [...normalized]
    .map((char) => CONFUSABLE_MAP[char] ?? char)
    .join("");
}

function normalizeLeet(input: string): string {
  return input
    .replace(/0/g, "o")
    .replace(/1/g, "l")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t");
}

function hasMixedScripts(domain: string): boolean {
  const hasLatin = /[a-z]/i.test(domain);
  const hasCyrillic = /[\u0400-\u04ff]/.test(domain);
  const hasGreek = /[\u0370-\u03ff]/.test(domain);
  const scripts = [hasLatin, hasCyrillic, hasGreek].filter(Boolean).length;
  return scripts > 1;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

export function parseDomainAgeHints(input: string): Map<string, string> {
  const hints = new Map<string, string>();
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const parts = line.split(",").map((part) => part.trim());
    if (parts.length >= 2) {
      const domain = normalizeToAsciiDomain(parts[0]);
      const dateValue = parts[1];
      if (domain && dateValue) hints.set(domain, dateValue);
      continue;
    }

    const match = line.match(/([A-Za-z0-9.-]+)\s*[:=]\s*(\d{4}-\d{2}-\d{2}|\d{4}\/\d{2}\/\d{2})/);
    if (match) {
      const domain = normalizeToAsciiDomain(match[1]);
      if (domain) hints.set(domain, match[2]);
    }
  }

  return hints;
}

function ageInDays(createdAt: string | null, nowMs: number): number | null {
  if (!createdAt) return null;
  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp)) return null;
  const ageMs = nowMs - timestamp;
  if (ageMs < 0) return 0;
  return Math.floor(ageMs / (1000 * 60 * 60 * 24));
}

function riskFromScore(score: number): DomainSpoofRisk {
  if (score >= 70) return "critical";
  if (score >= 45) return "high";
  if (score >= 25) return "medium";
  return "low";
}

export function analyzeDomainSpoof(
  domainInput: string,
  options: {
    brands?: string[];
    createdAt?: string | null;
    nowMs?: number;
  } = {},
): DomainSpoofFinding | null {
  const domain = normalizeToAsciiDomain(domainInput);
  if (!domain || !domain.includes(".")) return null;

  const brands = (options.brands?.length ? options.brands : DEFAULT_BRANDS)
    .map((brand) => brand.trim().toLowerCase())
    .filter(Boolean);

  const root = domainRoot(domain);
  const rootSegments = [...new Set([root, ...root.split(/[-_]+/).filter(Boolean)])];
  const rootCandidates = [
    ...new Set(
      rootSegments.flatMap((segment) => {
        const normalized = segment.toLowerCase();
        const skeleton = skeletonize(normalized);
        return [normalized, skeleton, normalizeLeet(normalized), normalizeLeet(skeleton)];
      }),
    ),
  ];
  const tld = domainTld(domain);
  const reasons: string[] = [];
  const matchedBrands: string[] = [];
  let score = 0;

  if (domain.includes("xn--")) {
    score += 20;
    reasons.push("Contains punycode label (xn--) often used in IDN spoofing.");
  }

  if (hasMixedScripts(domainInput)) {
    score += 25;
    reasons.push("Mixed-script characters detected (possible homoglyph obfuscation).");
  }

  for (const keyword of PHISHING_KEYWORDS) {
    if (root.includes(keyword)) {
      score += 6;
      reasons.push(`Contains phishing keyword '${keyword}'.`);
      break;
    }
  }

  if (SUSPICIOUS_TLDS.has(tld)) {
    score += 8;
    reasons.push(`Uses high-abuse TLD '.${tld}'.`);
  }

  if (/\d/.test(root)) {
    score += 4;
    reasons.push("Contains numeric substitutions in second-level label.");
  }

  if ((root.match(/-/g) ?? []).length >= 2) {
    score += 5;
    reasons.push("Multiple hyphens in second-level label.");
  }

  for (const brand of brands) {
    if (!brand) continue;
    const exactCandidateMatch = rootCandidates.some((candidate) => candidate === brand);
    const hasBrandToken = rootCandidates.some(
      (candidate) => candidate.includes(brand) && candidate !== brand,
    );
    const hasCloseDistance = rootCandidates.some(
      (candidate) => levenshteinDistance(candidate, brand) <= 1,
    );

    if (hasBrandToken) {
      score += 24;
      matchedBrands.push(brand);
      reasons.push(`Brand token '${brand}' appears in domain label.`);
      continue;
    }

    if (hasCloseDistance && !exactCandidateMatch) {
      score += 28;
      matchedBrands.push(brand);
      reasons.push(`Label is a close typo/homoglyph variant of '${brand}'.`);
    }
  }

  const nowMs = options.nowMs ?? Date.now();
  const domainAgeDays = ageInDays(options.createdAt ?? null, nowMs);
  if (domainAgeDays !== null) {
    if (domainAgeDays <= 30) {
      score += 20;
      reasons.push(`Very new domain registration (${domainAgeDays} days old).`);
    } else if (domainAgeDays <= 90) {
      score += 10;
      reasons.push(`Recently registered domain (${domainAgeDays} days old).`);
    }
  }

  score = clamp(score, 0, 100);
  if (reasons.length === 0) {
    reasons.push("No strong spoofing heuristics detected.");
  }

  return {
    input: domainInput,
    domain,
    score,
    risk: riskFromScore(score),
    reasons,
    matchedBrands: [...new Set(matchedBrands)].sort((a, b) => a.localeCompare(b)),
    ageDays: domainAgeDays,
  };
}

export function analyzeDomainSpoofBatch(
  input: string,
  options: {
    brandInput?: string;
    ageHintsInput?: string;
    nowMs?: number;
  } = {},
): DomainSpoofBatchResult {
  const brands = (options.brandInput ?? "")
    .split(/[\n,]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const ageHints = parseDomainAgeHints(options.ageHintsInput ?? "");

  const rawDomains = input
    .split(/[\s,;\n\t]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const canonicalToRaw = new Map<string, string>();
  rawDomains.forEach((rawDomain) => {
    const canonical = normalizeToAsciiDomain(rawDomain);
    if (!canonical) return;
    if (!canonicalToRaw.has(canonical)) {
      canonicalToRaw.set(canonical, rawDomain);
    }
  });

  const items = [...canonicalToRaw.entries()]
    .map(([canonicalDomain, rawDomain]) =>
      analyzeDomainSpoof(rawDomain, {
        brands,
        createdAt: ageHints.get(canonicalDomain) ?? null,
        nowMs: options.nowMs,
      }),
    )
    .filter((item): item is DomainSpoofFinding => item !== null)
    .sort((a, b) => b.score - a.score || a.domain.localeCompare(b.domain));

  return {
    items,
    summary: {
      total: items.length,
      low: items.filter((item) => item.risk === "low").length,
      medium: items.filter((item) => item.risk === "medium").length,
      high: items.filter((item) => item.risk === "high").length,
      critical: items.filter((item) => item.risk === "critical").length,
    },
    notes:
      items.length === 0
        ? ["No valid domains detected."]
        : ["Heuristic analysis only; validate with WHOIS/DNS/passive telemetry before blocking."],
  };
}
