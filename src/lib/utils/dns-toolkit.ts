import { isValidDomain, normalizeDomainInput } from "./whois.js";

export type DnsRecordType = "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS" | "SOA" | "CAA";

export interface DnsAnswer {
  name: string;
  ttl: number;
  type: number;
  data: string;
}

export interface DnsQueryResult {
  recordType: DnsRecordType;
  status: "ok" | "nodata" | "error";
  answers: DnsAnswer[];
  error?: string;
}

export interface SpfAnalysis {
  record: string;
  mechanisms: string[];
  includes: string[];
  hasHardFail: boolean;
  hasSoftFail: boolean;
  hasNeutralAll: boolean;
}

export interface DmarcAnalysis {
  record: string;
  policy: string | null;
  subdomainPolicy: string | null;
  pct: number | null;
  rua: string[];
  ruf: string[];
  alignment: {
    adkim: string | null;
    aspf: string | null;
  };
}

export interface DnsToolkitResult {
  domain: string;
  queries: DnsQueryResult[];
  spf: SpfAnalysis | null;
  dmarc: DmarcAnalysis | null;
  notes: string[];
}

interface GoogleDnsResponse {
  Status?: number;
  Answer?: Array<{
    name?: string;
    type?: number;
    TTL?: number;
    data?: string;
  }>;
}

export function normalizeDnsQueryInput(input: string): string {
  const normalized = normalizeDomainInput(input).replace(/\.$/, "");
  return normalized.toLowerCase();
}

function normalizeTxtData(value: string): string {
  return value.replace(/^"+|"+$/g, "").replace(/"\s*"/g, "");
}

function parseGoogleDnsAnswers(payload: GoogleDnsResponse): DnsAnswer[] {
  if (!Array.isArray(payload.Answer)) return [];
  return payload.Answer.map((answer) => ({
    name: answer.name ? String(answer.name).replace(/\.$/, "") : "",
    ttl: Number(answer.TTL) || 0,
    type: Number(answer.type) || 0,
    data: answer.data ? normalizeTxtData(String(answer.data)) : "",
  })).filter((answer) => !!answer.data);
}

async function fetchJsonWithTimeout(
  url: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveDnsRecord(
  domain: string,
  recordType: DnsRecordType,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<DnsQueryResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 6000;
  const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${recordType}`;

  try {
    const response = await fetchJsonWithTimeout(url, timeoutMs, fetchImpl);
    if (!response.ok) {
      return {
        recordType,
        status: "error",
        answers: [],
        error: `HTTP ${response.status}`,
      };
    }

    const payload = (await response.json()) as GoogleDnsResponse;
    const statusCode = Number(payload.Status) || 0;
    const answers = parseGoogleDnsAnswers(payload);

    if (statusCode !== 0) {
      return {
        recordType,
        status: "error",
        answers: [],
        error: `DNS status ${statusCode}`,
      };
    }

    if (!answers.length) {
      return {
        recordType,
        status: "nodata",
        answers: [],
      };
    }

    return {
      recordType,
      status: "ok",
      answers,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? `Timed out after ${timeoutMs}ms`
        : "Network/CORS error";
    return {
      recordType,
      status: "error",
      answers: [],
      error: message,
    };
  }
}

export function extractSpfRecord(txtAnswers: string[]): string | null {
  return txtAnswers.find((record) => record.toLowerCase().startsWith("v=spf1")) ?? null;
}

export function analyzeSpfRecord(record: string): SpfAnalysis {
  const tokens = record.split(/\s+/).slice(1).filter(Boolean);
  const includes = tokens
    .filter((token) => token.toLowerCase().startsWith("include:"))
    .map((token) => token.slice("include:".length));

  return {
    record,
    mechanisms: tokens,
    includes,
    hasHardFail: tokens.includes("-all"),
    hasSoftFail: tokens.includes("~all"),
    hasNeutralAll: tokens.includes("?all"),
  };
}

function parseTagMap(record: string): Record<string, string> {
  const tags: Record<string, string> = {};
  const pairs = record.split(";").map((segment) => segment.trim());
  for (const pair of pairs) {
    if (!pair.includes("=")) continue;
    const [rawKey, rawValue] = pair.split("=", 2);
    const key = rawKey.trim().toLowerCase();
    const value = rawValue.trim();
    if (key) tags[key] = value;
  }
  return tags;
}

export function extractDmarcRecord(txtAnswers: string[]): string | null {
  return txtAnswers.find((record) => record.toLowerCase().startsWith("v=dmarc1")) ?? null;
}

export function analyzeDmarcRecord(record: string): DmarcAnalysis {
  const tags = parseTagMap(record);
  const rua = (tags.rua ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const ruf = (tags.ruf ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const pct = tags.pct ? Number(tags.pct) : null;

  return {
    record,
    policy: tags.p ?? null,
    subdomainPolicy: tags.sp ?? null,
    pct: Number.isFinite(pct) ? pct : null,
    rua,
    ruf,
    alignment: {
      adkim: tags.adkim ?? null,
      aspf: tags.aspf ?? null,
    },
  };
}

export async function runDnsToolkit(
  input: string,
  recordTypes: DnsRecordType[] = ["A", "AAAA", "CNAME", "MX", "TXT", "NS"],
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<DnsToolkitResult> {
  const domain = normalizeDnsQueryInput(input);
  if (!domain) throw new Error("Domain is required");
  if (!isValidDomain(domain)) throw new Error("Invalid domain format");

  const uniqueTypes = Array.from(new Set(recordTypes));
  const queries = await Promise.all(
    uniqueTypes.map((recordType) =>
      resolveDnsRecord(domain, recordType, options),
    ),
  );

  const txtAnswers = queries
    .filter((query) => query.recordType === "TXT")
    .flatMap((query) => query.answers.map((answer) => answer.data));

  const dmarcQuery = await resolveDnsRecord(`_dmarc.${domain}`, "TXT", options);
  const dmarcTxtAnswers = dmarcQuery.answers.map((answer) => answer.data);

  const spfRecord = extractSpfRecord(txtAnswers);
  const dmarcRecord = extractDmarcRecord(dmarcTxtAnswers);

  const notes: string[] = [];
  if (!spfRecord) {
    notes.push("No SPF TXT record found.");
  }
  if (!dmarcRecord) {
    notes.push("No DMARC TXT record found at _dmarc.");
  }
  if (queries.some((query) => query.status === "error")) {
    notes.push("Some DNS lookups returned errors. Check connectivity or DNS availability.");
  }

  return {
    domain,
    queries,
    spf: spfRecord ? analyzeSpfRecord(spfRecord) : null,
    dmarc: dmarcRecord ? analyzeDmarcRecord(dmarcRecord) : null,
    notes,
  };
}
