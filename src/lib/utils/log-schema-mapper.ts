interface GenericObject {
  [key: string]: unknown;
}

export interface SchemaMappingHint {
  rawField: string;
  ecsField: string | null;
  ocsfField: string | null;
  confidence: number;
  sampleValues: string[];
}

export interface SchemaMappingResult {
  recordCount: number;
  hints: SchemaMappingHint[];
  unmappedFields: string[];
  notes: string[];
}

const FIELD_HINTS: Record<string, { ecs: string; ocsf: string; confidence: number }> = {
  timestamp: { ecs: "@timestamp", ocsf: "time", confidence: 0.99 },
  time: { ecs: "@timestamp", ocsf: "time", confidence: 0.95 },
  ts: { ecs: "@timestamp", ocsf: "time", confidence: 0.9 },
  src_ip: { ecs: "source.ip", ocsf: "src_endpoint.ip", confidence: 0.98 },
  source_ip: { ecs: "source.ip", ocsf: "src_endpoint.ip", confidence: 0.98 },
  dst_ip: { ecs: "destination.ip", ocsf: "dst_endpoint.ip", confidence: 0.98 },
  dest_ip: { ecs: "destination.ip", ocsf: "dst_endpoint.ip", confidence: 0.95 },
  src_port: { ecs: "source.port", ocsf: "src_endpoint.port", confidence: 0.96 },
  dst_port: { ecs: "destination.port", ocsf: "dst_endpoint.port", confidence: 0.96 },
  user: { ecs: "user.name", ocsf: "actor.user.name", confidence: 0.92 },
  username: { ecs: "user.name", ocsf: "actor.user.name", confidence: 0.92 },
  event_id: { ecs: "event.code", ocsf: "metadata.uid", confidence: 0.86 },
  event_type: { ecs: "event.category", ocsf: "activity_name", confidence: 0.84 },
  process_name: { ecs: "process.name", ocsf: "process.name", confidence: 0.95 },
  host: { ecs: "host.name", ocsf: "device.hostname", confidence: 0.88 },
  hostname: { ecs: "host.name", ocsf: "device.hostname", confidence: 0.95 },
  message: { ecs: "message", ocsf: "message", confidence: 0.98 },
};

function isObject(value: unknown): value is GenericObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseKeyValueLine(line: string): GenericObject {
  const record: GenericObject = {};
  const matches = line.matchAll(/([A-Za-z0-9_.-]+)=(".*?"|'.*?'|[^\s]+)/g);
  for (const match of matches) {
    const key = match[1];
    const rawValue = match[2] ?? "";
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    record[key] = value;
  }
  return record;
}

function parseRecords(input: string): GenericObject[] {
  if (!input.trim()) return [];

  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => isObject(item)) as GenericObject[];
    }
    if (isObject(parsed)) return [parsed];
  } catch {
    // fallback path
  }

  const records: GenericObject[] = [];
  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("{") && line.endsWith("}")) {
      try {
        const parsed = JSON.parse(line);
        if (isObject(parsed)) {
          records.push(parsed);
          continue;
        }
      } catch {
        // fallback to key=value parse
      }
    }

    const keyValueRecord = parseKeyValueLine(line);
    if (Object.keys(keyValueRecord).length > 0) {
      records.push(keyValueRecord);
    }
  }

  return records;
}

export function mapLogsToSchemaHints(input: string): SchemaMappingResult {
  const records = parseRecords(input);
  if (records.length === 0) {
    return {
      recordCount: 0,
      hints: [],
      unmappedFields: [],
      notes: ["No log records parsed. Provide JSON/NDJSON or key=value records."],
    };
  }

  const fieldValues = new Map<string, Set<string>>();
  for (const record of records) {
    Object.entries(record).forEach(([key, value]) => {
      const normalizedKey = key.trim().toLowerCase();
      if (!normalizedKey) return;
      const values = fieldValues.get(normalizedKey) ?? new Set<string>();
      values.add(String(value ?? ""));
      fieldValues.set(normalizedKey, values);
    });
  }

  const hints: SchemaMappingHint[] = [];
  const unmappedFields: string[] = [];
  for (const [rawField, values] of fieldValues.entries()) {
    const hint = FIELD_HINTS[rawField];
    const sampleValues = [...values].slice(0, 3);
    if (hint) {
      hints.push({
        rawField,
        ecsField: hint.ecs,
        ocsfField: hint.ocsf,
        confidence: hint.confidence,
        sampleValues,
      });
    } else {
      unmappedFields.push(rawField);
      hints.push({
        rawField,
        ecsField: null,
        ocsfField: null,
        confidence: 0,
        sampleValues,
      });
    }
  }

  hints.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.rawField.localeCompare(b.rawField);
  });
  unmappedFields.sort((a, b) => a.localeCompare(b));

  return {
    recordCount: records.length,
    hints,
    unmappedFields,
    notes: [
      "Mappings are heuristic hints; confirm against ECS/OCSF field semantics before ingestion.",
      `Detected ${unmappedFields.length} field(s) without built-in mapping hints.`,
    ],
  };
}
