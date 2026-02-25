export type AssetCriticality = "low" | "medium" | "high" | "critical";
export type VulnerabilityPriority = "P1" | "P2" | "P3" | "P4";

export interface VulnerabilityRecord {
  cve: string;
  cvss: number | null;
  epss: number | null;
  kev: boolean;
  hasPublicExploit: boolean;
  assetCriticality: AssetCriticality;
  notes: string[];
}

export interface VulnerabilityPriorityItem {
  cve: string;
  priority: VulnerabilityPriority;
  score: number;
  reasons: string[];
  cvss: number | null;
  epss: number | null;
  kev: boolean;
  hasPublicExploit: boolean;
  assetCriticality: AssetCriticality;
}

export interface VulnerabilityPrioritizationResult {
  items: VulnerabilityPriorityItem[];
  summary: {
    total: number;
    p1: number;
    p2: number;
    p3: number;
    p4: number;
  };
  notes: string[];
}

const CVE_REGEX = /\bCVE-\d{4}-\d{4,7}\b/gi;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function detectCriticality(line: string): AssetCriticality {
  const lower = line.toLowerCase();
  if (/\bcritical\b/.test(lower)) return "critical";
  if (/\bhigh\b/.test(lower)) return "high";
  if (/\bmedium\b/.test(lower)) return "medium";
  return "low";
}

function parseLineRecord(line: string): VulnerabilityRecord | null {
  const cveMatch = line.match(CVE_REGEX);
  if (!cveMatch?.[0]) return null;
  const cve = cveMatch[0].toUpperCase();

  const cvssMatch = line.match(/cvss\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  const epssMatch = line.match(/epss\s*[:=]?\s*(\d+(?:\.\d+)?%?)/i);

  let epss: number | null = null;
  if (epssMatch?.[1]) {
    const raw = epssMatch[1].trim();
    if (raw.endsWith("%")) {
      const percentage = parseNumber(raw.slice(0, -1));
      epss = percentage === null ? null : clamp(percentage / 100, 0, 1);
    } else {
      const value = parseNumber(raw);
      epss = value === null ? null : clamp(value > 1 ? value / 100 : value, 0, 1);
    }
  }

  const cvss = cvssMatch?.[1] ? clamp(parseNumber(cvssMatch[1]) ?? 0, 0, 10) : null;
  const kev = /\bkev\b|known exploited/i.test(line);
  const hasPublicExploit = /\bexploit\b|\bpoc\b|weaponized/i.test(line);

  return {
    cve,
    cvss,
    epss,
    kev,
    hasPublicExploit,
    assetCriticality: detectCriticality(line),
    notes: [],
  };
}

function parseCsvRecord(line: string, headers: string[]): VulnerabilityRecord | null {
  const parts = line.split(",").map((part) => part.trim());
  if (parts.length === 0) return null;

  const get = (key: string): string => {
    const index = headers.findIndex((header) => header === key);
    return index >= 0 ? parts[index] ?? "" : "";
  };

  const cve = get("cve").toUpperCase();
  if (!/^CVE-\d{4}-\d{4,7}$/.test(cve)) return null;

  const cvssRaw = get("cvss") || get("cvss_v3") || get("cvssv3");
  const epssRaw = get("epss");
  const kevRaw = get("kev") || get("known_exploited") || get("knownexploited");
  const exploitRaw = get("public_exploit") || get("exploit") || get("poc");
  const criticalityRaw = get("asset_criticality") || get("criticality");

  const cvss = cvssRaw ? clamp(parseNumber(cvssRaw) ?? 0, 0, 10) : null;

  let epss: number | null = null;
  if (epssRaw) {
    const cleaned = epssRaw.replace(/%$/, "");
    const parsed = parseNumber(cleaned);
    if (parsed !== null) {
      epss = clamp(parsed > 1 ? parsed / 100 : parsed, 0, 1);
    }
  }

  const kev = /^(1|true|yes|y)$/i.test(kevRaw);
  const hasPublicExploit = /^(1|true|yes|y)$/i.test(exploitRaw);

  const criticality: AssetCriticality =
    criticalityRaw.toLowerCase() === "critical"
      ? "critical"
      : criticalityRaw.toLowerCase() === "high"
        ? "high"
        : criticalityRaw.toLowerCase() === "medium"
          ? "medium"
          : "low";

  return {
    cve,
    cvss,
    epss,
    kev,
    hasPublicExploit,
    assetCriticality: criticality,
    notes: [],
  };
}

function parseNvdCvss(vulnerability: Record<string, unknown>): number | null {
  const metrics = vulnerability.metrics as Record<string, unknown> | undefined;
  if (metrics && typeof metrics === "object") {
    const candidateArrays = [
      metrics.cvssMetricV40,
      metrics.cvssMetricV31,
      metrics.cvssMetricV30,
      metrics.cvssMetricV2,
    ];
    for (const candidate of candidateArrays) {
      if (!Array.isArray(candidate) || candidate.length === 0) continue;
      const first = candidate[0] as Record<string, unknown>;
      const cvssData = first.cvssData as Record<string, unknown> | undefined;
      if (cvssData?.baseScore !== undefined) {
        const parsed = parseNumber(String(cvssData.baseScore));
        if (parsed !== null) return clamp(parsed, 0, 10);
      }
      if (first.baseScore !== undefined) {
        const parsed = parseNumber(String(first.baseScore));
        if (parsed !== null) return clamp(parsed, 0, 10);
      }
    }
  }

  const impact = vulnerability.impact as Record<string, unknown> | undefined;
  const legacyV3 = impact?.baseMetricV3 as Record<string, unknown> | undefined;
  const legacyV2 = impact?.baseMetricV2 as Record<string, unknown> | undefined;
  const legacyV3Data = legacyV3?.cvssV3 as Record<string, unknown> | undefined;
  const legacyV2Data = legacyV2?.cvssV2 as Record<string, unknown> | undefined;
  if (legacyV3Data?.baseScore !== undefined) {
    const parsed = parseNumber(String(legacyV3Data.baseScore));
    if (parsed !== null) return clamp(parsed, 0, 10);
  }
  if (legacyV2Data?.baseScore !== undefined) {
    const parsed = parseNumber(String(legacyV2Data.baseScore));
    if (parsed !== null) return clamp(parsed, 0, 10);
  }
  return null;
}

function parseNvdExploitSignal(vulnerability: Record<string, unknown>): boolean {
  const references =
    (vulnerability.references as unknown[]) ??
    (
      (vulnerability.cve as Record<string, unknown> | undefined)
        ?.references as unknown[]
    );
  if (!Array.isArray(references)) return false;

  return references.some((reference) => {
    if (!reference || typeof reference !== "object") return false;
    const safeReference = reference as Record<string, unknown>;
    const tags = Array.isArray(safeReference.tags)
      ? safeReference.tags.map((tag) => String(tag).toLowerCase())
      : [];
    if (tags.some((tag) => tag.includes("exploit") || tag.includes("poc"))) {
      return true;
    }
    const url = safeReference.url ? String(safeReference.url).toLowerCase() : "";
    return /(exploit|poc|metasploit|packetstorm)/.test(url);
  });
}

function parseNvdCveId(item: Record<string, unknown>): string | null {
  const cve = item.cve as Record<string, unknown> | undefined;
  const id =
    (cve?.id ? String(cve.id) : "") ||
    (
      (cve?.CVE_data_meta as Record<string, unknown> | undefined)
        ?.ID
        ? String((cve?.CVE_data_meta as Record<string, unknown>).ID)
        : ""
    );
  if (!id) return null;
  const normalized = id.toUpperCase();
  return /^CVE-\d{4}-\d{4,7}$/.test(normalized) ? normalized : null;
}

export function parseNvdFeedRecords(input: string): VulnerabilityRecord[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== "object") return [];
  const payload = parsed as Record<string, unknown>;

  const vulnerabilities = Array.isArray(payload.vulnerabilities)
    ? payload.vulnerabilities
    : [];
  const legacyItems = Array.isArray(payload.CVE_Items) ? payload.CVE_Items : [];
  const items = vulnerabilities.length > 0 ? vulnerabilities : legacyItems;
  if (items.length === 0) return [];

  const records: VulnerabilityRecord[] = [];
  for (const entry of items) {
    const safeEntry =
      entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
    if (!safeEntry) continue;

    // NVD 2.0 wraps CVE metadata under "cve". Legacy feed stores fields on the item root.
    const vulnerability = safeEntry.cve && typeof safeEntry.cve === "object"
      ? (safeEntry.cve as Record<string, unknown>)
      : safeEntry;
    const cve = parseNvdCveId(safeEntry);
    if (!cve) continue;

    records.push({
      cve,
      cvss: parseNvdCvss(vulnerability),
      epss: null,
      kev: false,
      hasPublicExploit: parseNvdExploitSignal(vulnerability),
      assetCriticality: "low",
      notes: ["source:nvd-feed"],
    });
  }

  return records;
}

function dedupeRecords(records: VulnerabilityRecord[]): VulnerabilityRecord[] {
  const deduped = new Map<string, VulnerabilityRecord>();
  records.forEach((record) => {
    const existing = deduped.get(record.cve);
    if (!existing) {
      deduped.set(record.cve, record);
      return;
    }

    deduped.set(record.cve, {
      cve: record.cve,
      cvss: Math.max(existing.cvss ?? 0, record.cvss ?? 0) || null,
      epss: Math.max(existing.epss ?? 0, record.epss ?? 0) || null,
      kev: existing.kev || record.kev,
      hasPublicExploit: existing.hasPublicExploit || record.hasPublicExploit,
      assetCriticality:
        existing.assetCriticality === "critical" || record.assetCriticality === "critical"
          ? "critical"
          : existing.assetCriticality === "high" || record.assetCriticality === "high"
            ? "high"
            : existing.assetCriticality === "medium" || record.assetCriticality === "medium"
              ? "medium"
              : "low",
      notes: [...existing.notes, ...record.notes],
    });
  });
  return [...deduped.values()];
}

export function parseKevCatalog(input: string): Set<string> {
  const matches = input.match(CVE_REGEX) ?? [];
  return new Set(matches.map((match) => match.toUpperCase()));
}

export function parseVulnerabilityRecords(input: string): VulnerabilityRecord[] {
  const nvdRecords = parseNvdFeedRecords(input);
  if (nvdRecords.length > 0) {
    return dedupeRecords(nvdRecords);
  }

  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const firstLine = lines[0].toLowerCase();
  const looksLikeCsv = firstLine.includes(",") && firstLine.includes("cve");

  const records: VulnerabilityRecord[] = [];

  if (looksLikeCsv) {
    const headers = lines[0]
      .split(",")
      .map((header) => header.trim().toLowerCase());
    lines.slice(1).forEach((line) => {
      const parsed = parseCsvRecord(line, headers);
      if (parsed) records.push(parsed);
    });
  } else {
    lines.forEach((line) => {
      const parsed = parseLineRecord(line);
      if (parsed) records.push(parsed);
    });
  }

  return dedupeRecords(records);
}

function priorityFromScore(score: number): VulnerabilityPriority {
  if (score >= 80) return "P1";
  if (score >= 60) return "P2";
  if (score >= 40) return "P3";
  return "P4";
}

function criticalityWeight(value: AssetCriticality): number {
  if (value === "critical") return 15;
  if (value === "high") return 10;
  if (value === "medium") return 5;
  return 0;
}

export function prioritizeVulnerabilities(
  records: VulnerabilityRecord[],
  kevCatalog: Set<string> = new Set<string>(),
): VulnerabilityPrioritizationResult {
  const items = records.map((record) => {
    const reasons: string[] = [];
    let score = 0;

    const isKev = record.kev || kevCatalog.has(record.cve);
    if (isKev) {
      score += 55;
      reasons.push("CISA KEV listed");
    }

    if (record.hasPublicExploit) {
      score += 18;
      reasons.push("Public exploit/PoC signal");
    }

    if (record.cvss !== null) {
      score += clamp(record.cvss * 2.5, 0, 25);
      reasons.push(`CVSS ${record.cvss.toFixed(1)}`);
    }

    if (record.epss !== null) {
      const epssPercent = Math.round(record.epss * 1000) / 10;
      score += clamp(record.epss * 20, 0, 20);
      reasons.push(`EPSS ${epssPercent}%`);
    }

    const criticality = criticalityWeight(record.assetCriticality);
    if (criticality > 0) {
      score += criticality;
      reasons.push(`Asset criticality: ${record.assetCriticality}`);
    }

    const normalizedScore = Math.round(clamp(score, 0, 100));
    return {
      cve: record.cve,
      priority: priorityFromScore(normalizedScore),
      score: normalizedScore,
      reasons,
      cvss: record.cvss,
      epss: record.epss,
      kev: isKev,
      hasPublicExploit: record.hasPublicExploit,
      assetCriticality: record.assetCriticality,
    };
  });

  items.sort((a, b) => b.score - a.score || a.cve.localeCompare(b.cve));

  return {
    items,
    summary: {
      total: items.length,
      p1: items.filter((item) => item.priority === "P1").length,
      p2: items.filter((item) => item.priority === "P2").length,
      p3: items.filter((item) => item.priority === "P3").length,
      p4: items.filter((item) => item.priority === "P4").length,
    },
    notes:
      items.length === 0
        ? ["No CVE entries found."]
        : ["Scores are triage aids. Validate exploitability and environment exposure before patch prioritization."],
  };
}

export function runKevCvePrioritizer(
  vulnerabilitiesInput: string,
  kevCatalogInput = "",
): VulnerabilityPrioritizationResult {
  const records = parseVulnerabilityRecords(vulnerabilitiesInput);
  const kevCatalog = parseKevCatalog(kevCatalogInput);
  return prioritizeVulnerabilities(records, kevCatalog);
}
