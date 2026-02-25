interface GenericObject {
  [key: string]: unknown;
}

export interface ExposureRecord {
  host: string;
  port: number;
  protocol: string;
  service: string;
  status: "open" | "closed" | "filtered" | "unknown";
  source: "nmap" | "masscan" | "shodan" | "custom";
}

export interface ExposureNormalizationResult {
  records: ExposureRecord[];
  summary: {
    total: number;
    hosts: number;
    open: number;
    closed: number;
    filtered: number;
    unknown: number;
  };
  notes: string[];
}

function isObject(value: unknown): value is GenericObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeStatus(value: unknown): ExposureRecord["status"] {
  const normalized = String(value ?? "unknown").trim().toLowerCase();
  if (normalized === "open") return "open";
  if (normalized === "closed") return "closed";
  if (normalized === "filtered") return "filtered";
  return "unknown";
}

function normalizeSource(value: unknown): ExposureRecord["source"] {
  const normalized = String(value ?? "custom").trim().toLowerCase();
  if (normalized.includes("nmap")) return "nmap";
  if (normalized.includes("masscan")) return "masscan";
  if (normalized.includes("shodan")) return "shodan";
  return "custom";
}

function normalizeRecord(raw: GenericObject): ExposureRecord | null {
  const host = String(raw.host ?? raw.ip ?? raw.address ?? "").trim();
  const port = Number(raw.port ?? raw.port_number);
  if (!host || !Number.isFinite(port)) return null;

  return {
    host,
    port,
    protocol: String(raw.protocol ?? raw.proto ?? "tcp").trim().toLowerCase() || "tcp",
    service: String(raw.service ?? raw.product ?? raw.transport ?? "unknown").trim() || "unknown",
    status: normalizeStatus(raw.status ?? raw.state),
    source: normalizeSource(raw.source ?? raw.engine ?? raw.scanner),
  };
}

function parseJsonInput(input: string): ExposureRecord[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return [];
  }

  if (Array.isArray(parsed)) {
    return parsed
      .filter((item) => isObject(item))
      .map((item) => normalizeRecord(item))
      .filter((item): item is ExposureRecord => !!item);
  }

  if (isObject(parsed) && Array.isArray(parsed.matches)) {
    return parsed.matches
      .filter((item) => isObject(item))
      .map((item) => normalizeRecord(item))
      .filter((item): item is ExposureRecord => !!item);
  }

  if (isObject(parsed)) {
    const single = normalizeRecord(parsed);
    return single ? [single] : [];
  }
  return [];
}

function parseCsvInput(input: string): ExposureRecord[] {
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  if (!lines[0].includes(",")) return [];

  const headers = lines[0].split(",").map((header) => header.trim().toLowerCase());
  const records: ExposureRecord[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split(",").map((part) => part.trim());
    const record: GenericObject = {};
    headers.forEach((header, index) => {
      record[header] = parts[index] ?? "";
    });
    const normalized = normalizeRecord(record);
    if (normalized) records.push(normalized);
  }
  return records;
}

function parseNmapGrepable(input: string): ExposureRecord[] {
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const records: ExposureRecord[] = [];

  for (const line of lines) {
    const hostMatch = line.match(/Host:\s+([0-9a-fA-F:.]+)/);
    const portsMatch = line.match(/Ports:\s+(.+)$/);
    if (!hostMatch || !portsMatch) continue;

    const host = hostMatch[1];
    const portsBlob = portsMatch[1];
    const ports = portsBlob.split(",").map((chunk) => chunk.trim()).filter(Boolean);
    ports.forEach((entry) => {
      const fields = entry.split("/");
      const port = Number(fields[0]);
      if (!Number.isFinite(port)) return;
      const status = normalizeStatus(fields[1] ?? "unknown");
      const protocol = (fields[2] ?? "tcp").toLowerCase();
      const service = fields[4] ?? "unknown";
      records.push({
        host,
        port,
        protocol,
        service,
        status,
        source: "nmap",
      });
    });
  }

  return records;
}

export function normalizeExposureImports(input: string): ExposureNormalizationResult {
  const records = [
    ...parseJsonInput(input),
    ...parseCsvInput(input),
    ...parseNmapGrepable(input),
  ];

  const unique = new Map<string, ExposureRecord>();
  records.forEach((record) => {
    const key = `${record.host}|${record.port}|${record.protocol}|${record.source}`;
    if (!unique.has(key)) unique.set(key, record);
  });
  const normalized = [...unique.values()].sort((a, b) => {
    if (a.host !== b.host) return a.host.localeCompare(b.host);
    if (a.port !== b.port) return a.port - b.port;
    return a.protocol.localeCompare(b.protocol);
  });

  const hostSet = new Set(normalized.map((item) => item.host));
  const summary = {
    total: normalized.length,
    hosts: hostSet.size,
    open: normalized.filter((item) => item.status === "open").length,
    closed: normalized.filter((item) => item.status === "closed").length,
    filtered: normalized.filter((item) => item.status === "filtered").length,
    unknown: normalized.filter((item) => item.status === "unknown").length,
  };

  const notes: string[] = [];
  if (normalized.length === 0) {
    notes.push("No exposure records parsed. Supported inputs: JSON, CSV, and Nmap grepable output.");
  } else {
    notes.push("Records are deduplicated by host + port + protocol + source.");
  }

  return {
    records: normalized,
    summary,
    notes,
  };
}
