export type OsintIndicatorType = "domain" | "email" | "ip" | "username" | "url" | "organization";

export interface OsintQueryItem {
  indicator: string;
  type: OsintIndicatorType;
  queries: string[];
  notes: string[];
}

export interface OsintQueryBuildResult {
  items: OsintQueryItem[];
  summary: {
    total: number;
    domain: number;
    email: number;
    ip: number;
    username: number;
    url: number;
    organization: number;
  };
  notes: string[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const IPV4_REGEX = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const URL_REGEX = /^https?:\/\/[^\s]+$/i;
const USERNAME_REGEX = /^@?[a-z0-9._-]{3,30}$/i;

function normalizeInput(input: string): string[] {
  return input
    .split(/\r?\n|,|\t/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 400);
}

function isIpv4(value: string): boolean {
  if (!IPV4_REGEX.test(value)) return false;
  return value.split(".").every((octet) => Number(octet) >= 0 && Number(octet) <= 255);
}

function classifyIndicator(value: string): OsintIndicatorType {
  if (URL_REGEX.test(value)) return "url";
  if (EMAIL_REGEX.test(value)) return "email";
  if (isIpv4(value)) return "ip";
  if (DOMAIN_REGEX.test(value)) return "domain";
  if (USERNAME_REGEX.test(value)) return "username";
  return "organization";
}

function domainQueries(domain: string): string[] {
  return [
    `"${domain}"`,
    `site:${domain}`,
    `"${domain}" "login"`,
    `site:crt.sh "${domain}"`,
    `site:urlscan.io "${domain}"`,
  ];
}

function emailQueries(email: string): string[] {
  return [
    `"${email}"`,
    `"${email}" "paste"`,
    `"${email}" "breach"`,
    `site:github.com "${email}"`,
  ];
}

function ipQueries(ip: string): string[] {
  return [
    `"${ip}"`,
    `"${ip}" "abuse"`,
    `"${ip}" "malware"`,
    `shodan host:${ip}`,
    `site:virustotal.com "${ip}"`,
  ];
}

function urlQueries(url: string): string[] {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    host = "";
  }

  return [
    `"${url}"`,
    host ? `"${host}" "phishing"` : `"${url}" "phishing"`,
    `site:urlscan.io "${url}"`,
    `site:otx.alienvault.com "${url}"`,
  ];
}

function usernameQueries(username: string): string[] {
  const normalized = username.startsWith("@") ? username.slice(1) : username;
  return [
    `"${normalized}"`,
    `"${normalized}" "security researcher"`,
    `site:github.com "${normalized}"`,
    `site:x.com "${normalized}"`,
    `site:reddit.com "${normalized}"`,
  ];
}

function orgQueries(name: string): string[] {
  return [
    `"${name}" cybersecurity`,
    `"${name}" breach`,
    `"${name}" "bug bounty"`,
    `"${name}" "incident response"`,
  ];
}

function buildQueries(indicator: string, type: OsintIndicatorType): string[] {
  if (type === "domain") return domainQueries(indicator);
  if (type === "email") return emailQueries(indicator);
  if (type === "ip") return ipQueries(indicator);
  if (type === "url") return urlQueries(indicator);
  if (type === "username") return usernameQueries(indicator);
  return orgQueries(indicator);
}

export function buildOsintQueries(input: string): OsintQueryBuildResult {
  const values = normalizeInput(input);
  const seen = new Set<string>();
  const items: OsintQueryItem[] = [];

  values.forEach((value) => {
    const normalized = value.toLowerCase();
    if (seen.has(normalized)) return;
    seen.add(normalized);

    const type = classifyIndicator(value);
    const notes: string[] = [];

    if (type === "username" && value.startsWith("@")) {
      notes.push("Leading @ removed for cross-platform query pivots.");
    }
    if (type === "organization" && value.split(/\s+/).length < 2) {
      notes.push("Single-token input treated as organization label; adjust if this is a username.");
    }

    items.push({
      indicator: value,
      type,
      queries: buildQueries(value, type),
      notes,
    });
  });

  const summary = {
    total: items.length,
    domain: items.filter((item) => item.type === "domain").length,
    email: items.filter((item) => item.type === "email").length,
    ip: items.filter((item) => item.type === "ip").length,
    username: items.filter((item) => item.type === "username").length,
    url: items.filter((item) => item.type === "url").length,
    organization: items.filter((item) => item.type === "organization").length,
  };

  const notes = [
    "All queries are generated locally. Launch queries manually in authorized investigation workflows.",
  ];
  if (items.length === 0) {
    notes.push("No valid indicators detected. Provide domains, emails, IPs, usernames, URLs, or org names.");
  }

  return {
    items,
    summary,
    notes,
  };
}

