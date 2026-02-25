interface LockPackage {
  name: string;
  version: string;
}

export interface LockfileRiskItem {
  package: string;
  beforeVersion: string | null;
  afterVersion: string | null;
  change: "added" | "removed" | "updated";
  risk: "low" | "medium" | "high";
  reasons: string[];
}

export interface LockfileRiskDiffResult {
  items: LockfileRiskItem[];
  summary: {
    total: number;
    added: number;
    removed: number;
    updated: number;
    high: number;
    medium: number;
    low: number;
  };
  notes: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseFromPackageLock(payload: Record<string, unknown>): LockPackage[] {
  const packages: LockPackage[] = [];

  if (isObject(payload.packages)) {
    Object.entries(payload.packages).forEach(([path, rawPackage]) => {
      if (!isObject(rawPackage)) return;
      if (!("version" in rawPackage)) return;
      const version = String(rawPackage.version);
      let name = "";
      if (path.startsWith("node_modules/")) {
        name = path.slice("node_modules/".length);
      } else if (path.includes("node_modules/")) {
        name = path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
      } else if (typeof rawPackage.name === "string") {
        name = rawPackage.name;
      }
      if (!name || !version) return;
      packages.push({ name, version });
    });
  }

  if (isObject(payload.dependencies)) {
    Object.entries(payload.dependencies).forEach(([name, rawDependency]) => {
      if (!isObject(rawDependency) || !rawDependency.version) return;
      packages.push({
        name,
        version: String(rawDependency.version),
      });
    });
  }

  return packages;
}

function parseFromPnpmLock(payload: Record<string, unknown>): LockPackage[] {
  if (!isObject(payload.packages)) return [];
  return Object.entries(payload.packages)
    .map(([key]) => {
      const normalized = key.replace(/^\//, "");
      const atIndex = normalized.lastIndexOf("@");
      if (atIndex <= 0) return null;
      return {
        name: normalized.slice(0, atIndex),
        version: normalized.slice(atIndex + 1),
      };
    })
    .filter((item): item is LockPackage => !!item);
}

function parseLockPackages(input: string): LockPackage[] {
  if (!input.trim()) return [];

  try {
    const parsed = JSON.parse(input);
    if (isObject(parsed)) {
      const fromPackageLock = parseFromPackageLock(parsed);
      const fromPnpm = parseFromPnpmLock(parsed);
      const combined = [...fromPackageLock, ...fromPnpm];
      if (combined.length > 0) return combined;
    }
  } catch {
    // fallback to line parser
  }

  const linePackages: LockPackage[] = [];
  input.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const match = trimmed.match(/^(@?[^@\s]+(?:\/[^@\s]+)?)@([0-9A-Za-z.+_-]+)$/);
    if (!match) return;
    linePackages.push({ name: match[1], version: match[2] });
  });
  return linePackages;
}

function mapPackages(packages: LockPackage[]): Map<string, string> {
  const map = new Map<string, string>();
  packages.forEach((pkg) => map.set(pkg.name, pkg.version));
  return map;
}

function distanceOneOrLess(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;

  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (a.length < b.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  if (i < a.length || j < b.length) edits += 1;
  return edits <= 1;
}

function parseNamespaces(value: string): string[] {
  return value
    .split(/[,\s]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function diffLockfileRisk(
  beforeInput: string,
  afterInput: string,
  internalNamespaces = "",
): LockfileRiskDiffResult {
  const beforePackages = parseLockPackages(beforeInput);
  const afterPackages = parseLockPackages(afterInput);
  const beforeMap = mapPackages(beforePackages);
  const afterMap = mapPackages(afterPackages);
  const namespaces = parseNamespaces(internalNamespaces);

  const packageNames = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  const items: LockfileRiskItem[] = [];

  packageNames.forEach((name) => {
    const beforeVersion = beforeMap.get(name) ?? null;
    const afterVersion = afterMap.get(name) ?? null;
    if (!beforeVersion && !afterVersion) return;
    if (beforeVersion && afterVersion && beforeVersion === afterVersion) return;

    const reasons: string[] = [];
    let risk: LockfileRiskItem["risk"] = "low";
    let change: LockfileRiskItem["change"] = "updated";
    if (!beforeVersion && afterVersion) change = "added";
    else if (beforeVersion && !afterVersion) change = "removed";

    if (change === "added") {
      reasons.push("New dependency introduced.");
      risk = "medium";

      const nearestExisting = [...beforeMap.keys()].find((existing) => distanceOneOrLess(existing, name));
      if (nearestExisting && nearestExisting !== name) {
        reasons.push(`Name is very similar to existing package "${nearestExisting}" (typosquat risk).`);
        risk = "high";
      }

      if (namespaces.length > 0 && !name.startsWith("@")) {
        const namespaceHit = namespaces.find((namespace) => {
          const token = namespace.replace(/^@/, "").toLowerCase();
          return token.length > 0 && name.toLowerCase().includes(token);
        });
        if (namespaceHit) {
          reasons.push(`Unscoped package resembles internal namespace "${namespaceHit}" (dependency confusion risk).`);
          risk = "high";
        }
      }
    } else if (change === "updated") {
      reasons.push(`Version changed from ${beforeVersion} to ${afterVersion}.`);
    } else {
      reasons.push("Dependency removed.");
    }

    items.push({
      package: name,
      beforeVersion,
      afterVersion,
      change,
      risk,
      reasons,
    });
  });

  items.sort((a, b) => {
    const weight = (risk: LockfileRiskItem["risk"]) => {
      if (risk === "high") return 3;
      if (risk === "medium") return 2;
      return 1;
    };
    const delta = weight(b.risk) - weight(a.risk);
    if (delta !== 0) return delta;
    return a.package.localeCompare(b.package);
  });

  return {
    items,
    summary: {
      total: items.length,
      added: items.filter((item) => item.change === "added").length,
      removed: items.filter((item) => item.change === "removed").length,
      updated: items.filter((item) => item.change === "updated").length,
      high: items.filter((item) => item.risk === "high").length,
      medium: items.filter((item) => item.risk === "medium").length,
      low: items.filter((item) => item.risk === "low").length,
    },
    notes: [
      "Risk scoring is heuristic and intended for review prioritization.",
      "Use namespace pinning and private registry controls to reduce dependency confusion risk.",
    ],
  };
}
