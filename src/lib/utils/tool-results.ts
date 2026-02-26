import type {
  ToolFinding,
  ToolFindingSeverity,
  ToolResultEnvelope,
  ToolResultExport,
  ToolResultSummary,
} from "../../types/tool.types.js";

function clampConfidence(value: number | null | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 60;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeSeverity(value: unknown): ToolFindingSeverity {
  if (typeof value !== "string") return "info";
  const normalized = value.toLowerCase();
  if (normalized === "critical" || normalized === "high" || normalized === "medium" || normalized === "low" || normalized === "info") {
    return normalized;
  }
  if (normalized === "warn" || normalized === "warning") return "medium";
  if (normalized === "error") return "high";
  return "info";
}

function riskToSeverity(value: unknown): ToolFindingSeverity {
  if (typeof value !== "string") return "info";
  const normalized = value.toLowerCase();
  if (normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  if (normalized === "low") return "low";
  return "info";
}

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function fallbackFindings(source: unknown): ToolFinding[] {
  if (!Array.isArray(source)) return [];

  return source.slice(0, 200).map((item, index) => {
    if (typeof item === "string") {
      return {
        id: `finding-${index + 1}`,
        severity: "info",
        confidence: 60,
        category: "analysis",
        title: item.slice(0, 80),
        description: item,
      };
    }

    const record = safeRecord(item);
    const title = typeof record.title === "string"
      ? record.title
      : typeof record.name === "string"
        ? record.name
        : `Finding ${index + 1}`;
    const description = typeof record.description === "string"
      ? record.description
      : typeof record.message === "string"
        ? record.message
        : JSON.stringify(record);

    const confidenceCandidate = typeof record.confidence === "number"
      ? record.confidence
      : typeof record.score === "number"
        ? record.score
        : undefined;

    return {
      id: typeof record.id === "string" ? record.id : `finding-${index + 1}`,
      severity: normalizeSeverity(record.severity ?? riskToSeverity(record.riskLevel)),
      confidence: clampConfidence(confidenceCandidate),
      category: typeof record.category === "string" ? record.category : "analysis",
      title,
      description,
      evidenceRef: typeof record.evidenceRef === "string" ? record.evidenceRef : undefined,
      remediation: typeof record.remediation === "string" ? record.remediation : undefined,
    };
  });
}

function readRecommendations(record: Record<string, unknown>): string[] {
  if (Array.isArray(record.recommendations)) {
    return record.recommendations.filter((item): item is string => typeof item === "string");
  }

  const fallback = record.tradeoffs ?? record.notes ?? record.actions;
  if (Array.isArray(fallback)) {
    return fallback.filter((item): item is string => typeof item === "string");
  }

  return [];
}

function createSummary(record: Record<string, unknown>, toolName: string): ToolResultSummary {
  const summary = safeRecord(record.summary);
  const summaryStatusRaw = typeof summary.status === "string"
    ? summary.status.toLowerCase()
    : typeof record.status === "string"
      ? record.status.toLowerCase()
      : "ok";
  const status = summaryStatusRaw === "error" || summaryStatusRaw === "warning" ? summaryStatusRaw : "ok";
  const scoreCandidate = typeof summary.score === "number"
    ? summary.score
    : typeof record.score === "number"
      ? record.score
      : null;
  const title = typeof summary.title === "string"
    ? summary.title
    : `${toolName} analysis`;
  const text = typeof summary.text === "string"
    ? summary.text
    : typeof record.reason === "string"
      ? record.reason
      : "Analysis completed.";

  const metrics: Record<string, number> = {};
  Object.entries(summary).forEach(([key, value]) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      metrics[key] = value;
    }
  });

  return {
    status,
    score: scoreCandidate,
    title,
    text,
    metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
  };
}

export function isToolResultEnvelope(value: unknown): value is ToolResultEnvelope {
  const record = safeRecord(value);
  return (
    !!record.summary &&
    Array.isArray(record.findings) &&
    Array.isArray(record.evidence) &&
    Array.isArray(record.recommendations) &&
    Array.isArray(record.exports)
  );
}

export function buildToolResultEnvelope<TEvidence = Record<string, unknown>>(params: {
  toolName: string
  summary: ToolResultSummary
  findings?: ToolFinding[]
  evidence?: TEvidence[]
  recommendations?: string[]
  exports?: ToolResultExport[]
  raw?: unknown
}): ToolResultEnvelope<TEvidence> {
  return {
    summary: params.summary,
    findings: params.findings ?? [],
    evidence: params.evidence ?? [],
    recommendations: params.recommendations ?? [],
    exports: params.exports ?? [],
    raw: params.raw,
  };
}

function inferEvidence(record: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(record.evidence)) {
    return record.evidence
      .map((item) => safeRecord(item))
      .filter((item) => Object.keys(item).length > 0);
  }

  const candidates = ["items", "records", "events", "objects", "results"];
  for (const key of candidates) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value
        .slice(0, 500)
        .map((item) => (typeof item === "object" && item !== null ? (item as Record<string, unknown>) : { value: item }))
        .filter((item) => Object.keys(item).length > 0);
    }
  }

  if (Object.keys(record).length > 0) {
    return [record];
  }

  return [];
}

function inferFindings(record: Record<string, unknown>): ToolFinding[] {
  if (Array.isArray(record.findings)) {
    return fallbackFindings(record.findings);
  }
  if (Array.isArray(record.issues)) {
    return fallbackFindings(record.issues);
  }
  if (Array.isArray(record.errors)) {
    return fallbackFindings(record.errors);
  }
  if (Array.isArray(record.items)) {
    const findings = fallbackFindings(record.items);
    if (findings.length > 0) return findings;
  }
  return [];
}

export function parseToolResultEnvelope(
  output: string,
  toolName: string,
): ToolResultEnvelope<Record<string, unknown>> {
  if (!output.trim()) {
    return {
      summary: {
        status: "ok",
        score: null,
        title: `${toolName} analysis`,
        text: "No output generated yet.",
      },
      findings: [],
      evidence: [],
      recommendations: [],
      exports: [],
    };
  }

  try {
    const parsed = JSON.parse(output) as unknown;
    if (isToolResultEnvelope(parsed)) return parsed as ToolResultEnvelope<Record<string, unknown>>;

    const record = safeRecord(parsed);
    const findings = inferFindings(record);
    const evidence = inferEvidence(record);
    const summary = createSummary(record, toolName);
    const recommendations = readRecommendations(record);

    return {
      summary,
      findings,
      evidence,
      recommendations,
      exports: [],
      raw: parsed,
    };
  } catch {
    return {
      summary: {
        status: "ok",
        score: null,
        title: `${toolName} analysis`,
        text: "Text output generated.",
      },
      findings: [],
      evidence: output.split("\n").map((line) => ({ line })).filter((line) => line.line.trim().length > 0),
      recommendations: [],
      exports: [],
      raw: output,
    };
  }
}

export function recordsToCsv(records: Array<Record<string, unknown>>): string {
  if (!records.length) return "";
  const keys = Array.from(
    records.reduce((acc, row) => {
      Object.keys(row).forEach((key) => acc.add(key));
      return acc;
    }, new Set<string>()),
  );

  const escapeCell = (value: unknown): string => {
    const stringValue = typeof value === "string" ? value : JSON.stringify(value ?? "");
    if (/[",\n]/.test(stringValue)) return `"${stringValue.replace(/"/g, "\"\"")}"`;
    return stringValue;
  };

  const header = keys.join(",");
  const rows = records.map((row) => keys.map((key) => escapeCell(row[key])).join(","));
  return [header, ...rows].join("\n");
}

export function envelopeToMarkdown(toolName: string, envelope: ToolResultEnvelope<Record<string, unknown>>): string {
  const lines: string[] = [
    `# ${toolName} report`,
    "",
    `- Status: ${envelope.summary.status}`,
    `- Score: ${typeof envelope.summary.score === "number" ? envelope.summary.score : "n/a"}`,
    `- Summary: ${envelope.summary.text}`,
    "",
    "## Findings",
  ];

  if (envelope.findings.length === 0) {
    lines.push("- No findings generated.");
  } else {
    envelope.findings.forEach((finding) => {
      lines.push(
        `- [${finding.severity.toUpperCase()}] ${finding.title} (confidence: ${finding.confidence})`,
        `  - Category: ${finding.category}`,
        `  - Detail: ${finding.description}`,
      );
      if (finding.remediation) lines.push(`  - Remediation: ${finding.remediation}`);
    });
  }

  lines.push("", "## Recommendations");
  if (envelope.recommendations.length === 0) {
    lines.push("- No recommendations generated.");
  } else {
    envelope.recommendations.forEach((recommendation) => {
      lines.push(`- ${recommendation}`);
    });
  }

  lines.push("", "## Evidence");
  if (envelope.evidence.length === 0) {
    lines.push("- No evidence records.");
  } else {
    lines.push("```json", JSON.stringify(envelope.evidence, null, 2), "```");
  }

  return lines.join("\n");
}
