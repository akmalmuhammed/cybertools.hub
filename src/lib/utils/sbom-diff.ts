export type VulnerabilitySeverity = "low" | "medium" | "high" | "critical";
export type ComponentChangeType = "added" | "removed" | "upgraded" | "downgraded" | "changed";
export type ComponentRisk = "low" | "medium" | "high" | "critical";

export interface SbomComponent {
  identity: string;
  name: string;
  version: string | null;
  purl: string | null;
  source: "cyclonedx" | "spdx";
}

export interface VulnerabilityHint {
  component: string;
  cve: string;
  severity: VulnerabilitySeverity;
}

export interface SbomRiskItem {
  component: string;
  beforeVersion: string | null;
  afterVersion: string | null;
  change: ComponentChangeType;
  vulnerabilities: VulnerabilityHint[];
  risk: ComponentRisk;
  reasons: string[];
}

export interface SbomDiffResult {
  items: SbomRiskItem[];
  summary: {
    total: number;
    added: number;
    removed: number;
    upgraded: number;
    downgraded: number;
    changed: number;
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  notes: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeSeverity(value: string): VulnerabilitySeverity {
  const normalized = value.trim().toLowerCase();
  if (normalized === "critical") return "critical";
  if (normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  return "low";
}

function compareVersions(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;

  const aParts = a.split(/[.-]/).map((part) => Number(part));
  const bParts = b.split(/[.-]/).map((part) => Number(part));
  const max = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < max; i += 1) {
    const av = Number.isFinite(aParts[i]) ? aParts[i] : 0;
    const bv = Number.isFinite(bParts[i]) ? bParts[i] : 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return a.localeCompare(b);
}

function normalizeIdentity(name: string, purl: string | null): string {
  if (purl) {
    const noQualifier = purl.split("?")[0];
    const atIndex = noQualifier.lastIndexOf("@");
    if (atIndex > 0) {
      return noQualifier.slice(0, atIndex).toLowerCase();
    }
    return noQualifier.toLowerCase();
  }
  return name.trim().toLowerCase();
}

function parseCycloneDx(payload: Record<string, unknown>): SbomComponent[] {
  const components = Array.isArray(payload.components) ? payload.components : [];
  return components
    .filter((component) => isObject(component))
    .map((component) => {
      const name = component.name ? String(component.name) : "unknown-component";
      const version = component.version ? String(component.version) : null;
      const purl = component.purl ? String(component.purl) : null;
      return {
        identity: normalizeIdentity(name, purl),
        name,
        version,
        purl,
        source: "cyclonedx" as const,
      };
    });
}

function parseSpdx(payload: Record<string, unknown>): SbomComponent[] {
  const packages = Array.isArray(payload.packages) ? payload.packages : [];
  return packages
    .filter((pkg) => isObject(pkg))
    .map((pkg) => {
      const name = pkg.name ? String(pkg.name) : "unknown-package";
      const version = pkg.versionInfo ? String(pkg.versionInfo) : null;

      let purl: string | null = null;
      if (Array.isArray(pkg.externalRefs)) {
        const purlRef = pkg.externalRefs.find((ref) => {
          if (!isObject(ref)) return false;
          const refType = ref.referenceType ? String(ref.referenceType).toLowerCase() : "";
          return refType.includes("purl");
        }) as Record<string, unknown> | undefined;
        if (purlRef?.referenceLocator) {
          purl = String(purlRef.referenceLocator);
        }
      }

      return {
        identity: normalizeIdentity(name, purl),
        name,
        version,
        purl,
        source: "spdx" as const,
      };
    });
}

export function parseSbomComponents(input: string): SbomComponent[] {
  if (!input.trim()) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("SBOM input must be valid JSON (CycloneDX or SPDX).");
  }

  if (!isObject(parsed)) {
    throw new Error("SBOM root must be a JSON object.");
  }

  if (String(parsed.bomFormat ?? "").toLowerCase() === "cyclonedx" || Array.isArray(parsed.components)) {
    return parseCycloneDx(parsed);
  }

  if (Array.isArray(parsed.packages) || parsed.SPDXID) {
    return parseSpdx(parsed);
  }

  throw new Error("Unsupported SBOM format. Provide CycloneDX or SPDX JSON.");
}

export function parseVulnerabilityHints(input: string): VulnerabilityHint[] {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const hints: VulnerabilityHint[] = [];
  for (const line of lines) {
    const csvParts = line.split(",").map((part) => part.trim());
    if (csvParts.length >= 3 && /^CVE-\d{4}-\d{4,7}$/i.test(csvParts[1])) {
      hints.push({
        component: normalizeIdentity(csvParts[0], null),
        cve: csvParts[1].toUpperCase(),
        severity: normalizeSeverity(csvParts[2]),
      });
      continue;
    }

    const match = line.match(/([A-Za-z0-9@_./-]+)\s+(CVE-\d{4}-\d{4,7})\s+(critical|high|medium|low)/i);
    if (match) {
      hints.push({
        component: normalizeIdentity(match[1], null),
        cve: match[2].toUpperCase(),
        severity: normalizeSeverity(match[3]),
      });
    }
  }

  return hints;
}

function riskFromScore(score: number): ComponentRisk {
  if (score >= 80) return "critical";
  if (score >= 55) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function severityWeight(severity: VulnerabilitySeverity): number {
  if (severity === "critical") return 35;
  if (severity === "high") return 22;
  if (severity === "medium") return 12;
  return 5;
}

function mapByIdentity(components: SbomComponent[]): Map<string, SbomComponent> {
  const map = new Map<string, SbomComponent>();
  components.forEach((component) => {
    const existing = map.get(component.identity);
    if (!existing) {
      map.set(component.identity, component);
      return;
    }

    if ((existing.version ?? "") < (component.version ?? "")) {
      map.set(component.identity, component);
    }
  });
  return map;
}

export function diffSboms(beforeInput: string, afterInput: string, vulnerabilitiesInput = ""): SbomDiffResult {
  const before = parseSbomComponents(beforeInput);
  const after = parseSbomComponents(afterInput);
  const vulnerabilityHints = parseVulnerabilityHints(vulnerabilitiesInput);

  const vulnMap = new Map<string, VulnerabilityHint[]>();
  vulnerabilityHints.forEach((hint) => {
    const existing = vulnMap.get(hint.component) ?? [];
    existing.push(hint);
    vulnMap.set(hint.component, existing);
  });

  const beforeMap = mapByIdentity(before);
  const afterMap = mapByIdentity(after);

  const identities = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  const items: SbomRiskItem[] = [];

  identities.forEach((identity) => {
    const beforeComponent = beforeMap.get(identity) ?? null;
    const afterComponent = afterMap.get(identity) ?? null;

    let change: ComponentChangeType;
    if (!beforeComponent && afterComponent) {
      change = "added";
    } else if (beforeComponent && !afterComponent) {
      change = "removed";
    } else if (beforeComponent && afterComponent) {
      const versionCompare = compareVersions(beforeComponent.version, afterComponent.version);
      if (versionCompare < 0) change = "upgraded";
      else if (versionCompare > 0) change = "downgraded";
      else change = "changed";
    } else {
      return;
    }

    const beforeVersion = beforeComponent?.version ?? null;
    const afterVersion = afterComponent?.version ?? null;
    const componentName = afterComponent?.name ?? beforeComponent?.name ?? identity;

    const vulnerabilities = vulnMap.get(identity) ?? [];
    let score = 0;
    const reasons: string[] = [];

    if (change === "added") {
      score += 15;
      reasons.push("New component introduced in target SBOM.");
    } else if (change === "downgraded") {
      score += 20;
      reasons.push("Component version downgrade detected.");
    } else if (change === "upgraded") {
      score += 8;
      reasons.push("Component version changed (upgrade).");
    } else if (change === "removed") {
      score += 5;
      reasons.push("Component removed; validate no dependency breakage.");
    }

    vulnerabilities.forEach((vulnerability) => {
      score += severityWeight(vulnerability.severity);
    });
    if (vulnerabilities.length > 0) {
      reasons.push(`${vulnerabilities.length} vulnerability hint(s) matched to component.`);
    }

    let risk = riskFromScore(score);
    const hasCriticalVuln = vulnerabilities.some((vulnerability) => vulnerability.severity === "critical");
    const hasHighVuln = vulnerabilities.some((vulnerability) => vulnerability.severity === "high");
    if (hasCriticalVuln && (change === "added" || change === "downgraded")) {
      risk = "critical";
    } else if (hasCriticalVuln && risk === "medium") {
      risk = "high";
    } else if (hasHighVuln && risk === "low") {
      risk = "medium";
    }

    items.push({
      component: componentName,
      beforeVersion,
      afterVersion,
      change,
      vulnerabilities,
      risk,
      reasons,
    });
  });

  items.sort((a, b) => {
    const riskWeight = (risk: ComponentRisk): number => {
      if (risk === "critical") return 4;
      if (risk === "high") return 3;
      if (risk === "medium") return 2;
      return 1;
    };
    const delta = riskWeight(b.risk) - riskWeight(a.risk);
    if (delta !== 0) return delta;
    return a.component.localeCompare(b.component);
  });

  return {
    items,
    summary: {
      total: items.length,
      added: items.filter((item) => item.change === "added").length,
      removed: items.filter((item) => item.change === "removed").length,
      upgraded: items.filter((item) => item.change === "upgraded").length,
      downgraded: items.filter((item) => item.change === "downgraded").length,
      changed: items.filter((item) => item.change === "changed").length,
      low: items.filter((item) => item.risk === "low").length,
      medium: items.filter((item) => item.risk === "medium").length,
      high: items.filter((item) => item.risk === "high").length,
      critical: items.filter((item) => item.risk === "critical").length,
    },
    notes:
      items.length === 0
        ? ["No components detected across SBOM inputs."]
        : ["Risk scoring is heuristic; cross-check with authoritative SCA and runtime exposure context."],
  };
}
