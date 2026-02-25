export interface CanonicalUrlResult {
  original: string;
  canonical: string;
  scheme: string;
  host: string;
  port: string | null;
  path: string;
  query: Record<string, string[]>;
  warnings: string[];
}

const URL_REGEX = /\bhttps?:\/\/[^\s<>"'`]+/gi;

function ensureUrl(input: string): URL {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("URL is required");

  if (/^https?:\/\//i.test(trimmed)) {
    return new URL(trimmed);
  }

  return new URL(`https://${trimmed}`);
}

function normalizePath(pathname: string): string {
  const collapsed = pathname.replace(/\/{2,}/g, "/");
  if (collapsed.length > 1 && collapsed.endsWith("/")) {
    return collapsed.slice(0, -1);
  }
  return collapsed || "/";
}

function normalizeQuery(params: URLSearchParams): URLSearchParams {
  const tuples: Array<[string, string]> = [];
  params.forEach((value, key) => tuples.push([key, value]));
  tuples.sort((a, b) => {
    if (a[0] === b[0]) return a[1].localeCompare(b[1]);
    return a[0].localeCompare(b[0]);
  });

  const normalized = new URLSearchParams();
  tuples.forEach(([key, value]) => normalized.append(key, value));
  return normalized;
}

function defangProtocol(protocol: string): string {
  if (protocol === "https:") return "hxxps:";
  if (protocol === "http:") return "hxxp:";
  return protocol;
}

function defangSingleUrl(rawUrl: string): string {
  try {
    const parsed = ensureUrl(rawUrl);
    const protocol = defangProtocol(parsed.protocol);
    const userInfo = parsed.username
      ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ""}@`
      : "";
    const host = parsed.hostname.replace(/\./g, "[.]");
    const port = parsed.port ? `:${parsed.port}` : "";
    return `${protocol}//${userInfo}${host}${port}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return rawUrl;
  }
}

function normalizeRefang(input: string): string {
  return input
    .replace(/\bhxxps?:\/\//gi, (value) =>
      value.toLowerCase().startsWith("hxxps") ? "https://" : "http://",
    )
    .replace(/\[\.\]|\(\.\)|\{\.\}/g, ".")
    .replace(/\[:\]/g, ":");
}

export function defangText(input: string): string {
  return input.replace(new RegExp(URL_REGEX.source, URL_REGEX.flags), (match) =>
    defangSingleUrl(match),
  );
}

export function refangText(input: string): string {
  return normalizeRefang(input);
}

export function canonicalizeUrl(rawInput: string): CanonicalUrlResult {
  const warnings: string[] = [];
  const refanged = normalizeRefang(rawInput);
  const parsed = ensureUrl(refanged);

  if (!/^https?:$/i.test(parsed.protocol)) {
    warnings.push("Non-HTTP(S) scheme detected.");
  }

  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");

  const isDefaultHttp = parsed.protocol === "http:" && parsed.port === "80";
  const isDefaultHttps = parsed.protocol === "https:" && parsed.port === "443";
  if (isDefaultHttp || isDefaultHttps) {
    parsed.port = "";
    warnings.push("Removed default port.");
  }

  parsed.hash = "";
  parsed.pathname = normalizePath(parsed.pathname);
  const normalizedParams = normalizeQuery(parsed.searchParams);
  parsed.search = normalizedParams.toString() ? `?${normalizedParams.toString()}` : "";

  const query: Record<string, string[]> = {};
  normalizedParams.forEach((value, key) => {
    if (!query[key]) query[key] = [];
    query[key].push(value);
  });

  return {
    original: rawInput,
    canonical: parsed.toString(),
    scheme: parsed.protocol.replace(":", ""),
    host: parsed.hostname,
    port: parsed.port || null,
    path: parsed.pathname,
    query,
    warnings,
  };
}

export function canonicalizeUrlsFromText(input: string): CanonicalUrlResult[] {
  const seen = new Set<string>();
  const candidates = input.match(new RegExp(URL_REGEX.source, URL_REGEX.flags)) ?? [];
  const results: CanonicalUrlResult[] = [];

  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    try {
      results.push(canonicalizeUrl(candidate));
    } catch {
      // Ignore invalid URLs in bulk extraction mode.
    }
  }

  return results;
}
