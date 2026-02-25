import { classifyIp, isIPv4, isIPv6 } from "./ip-intel.js";
import { isValidDomain } from "./whois.js";

export type IocType =
  | "url"
  | "domain"
  | "email"
  | "ipv4"
  | "ipv6"
  | "md5"
  | "sha1"
  | "sha256"
  | "sha512"
  | "cve";

export interface IocEntry {
  type: IocType;
  value: string;
}

export interface IocExtractionOptions {
  includePrivateIps?: boolean;
  includeDomainsFromUrls?: boolean;
  includeDomainsFromEmails?: boolean;
}

export interface IocExtractionResult {
  items: Record<IocType, string[]>;
  counts: Record<IocType, number>;
  total: number;
  all: IocEntry[];
}

const IOC_TYPES: IocType[] = [
  "url",
  "domain",
  "email",
  "ipv4",
  "ipv6",
  "md5",
  "sha1",
  "sha256",
  "sha512",
  "cve",
];

const URL_REGEX = /\bhttps?:\/\/[^\s<>"'`]+/gi;
const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}\b/gi;
const DOMAIN_REGEX = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/gi;
const IPV4_REGEX =
  /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
const MD5_REGEX = /\b[a-fA-F0-9]{32}\b/g;
const SHA1_REGEX = /\b[a-fA-F0-9]{40}\b/g;
const SHA256_REGEX = /\b[a-fA-F0-9]{64}\b/g;
const SHA512_REGEX = /\b[a-fA-F0-9]{128}\b/g;
const CVE_REGEX = /\bCVE-\d{4}-\d{4,7}\b/gi;

function createBuckets(): Record<IocType, Set<string>> {
  return {
    url: new Set<string>(),
    domain: new Set<string>(),
    email: new Set<string>(),
    ipv4: new Set<string>(),
    ipv6: new Set<string>(),
    md5: new Set<string>(),
    sha1: new Set<string>(),
    sha256: new Set<string>(),
    sha512: new Set<string>(),
    cve: new Set<string>(),
  };
}

function extractMatches(input: string, regex: RegExp): string[] {
  const matches: string[] = [];
  const safeRegex = new RegExp(regex.source, regex.flags);
  let match: RegExpExecArray | null;
  while ((match = safeRegex.exec(input)) !== null) {
    matches.push(match[0]);
  }
  return matches;
}

function cleanToken(value: string): string {
  return value
    .trim()
    .replace(/^[("'`[{<]+/, "")
    .replace(/[)"'`\]}>.,;:!?]+$/, "");
}

function normalizeDomain(value: string): string {
  return cleanToken(value).toLowerCase().replace(/\.$/, "");
}

function shouldKeepIp(ip: string, includePrivateIps: boolean): boolean {
  if (includePrivateIps) return true;
  const classification = classifyIp(ip);
  return classification.scope === "public";
}

function normalizeUrl(rawUrl: string): { normalizedUrl: string; host: string } | null {
  try {
    const parsed = new URL(rawUrl);
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
    return { normalizedUrl: parsed.toString(), host: parsed.hostname };
  } catch {
    return null;
  }
}

function sortValues(values: Set<string>): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

export function flattenIocs(result: IocExtractionResult): IocEntry[] {
  return IOC_TYPES.flatMap((type) =>
    result.items[type].map((value) => ({ type, value })),
  );
}

export function extractIocs(
  input: string,
  options: IocExtractionOptions = {},
): IocExtractionResult {
  const includePrivateIps = options.includePrivateIps ?? false;
  const includeDomainsFromUrls = options.includeDomainsFromUrls ?? true;
  const includeDomainsFromEmails = options.includeDomainsFromEmails ?? true;

  const buckets = createBuckets();
  const text = input ?? "";

  // URLs and host-derived indicators.
  for (const match of extractMatches(text, URL_REGEX)) {
    const cleaned = cleanToken(match);
    const normalized = normalizeUrl(cleaned);
    if (!normalized) continue;

    buckets.url.add(normalized.normalizedUrl);

    if (includeDomainsFromUrls && isValidDomain(normalized.host)) {
      buckets.domain.add(normalized.host);
    }

    if (isIPv4(normalized.host) && shouldKeepIp(normalized.host, includePrivateIps)) {
      buckets.ipv4.add(normalized.host);
    }
    if (isIPv6(normalized.host) && shouldKeepIp(normalized.host, includePrivateIps)) {
      buckets.ipv6.add(normalized.host.toLowerCase());
    }
  }

  // Emails and optional sender domains.
  for (const match of extractMatches(text, EMAIL_REGEX)) {
    const email = cleanToken(match).toLowerCase();
    buckets.email.add(email);
    if (includeDomainsFromEmails) {
      const domain = email.split("@")[1];
      if (domain && isValidDomain(domain)) {
        buckets.domain.add(domain);
      }
    }
  }

  // Domains from raw text, excluding URLs/emails to reduce duplication noise.
  const textWithoutUrlsAndEmails = text
    .replace(new RegExp(URL_REGEX.source, URL_REGEX.flags), " ")
    .replace(new RegExp(EMAIL_REGEX.source, EMAIL_REGEX.flags), " ");
  for (const match of extractMatches(textWithoutUrlsAndEmails, DOMAIN_REGEX)) {
    const domain = normalizeDomain(match);
    if (isValidDomain(domain)) {
      buckets.domain.add(domain);
    }
  }

  // IPv4.
  for (const match of extractMatches(text, IPV4_REGEX)) {
    const ip = cleanToken(match);
    if (isIPv4(ip) && shouldKeepIp(ip, includePrivateIps)) {
      buckets.ipv4.add(ip);
    }
  }

  // IPv6 from tokenized text.
  for (const token of text.split(/\s+/)) {
    const candidate = cleanToken(token)
      .replace(/^\[/, "")
      .replace(/\]$/, "")
      .toLowerCase();
    if (!candidate.includes(":")) continue;
    if (isIPv6(candidate) && shouldKeepIp(candidate, includePrivateIps)) {
      buckets.ipv6.add(candidate);
    }
  }

  // Hashes.
  for (const match of extractMatches(text, MD5_REGEX)) {
    buckets.md5.add(match.toLowerCase());
  }
  for (const match of extractMatches(text, SHA1_REGEX)) {
    buckets.sha1.add(match.toLowerCase());
  }
  for (const match of extractMatches(text, SHA256_REGEX)) {
    buckets.sha256.add(match.toLowerCase());
  }
  for (const match of extractMatches(text, SHA512_REGEX)) {
    buckets.sha512.add(match.toLowerCase());
  }

  // CVEs.
  for (const match of extractMatches(text, CVE_REGEX)) {
    buckets.cve.add(match.toUpperCase());
  }

  const items = IOC_TYPES.reduce(
    (acc, type) => {
      acc[type] = sortValues(buckets[type]);
      return acc;
    },
    {} as Record<IocType, string[]>,
  );

  const counts = IOC_TYPES.reduce(
    (acc, type) => {
      acc[type] = items[type].length;
      return acc;
    },
    {} as Record<IocType, number>,
  );

  const total = IOC_TYPES.reduce((sum, type) => sum + counts[type], 0);
  const result: IocExtractionResult = {
    items,
    counts,
    total,
    all: [],
  };
  result.all = flattenIocs(result);

  return result;
}
