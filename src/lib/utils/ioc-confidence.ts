export type IocIndicatorType = "ipv4" | "ipv6" | "domain" | "url" | "hash" | "email" | "cve" | "unknown";

export interface IocConfidenceItem {
  indicator: string;
  type: IocIndicatorType;
  source: string;
  lastSeen: string | null;
  sightings: number;
  confidence: number;
  ttlDays: number;
  expiresAt: string;
  rationale: string[];
}

export interface IocConfidenceResult {
  items: IocConfidenceItem[];
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
  notes: string[];
}

export interface IocConfidenceOptions {
  nowIso?: string;
}

const EXPLICIT_TYPES: Array<Exclude<IocIndicatorType, "unknown">> = [
  "ipv4",
  "ipv6",
  "domain",
  "url",
  "hash",
  "email",
  "cve",
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function detectType(value: string): IocIndicatorType {
  const indicator = value.trim();
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(indicator)) return "ipv4";
  if (/^[0-9a-f:]{2,}$/i.test(indicator) && indicator.includes(":")) return "ipv6";
  if (/^https?:\/\//i.test(indicator)) return "url";
  if (/^[A-Fa-f0-9]{32}$/.test(indicator) || /^[A-Fa-f0-9]{40}$/.test(indicator) || /^[A-Fa-f0-9]{64}$/.test(indicator)) {
    return "hash";
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(indicator)) return "email";
  if (/^CVE-\d{4}-\d{4,7}$/i.test(indicator)) return "cve";
  if (/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(indicator)) return "domain";
  return "unknown";
}

function baseScoreForType(type: IocIndicatorType): number {
  if (type === "hash") return 50;
  if (type === "cve") return 46;
  if (type === "ipv4" || type === "ipv6") return 42;
  if (type === "domain") return 38;
  if (type === "url") return 36;
  if (type === "email") return 32;
  return 26;
}

function sourceWeight(source: string): number {
  const normalized = source.trim().toLowerCase();
  if (["internal", "internal-sensor", "edr", "siem"].includes(normalized)) return 22;
  if (["misp", "isac", "trusted-feed"].includes(normalized)) return 16;
  if (["vendor", "threat-feed"].includes(normalized)) return 12;
  if (["manual", "analyst"].includes(normalized)) return 9;
  if (["osint", "community"].includes(normalized)) return 6;
  return 0;
}

function defaultTtlForType(type: IocIndicatorType): number {
  if (type === "hash") return 90;
  if (type === "cve") return 120;
  if (type === "domain") return 30;
  if (type === "url") return 21;
  if (type === "email") return 30;
  if (type === "ipv4" || type === "ipv6") return 14;
  return 14;
}

function parseInputLines(input: string): Array<{
  indicator: string;
  source: string;
  lastSeen: string | null;
  sightings: number;
  explicitType: IocIndicatorType | null;
}> {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .map((line) => {
      const parts = line.split(",").map((part) => part.trim());
      if (parts.length === 0 || !parts[0]) return null;

      const explicitTypeRaw = (parts[1] || "").toLowerCase();
      const explicitType = EXPLICIT_TYPES.includes(explicitTypeRaw as Exclude<IocIndicatorType, "unknown">)
        ? (explicitTypeRaw as Exclude<IocIndicatorType, "unknown">)
        : null;

      return {
        indicator: parts[0],
        source: parts[2] || parts[1] || "unknown",
        lastSeen: normalizeDate(parts[3]),
        sightings: Number.isFinite(Number(parts[4])) ? Math.max(1, Number(parts[4])) : 1,
        explicitType,
      };
    })
    .filter((item): item is NonNullable<typeof item> => !!item);
}

export function scoreIocConfidenceAndTtl(
  input: string,
  options: IocConfidenceOptions = {},
): IocConfidenceResult {
  const rows = parseInputLines(input);
  if (rows.length === 0) {
    return {
      items: [],
      summary: { total: 0, high: 0, medium: 0, low: 0 },
      notes: ["No IOC rows parsed. Expected CSV: indicator,type,source,lastSeen,sightings."],
    };
  }

  const now = normalizeDate(options.nowIso) ?? new Date().toISOString();
  const nowMs = new Date(now).getTime();

  const items: IocConfidenceItem[] = rows.map((row) => {
    const type = row.explicitType ?? detectType(row.indicator);
    const lastSeen = row.lastSeen ?? now;
    const lastSeenMs = new Date(lastSeen).getTime();
    const ageDays = Math.max(0, Math.floor((nowMs - lastSeenMs) / (1000 * 60 * 60 * 24)));

    const baseScore = baseScoreForType(type);
    const sourceScore = sourceWeight(row.source);
    const sightingsBoost = Math.min(20, Math.round(Math.log2(row.sightings + 1) * 6));
    const agePenalty = Math.min(45, Math.round(ageDays * 1.2));
    const confidence = clamp(baseScore + sourceScore + sightingsBoost - agePenalty, 0, 100);

    let ttlDays = defaultTtlForType(type);
    if (confidence >= 80) ttlDays = Math.round(ttlDays * 1.4);
    if (confidence <= 35) ttlDays = Math.max(7, Math.round(ttlDays * 0.55));
    if (ageDays > ttlDays) ttlDays = Math.max(7, Math.round(ttlDays * 0.6));

    const expiresAt = new Date(lastSeenMs + ttlDays * 24 * 60 * 60 * 1000).toISOString();

    return {
      indicator: row.indicator,
      type,
      source: row.source,
      lastSeen,
      sightings: row.sightings,
      confidence,
      ttlDays,
      expiresAt,
      rationale: [
        `Base type score: ${baseScore}.`,
        `Source weight: ${sourceScore}.`,
        `Sightings boost: ${sightingsBoost}.`,
        `Age penalty: ${agePenalty} (${ageDays} day old).`,
      ],
    };
  });

  items.sort((a, b) => b.confidence - a.confidence);

  return {
    items,
    summary: {
      total: items.length,
      high: items.filter((item) => item.confidence >= 70).length,
      medium: items.filter((item) => item.confidence >= 40 && item.confidence < 70).length,
      low: items.filter((item) => item.confidence < 40).length,
    },
    notes: [
      "Confidence and TTL values are deterministic heuristics to improve feed hygiene.",
      "Use shorter TTLs for volatile indicators and stale single-sighting observables.",
    ],
  };
}
