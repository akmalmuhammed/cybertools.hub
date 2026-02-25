import { isIPv4, isIPv6 } from "./ip-intel.js";
import { isValidDomain } from "./whois.js";

export type NormalizedIocType = "url" | "domain" | "email" | "ipv4" | "ipv6";

export interface CanonicalIoc {
  type: NormalizedIocType;
  canonical: string;
  defanged: string;
  originals: string[];
}

export interface IocNormalizationResult {
  summary: {
    inputTokens: number;
    normalized: number;
    deduplicated: number;
  };
  entries: CanonicalIoc[];
  notes: string[];
}

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}$/i;

function cleanToken(value: string): string {
  return value
    .trim()
    .replace(/^[<[({"'`]+/, "")
    .replace(/[>\])}"'`,;]+$/, "");
}

function toAsciiHostname(hostname: string): string {
  const normalized = hostname.trim().replace(/\.$/, "");
  if (!normalized) return "";
  try {
    return new URL(`http://${normalized}`).hostname.toLowerCase();
  } catch {
    return normalized.toLowerCase();
  }
}

function canonicalizeUrl(candidate: string): string | null {
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    url.hash = "";
    url.hostname = toAsciiHostname(url.hostname);
    if (
      (url.protocol === "http:" && url.port === "80") ||
      (url.protocol === "https:" && url.port === "443")
    ) {
      url.port = "";
    }

    const sortedParams = [...url.searchParams.entries()].sort((a, b) =>
      a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0]),
    );
    url.search = "";
    sortedParams.forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    return url.toString();
  } catch {
    return null;
  }
}

function canonicalizeDomain(candidate: string): string | null {
  const normalized = toAsciiHostname(candidate);
  return isValidDomain(normalized) ? normalized : null;
}

function canonicalizeEmail(candidate: string): string | null {
  if (!EMAIL_REGEX.test(candidate)) return null;
  const [localPart, domainPart] = candidate.split("@");
  const asciiDomain = canonicalizeDomain(domainPart);
  if (!asciiDomain) return null;
  return `${localPart.toLowerCase()}@${asciiDomain}`;
}

export function refangText(input: string): string {
  if (!input) return "";

  return input
    .normalize("NFKC")
    .replace(/hxxps:\/\//gi, "https://")
    .replace(/hxxp:\/\//gi, "http://")
    .replace(/\[(?:\.)\]|\(\.\)|\{\.\}/g, ".")
    .replace(/\[:\]/g, ":")
    .replace(/\[@\]/g, "@")
    .replace(/\s+/g, " ")
    .trim();
}

export function defangValue(value: string, type: NormalizedIocType): string {
  if (type === "url") {
    return value
      .replace(/^https:\/\//i, "hxxps://")
      .replace(/^http:\/\//i, "hxxp://")
      .replace(/\./g, "[.]");
  }
  if (type === "email") {
    const [localPart, domainPart] = value.split("@");
    return `${localPart}[@]${domainPart.replace(/\./g, "[.]")}`;
  }
  return value.replace(/\./g, "[.]");
}

function classifyAndCanonicalize(token: string): { type: NormalizedIocType; canonical: string } | null {
  if (!token) return null;

  const urlCandidate = /^https?:\/\//i.test(token) ? token : null;
  if (urlCandidate) {
    const canonical = canonicalizeUrl(urlCandidate);
    if (canonical) {
      return { type: "url", canonical };
    }
  }

  const emailCandidate = token.toLowerCase();
  const canonicalEmail = canonicalizeEmail(emailCandidate);
  if (canonicalEmail) {
    return { type: "email", canonical: canonicalEmail };
  }

  const bracketless = token.replace(/^\[/, "").replace(/\]$/, "");
  if (isIPv4(bracketless)) {
    return { type: "ipv4", canonical: bracketless };
  }
  if (isIPv6(bracketless.toLowerCase())) {
    return { type: "ipv6", canonical: bracketless.toLowerCase() };
  }

  const domainCandidate = token.toLowerCase().replace(/^www\./, "");
  const canonicalDomain = canonicalizeDomain(domainCandidate);
  if (canonicalDomain) {
    return { type: "domain", canonical: canonicalDomain };
  }

  return null;
}

export function normalizeAndCanonicalizeIocs(input: string): IocNormalizationResult {
  const refanged = refangText(input);
  const tokens = refanged
    .split(/[\s,;\n\t]+/)
    .map((token) => cleanToken(token))
    .filter(Boolean);

  const buckets = new Map<string, CanonicalIoc>();

  tokens.forEach((token) => {
    const normalized = classifyAndCanonicalize(token);
    if (!normalized) return;

    const key = `${normalized.type}:${normalized.canonical}`;
    const existing = buckets.get(key);
    if (existing) {
      if (!existing.originals.includes(token)) {
        existing.originals.push(token);
      }
      return;
    }

    buckets.set(key, {
      type: normalized.type,
      canonical: normalized.canonical,
      defanged: defangValue(normalized.canonical, normalized.type),
      originals: [token],
    });
  });

  const entries = [...buckets.values()].sort((a, b) => {
    if (a.type === b.type) return a.canonical.localeCompare(b.canonical);
    return a.type.localeCompare(b.type);
  });

  const notes: string[] = [];
  if (entries.length === 0) {
    notes.push("No supported IOC tokens were detected.");
  } else {
    notes.push("Canonical forms are deduplicated across defanged and unicode/punycode variants.");
  }

  return {
    summary: {
      inputTokens: tokens.length,
      normalized: entries.reduce((count, entry) => count + entry.originals.length, 0),
      deduplicated: entries.length,
    },
    entries,
    notes,
  };
}
