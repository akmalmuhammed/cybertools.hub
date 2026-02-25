export interface AlertRecord {
  timestamp: string | null;
  ruleId: string;
  entity: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  source: string;
}

export interface AlertDedupeGroup {
  fingerprint: string;
  count: number;
  firstSeen: string | null;
  lastSeen: string | null;
  sampleTitle: string;
  sampleEntity: string;
  severity: AlertRecord["severity"];
}

export interface AlertDedupeResult {
  totalAlerts: number;
  uniqueAlerts: number;
  reducedCount: number;
  reductionRate: number;
  groups: AlertDedupeGroup[];
  notes: string[];
}

export interface AlertDedupeOptions {
  windowMinutes?: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeSeverity(value: unknown): AlertRecord["severity"] {
  const normalized = String(value ?? "info").trim().toLowerCase();
  if (normalized === "critical") return "critical";
  if (normalized === "high") return "high";
  if (normalized === "medium" || normalized === "med") return "medium";
  if (normalized === "low") return "low";
  return "info";
}

function normalizeTimestamp(value: unknown): string | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeText(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function parseObjectRecord(value: Record<string, unknown>): AlertRecord {
  return {
    timestamp: normalizeTimestamp(
      value.timestamp ?? value.time ?? value["@timestamp"] ?? value.occurred_at,
    ),
    ruleId: normalizeText(value.ruleId ?? value.rule_id ?? value.rule ?? value.signature, "unknown-rule"),
    entity: normalizeText(
      value.entity ?? value.host ?? value.hostname ?? value.user ?? value.src_ip ?? value.ip,
      "unknown-entity",
    ),
    title: normalizeText(value.title ?? value.alert ?? value.message ?? value.name, "untitled-alert"),
    severity: normalizeSeverity(value.severity ?? value.level ?? value.priority),
    source: normalizeText(value.source ?? value.vendor ?? value.product, "unknown-source"),
  };
}

function parseCsvRecord(line: string): AlertRecord | null {
  const parts = line.split(",").map((part) => part.trim());
  if (parts.length < 4) return null;
  return {
    timestamp: normalizeTimestamp(parts[0]),
    ruleId: normalizeText(parts[1], "unknown-rule"),
    entity: normalizeText(parts[2], "unknown-entity"),
    title: normalizeText(parts[3], "untitled-alert"),
    severity: normalizeSeverity(parts[4] ?? "info"),
    source: normalizeText(parts[5] ?? "csv-import", "csv-import"),
  };
}

export function parseAlertRecords(input: string): AlertRecord[] {
  if (!input.trim()) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    parsed = null;
  }

  if (Array.isArray(parsed)) {
    return parsed
      .filter((item) => isObject(item))
      .map((item) => parseObjectRecord(item));
  }
  if (isObject(parsed) && Array.isArray(parsed.alerts)) {
    return parsed.alerts
      .filter((item) => isObject(item))
      .map((item) => parseObjectRecord(item));
  }

  const records: AlertRecord[] = [];
  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("{") && line.endsWith("}")) {
      try {
        const candidate = JSON.parse(line);
        if (isObject(candidate)) {
          records.push(parseObjectRecord(candidate));
          continue;
        }
      } catch {
        // continue to CSV parser
      }
    }

    const csvRecord = parseCsvRecord(line);
    if (csvRecord) records.push(csvRecord);
  }

  return records;
}

function severityWeight(severity: AlertRecord["severity"]): number {
  if (severity === "critical") return 5;
  if (severity === "high") return 4;
  if (severity === "medium") return 3;
  if (severity === "low") return 2;
  return 1;
}

function fingerprintBase(record: AlertRecord): string {
  return [
    record.ruleId.trim().toLowerCase(),
    record.entity.trim().toLowerCase(),
    record.title.trim().toLowerCase(),
  ].join("|");
}

export function simulateAlertDeduplication(
  input: string,
  options: AlertDedupeOptions = {},
): AlertDedupeResult {
  const records = parseAlertRecords(input);
  const windowMinutes = Math.max(1, Math.round(options.windowMinutes ?? 20));
  const windowMs = windowMinutes * 60 * 1000;
  if (records.length === 0) {
    return {
      totalAlerts: 0,
      uniqueAlerts: 0,
      reducedCount: 0,
      reductionRate: 0,
      groups: [],
      notes: ["No alert records parsed. Provide JSON array, NDJSON, or CSV rows."],
    };
  }

  const ordered = [...records].sort((a, b) => {
    const aTs = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTs = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return aTs - bTs;
  });

  interface GroupInternal {
    fingerprint: string;
    count: number;
    firstSeen: string | null;
    lastSeen: string | null;
    sampleTitle: string;
    sampleEntity: string;
    severity: AlertRecord["severity"];
    lastSeenMs: number;
  }

  const groupedByBase = new Map<string, GroupInternal[]>();
  for (const record of ordered) {
    const base = fingerprintBase(record);
    const currentGroups = groupedByBase.get(base) ?? [];
    const lastGroup = currentGroups[currentGroups.length - 1];
    const currentTs = record.timestamp ? new Date(record.timestamp).getTime() : 0;
    const shouldCreateNew =
      !lastGroup || (currentTs > 0 && lastGroup.lastSeenMs > 0 && currentTs - lastGroup.lastSeenMs > windowMs);

    if (shouldCreateNew) {
      currentGroups.push({
        fingerprint: `${base}#${currentGroups.length + 1}`,
        count: 1,
        firstSeen: record.timestamp,
        lastSeen: record.timestamp,
        sampleTitle: record.title,
        sampleEntity: record.entity,
        severity: record.severity,
        lastSeenMs: currentTs,
      });
      groupedByBase.set(base, currentGroups);
      continue;
    }

    if (!lastGroup) {
      currentGroups.push({
        fingerprint: `${base}#1`,
        count: 1,
        firstSeen: record.timestamp,
        lastSeen: record.timestamp,
        sampleTitle: record.title,
        sampleEntity: record.entity,
        severity: record.severity,
        lastSeenMs: currentTs,
      });
      groupedByBase.set(base, currentGroups);
      continue;
    }

    lastGroup.count += 1;
    if (!lastGroup.firstSeen && record.timestamp) lastGroup.firstSeen = record.timestamp;
    if (record.timestamp) lastGroup.lastSeen = record.timestamp;
    if (severityWeight(record.severity) > severityWeight(lastGroup.severity)) {
      lastGroup.severity = record.severity;
    }
    lastGroup.lastSeenMs = currentTs || lastGroup.lastSeenMs;
  }

  const groups = Array.from(groupedByBase.values())
    .flat()
    .map(({ lastSeenMs: _, ...group }) => group)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.fingerprint.localeCompare(b.fingerprint);
    });

  const totalAlerts = records.length;
  const uniqueAlerts = groups.length;
  const reducedCount = totalAlerts - uniqueAlerts;
  const reductionRate = totalAlerts === 0 ? 0 : Math.round((reducedCount / totalAlerts) * 10000) / 100;

  return {
    totalAlerts,
    uniqueAlerts,
    reducedCount,
    reductionRate,
    groups,
    notes: [
      `Deduplication window: ${windowMinutes} minute(s).`,
      "Fingerprints are based on ruleId + entity + title normalization.",
    ],
  };
}
