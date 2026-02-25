interface GenericObject {
  [key: string]: unknown;
}

export interface TimelineEvent {
  timestamp: string;
  source: string;
  summary: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  offsetMinutes: number;
}

export interface TimelineGap {
  from: string;
  to: string;
  gapMinutes: number;
}

export interface TimelineCompositionResult {
  events: TimelineEvent[];
  gaps: TimelineGap[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    durationMinutes: number;
  };
  notes: string[];
}

function isObject(value: unknown): value is GenericObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeSeverity(value: unknown): TimelineEvent["severity"] {
  const normalized = String(value ?? "info").trim().toLowerCase();
  if (normalized === "critical") return "critical";
  if (normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  if (normalized === "low") return "low";
  return "info";
}

function parseTimestamp(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseObjectEvent(raw: GenericObject): Omit<TimelineEvent, "offsetMinutes"> | null {
  const timestamp = parseTimestamp(raw.timestamp ?? raw.time ?? raw["@timestamp"] ?? raw.occurred_at);
  if (!timestamp) return null;
  const source = String(raw.source ?? raw.host ?? raw.system ?? "unknown-source").trim() || "unknown-source";
  const summary = String(raw.summary ?? raw.message ?? raw.event ?? raw.title ?? "event").trim() || "event";
  return {
    timestamp,
    source,
    summary,
    severity: normalizeSeverity(raw.severity ?? raw.level),
  };
}

function parseCsvEvent(line: string): Omit<TimelineEvent, "offsetMinutes"> | null {
  const parts = line.split(",").map((part) => part.trim());
  if (parts.length < 3) return null;
  const timestamp = parseTimestamp(parts[0]);
  if (!timestamp) return null;
  return {
    timestamp,
    source: parts[1] || "csv-import",
    summary: parts[2] || "event",
    severity: normalizeSeverity(parts[3] ?? "info"),
  };
}

function parseTimelineEvents(input: string): Array<Omit<TimelineEvent, "offsetMinutes">> {
  if (!input.trim()) return [];

  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item) => isObject(item))
        .map((item) => parseObjectEvent(item))
        .filter((item): item is Omit<TimelineEvent, "offsetMinutes"> => !!item);
    }
  } catch {
    // fallback to line parsing
  }

  const events: Array<Omit<TimelineEvent, "offsetMinutes">> = [];
  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("{") && line.endsWith("}")) {
      try {
        const candidate = JSON.parse(line);
        if (isObject(candidate)) {
          const parsed = parseObjectEvent(candidate);
          if (parsed) events.push(parsed);
          continue;
        }
      } catch {
        // continue to CSV fallback
      }
    }

    const csv = parseCsvEvent(line);
    if (csv) events.push(csv);
  }

  return events;
}

export function composeIncidentTimeline(input: string): TimelineCompositionResult {
  const parsed = parseTimelineEvents(input);
  if (parsed.length === 0) {
    return {
      events: [],
      gaps: [],
      summary: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
        durationMinutes: 0,
      },
      notes: ["No timeline events parsed. Provide JSON array, NDJSON, or CSV rows."],
    };
  }

  const ordered = [...parsed].sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  const firstTs = new Date(ordered[0].timestamp).getTime();
  const events: TimelineEvent[] = ordered.map((event) => {
    const offsetMinutes = Math.round(((new Date(event.timestamp).getTime() - firstTs) / 60000) * 100) / 100;
    return {
      ...event,
      offsetMinutes,
    };
  });

  const gaps: TimelineGap[] = [];
  for (let index = 1; index < events.length; index += 1) {
    const prev = events[index - 1];
    const current = events[index];
    const gapMinutes = (new Date(current.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 60000;
    if (gapMinutes >= 30) {
      gaps.push({
        from: prev.timestamp,
        to: current.timestamp,
        gapMinutes: Math.round(gapMinutes * 100) / 100,
      });
    }
  }

  const summary = {
    total: events.length,
    critical: events.filter((event) => event.severity === "critical").length,
    high: events.filter((event) => event.severity === "high").length,
    medium: events.filter((event) => event.severity === "medium").length,
    low: events.filter((event) => event.severity === "low").length,
    info: events.filter((event) => event.severity === "info").length,
    durationMinutes:
      events.length > 1
        ? Math.round(((new Date(events[events.length - 1].timestamp).getTime() - firstTs) / 60000) * 100) / 100
        : 0,
  };

  const notes = [
    "Events are sorted chronologically and normalized to ISO timestamps.",
  ];
  if (gaps.length > 0) {
    notes.push(`${gaps.length} gap(s) over 30 minutes detected.`);
  }

  return {
    events,
    gaps,
    summary,
    notes,
  };
}
