import { extractIocs, IocType } from "./ioc.js";

export interface IocCorrelationByType {
  type: IocType;
  shared: string[];
  onlySourceA: string[];
  onlySourceB: string[];
}

export interface IocCorrelationSummary {
  totalSourceA: number;
  totalSourceB: number;
  shared: number;
  uniqueSourceA: number;
  uniqueSourceB: number;
  overlapPercent: number;
}

export interface IocCorrelationResult {
  summary: IocCorrelationSummary;
  byType: IocCorrelationByType[];
}

const IOC_TYPES: IocType[] = [
  "url",
  "domain",
  "email",
  "ipv4",
  "ipv6",
  "md5",
  "sha1",
  "sha256",
  "sha512",
  "cve",
];

function intersect(valuesA: string[], valuesB: string[]): string[] {
  const setB = new Set(valuesB);
  return valuesA.filter((value) => setB.has(value));
}

function difference(valuesA: string[], valuesB: string[]): string[] {
  const setB = new Set(valuesB);
  return valuesA.filter((value) => !setB.has(value));
}

function sortValues(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

export function correlateIocSources(
  sourceA: string,
  sourceB: string,
  options: { includePrivateIps?: boolean } = {},
): IocCorrelationResult {
  const parsedA = extractIocs(sourceA, {
    includePrivateIps: options.includePrivateIps ?? false,
  });
  const parsedB = extractIocs(sourceB, {
    includePrivateIps: options.includePrivateIps ?? false,
  });

  const byType = IOC_TYPES.map((type) => {
    const valuesA = sortValues(parsedA.items[type]);
    const valuesB = sortValues(parsedB.items[type]);
    return {
      type,
      shared: sortValues(intersect(valuesA, valuesB)),
      onlySourceA: sortValues(difference(valuesA, valuesB)),
      onlySourceB: sortValues(difference(valuesB, valuesA)),
    };
  });

  const totalSourceA = byType.reduce(
    (sum, bucket) => sum + bucket.shared.length + bucket.onlySourceA.length,
    0,
  );
  const totalSourceB = byType.reduce(
    (sum, bucket) => sum + bucket.shared.length + bucket.onlySourceB.length,
    0,
  );
  const shared = byType.reduce((sum, bucket) => sum + bucket.shared.length, 0);
  const uniqueSourceA = byType.reduce(
    (sum, bucket) => sum + bucket.onlySourceA.length,
    0,
  );
  const uniqueSourceB = byType.reduce(
    (sum, bucket) => sum + bucket.onlySourceB.length,
    0,
  );
  const denominator = Math.max(totalSourceA, totalSourceB, 1);
  const overlapPercent = Number(((shared / denominator) * 100).toFixed(2));

  return {
    summary: {
      totalSourceA,
      totalSourceB,
      shared,
      uniqueSourceA,
      uniqueSourceB,
      overlapPercent,
    },
    byType,
  };
}
