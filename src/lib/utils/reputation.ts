import { extractIocs } from "./ioc.js";
import {
  classifyIp,
  isIPv4,
  isIPv6,
  parseRdapIpResponse,
} from "./ip-intel.js";
import {
  isValidDomain,
  parseRdapDomainResponse,
} from "./whois.js";

export type ReputationProvider = "none" | "abuseipdb" | "virustotal";
export type ReputationIndicatorType = "ip" | "domain";

export interface ReputationIndicator {
  value: string;
  type: ReputationIndicatorType;
}

export interface ReputationIndicatorResult {
  indicator: ReputationIndicator;
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  sources: string[];
  details: string[];
  providerData: Record<string, unknown> | null;
}

export interface ReputationSummary {
  total: number;
  high: number;
  medium: number;
  low: number;
}

export interface BulkReputationResult {
  items: ReputationIndicatorResult[];
  summary: ReputationSummary;
  notes: string[];
}

export interface ReputationOptions {
  provider?: ReputationProvider;
  providerProxyUrl?: string;
  includeRdap?: boolean;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface ProviderProxyResponse {
  scoreDelta?: number;
  details?: string[];
  providerData?: Record<string, unknown> | null;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function riskLevelFromScore(score: number): "low" | "medium" | "high" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function splitToken(token: string): string {
  return token.replace(/^[("'`[{<]+/, "").replace(/[)"'`\]}>.,;:!?]+$/, "");
}

function normalizeProxyUrl(input: string | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost")) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function parseBulkIndicators(input: string): ReputationIndicator[] {
  const iocs = extractIocs(input, {
    includePrivateIps: true,
    includeDomainsFromEmails: true,
    includeDomainsFromUrls: true,
  });

  const indicators: ReputationIndicator[] = [];
  iocs.items.ipv4.forEach((value) => indicators.push({ value, type: "ip" }));
  iocs.items.ipv6.forEach((value) => indicators.push({ value, type: "ip" }));
  iocs.items.domain.forEach((value) => indicators.push({ value, type: "domain" }));

  // Fallback extraction for raw input that might not be covered by IOC utility.
  if (indicators.length === 0) {
    const tokens = input
      .split(/[\s,]+/)
      .map((token) => splitToken(token).toLowerCase())
      .filter(Boolean);
    const seen = new Set<string>();
    for (const token of tokens) {
      if (seen.has(token)) continue;
      if (isIPv4(token) || isIPv6(token)) {
        indicators.push({ value: token, type: "ip" });
        seen.add(token);
      } else if (isValidDomain(token)) {
        indicators.push({ value: token, type: "domain" });
        seen.add(token);
      }
    }
  }

  const unique = new Map<string, ReputationIndicator>();
  indicators.forEach((indicator) => {
    unique.set(`${indicator.type}:${indicator.value}`, indicator);
  });

  return [...unique.values()];
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function daysSince(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  const diff = Date.now() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

async function enrichWithRdap(
  indicator: ReputationIndicator,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<{ scoreDelta: number; details: string[]; providerData: Record<string, unknown> | null }> {
  try {
    const endpoint =
      indicator.type === "ip"
        ? `https://rdap.org/ip/${encodeURIComponent(indicator.value)}`
        : `https://rdap.org/domain/${encodeURIComponent(indicator.value)}`;
    const response = await fetchWithTimeout(endpoint, timeoutMs, fetchImpl);
    if (!response.ok) {
      return {
        scoreDelta: 0,
        details: [`RDAP lookup failed with HTTP ${response.status}.`],
        providerData: null,
      };
    }

    const payload = await response.json();

    if (indicator.type === "ip") {
      const parsed = parseRdapIpResponse(payload);
      const details: string[] = [];
      if (parsed.country) details.push(`RDAP country: ${parsed.country}`);
      if (parsed.name) details.push(`Network name: ${parsed.name}`);
      return {
        scoreDelta: 0,
        details,
        providerData: {
          country: parsed.country,
          name: parsed.name,
          handle: parsed.handle,
        },
      };
    }

    const parsed = parseRdapDomainResponse(payload);
    const details: string[] = [];
    let scoreDelta = 0;
    const ageDays = daysSince(parsed.createdAt);
    if (ageDays !== null && ageDays <= 30) {
      scoreDelta += 15;
      details.push(`Domain age is ${ageDays} days (recent registration).`);
    }
    if (parsed.dnssec !== "signed") {
      scoreDelta += 5;
      details.push("DNSSEC is not signed.");
    }
    if (!parsed.registrar) {
      scoreDelta += 5;
      details.push("Registrar is unavailable in RDAP data.");
    }

    return {
      scoreDelta,
      details,
      providerData: {
        registrar: parsed.registrar,
        createdAt: parsed.createdAt,
        dnssec: parsed.dnssec,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        scoreDelta: 0,
        details: ["RDAP lookup timed out."],
        providerData: null,
      };
    }
    return {
      scoreDelta: 0,
      details: ["RDAP lookup failed (network/CORS issue)."],
      providerData: null,
    };
  }
}

async function enrichWithProviderProxy(
  indicator: ReputationIndicator,
  provider: Exclude<ReputationProvider, "none">,
  proxyUrl: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<{ scoreDelta: number; details: string[]; providerData: Record<string, unknown> | null }> {
  try {
    const response = await fetchWithTimeout(proxyUrl, timeoutMs, fetchImpl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        provider,
        indicator,
      }),
    });

    if (!response.ok) {
      return {
        scoreDelta: 0,
        details: [`${provider} proxy lookup failed with HTTP ${response.status}.`],
        providerData: null,
      };
    }

    const payload = (await response.json()) as ProviderProxyResponse;
    return {
      scoreDelta: Number(payload.scoreDelta ?? 0),
      details: Array.isArray(payload.details)
        ? payload.details.map((item) => String(item))
        : [`${provider} proxy lookup succeeded.`],
      providerData:
        payload.providerData && typeof payload.providerData === "object"
          ? payload.providerData
          : null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        scoreDelta: 0,
        details: [`${provider} proxy lookup timed out.`],
        providerData: null,
      };
    }
    return {
      scoreDelta: 0,
      details: [`${provider} proxy lookup failed (network/CORS issue).`],
      providerData: null,
    };
  }
}

async function enrichIndicator(
  indicator: ReputationIndicator,
  options: ReputationOptions,
): Promise<ReputationIndicatorResult> {
  const provider = options.provider ?? "none";
  const timeoutMs = options.timeoutMs ?? 8000;
  const fetchImpl = options.fetchImpl ?? fetch;
  const includeRdap = options.includeRdap ?? true;
  const providerProxyUrl = normalizeProxyUrl(options.providerProxyUrl);

  let riskScore = indicator.type === "domain" ? 35 : 20;
  const sources = ["local"] as string[];
  const details: string[] = [];
  let providerData: Record<string, unknown> | null = null;

  if (indicator.type === "ip") {
    const classification = classifyIp(indicator.value);
    details.push(`IP classification: ${classification.type} (${classification.scope}).`);
    if (classification.scope === "private" || classification.scope === "reserved") {
      riskScore = 5;
    } else {
      riskScore = 30;
    }
  } else {
    details.push("Domain indicator detected.");
  }

  if (includeRdap) {
    const rdapResult = await enrichWithRdap(indicator, timeoutMs, fetchImpl);
    riskScore += rdapResult.scoreDelta;
    details.push(...rdapResult.details);
    if (rdapResult.providerData) {
      providerData = {
        ...(providerData ?? {}),
        rdap: rdapResult.providerData,
      };
    }
    sources.push("rdap");
  }

  if (provider !== "none") {
    if (providerProxyUrl) {
      const proxyResult = await enrichWithProviderProxy(
        indicator,
        provider,
        providerProxyUrl,
        timeoutMs,
        fetchImpl,
      );
      riskScore += proxyResult.scoreDelta;
      details.push(...proxyResult.details);
      if (proxyResult.providerData) {
        providerData = {
          ...(providerData ?? {}),
          [provider]: proxyResult.providerData,
        };
      }
      sources.push(provider);
    } else {
      details.push(
        `${provider} enrichment selected without a valid proxy URL. Provider enrichment skipped.`,
      );
    }
  }

  const normalizedScore = clampScore(riskScore);
  return {
    indicator,
    riskScore: normalizedScore,
    riskLevel: riskLevelFromScore(normalizedScore),
    sources: Array.from(new Set(sources)),
    details,
    providerData,
  };
}

export async function enrichBulkReputation(
  input: string,
  options: ReputationOptions = {},
): Promise<BulkReputationResult> {
  const indicators = parseBulkIndicators(input);
  if (!indicators.length) {
    return {
      items: [],
      summary: { total: 0, high: 0, medium: 0, low: 0 },
      notes: ["No valid IP or domain indicators found."],
    };
  }

  const items = await Promise.all(
    indicators.map((indicator) => enrichIndicator(indicator, options)),
  );
  items.sort((a, b) => b.riskScore - a.riskScore);

  const summary = {
    total: items.length,
    high: items.filter((item) => item.riskLevel === "high").length,
    medium: items.filter((item) => item.riskLevel === "medium").length,
    low: items.filter((item) => item.riskLevel === "low").length,
  };

  const notes: string[] = [];
  const provider = options.provider ?? "none";
  const providerProxyUrl = normalizeProxyUrl(options.providerProxyUrl);

  if (provider !== "none" && !providerProxyUrl) {
    notes.push(
      "Provider enrichment requires a valid HTTPS proxy endpoint under your control. Direct provider API keys are intentionally not accepted client-side.",
    );
  }
  if ((options.includeRdap ?? true) === false) {
    notes.push("RDAP enrichment disabled. Results are provider/local only.");
  }

  return { items, summary, notes };
}
