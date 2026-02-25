interface GenericObject {
  [key: string]: unknown;
}

export interface MispStixMapperResult {
  bundle: GenericObject;
  summary: {
    attributes: number;
    mapped: number;
    unsupported: number;
  };
  warnings: string[];
  consistency: {
    duplicateIds: number;
    missingPattern: number;
  };
}

function isObject(value: unknown): value is GenericObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function pseudoHash(input: string): string {
  let h1 = 0x9e3779b1;
  let h2 = 0x85ebca6b;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x85ebca6b);
    h2 = Math.imul(h2 ^ code, 0xc2b2ae35);
  }
  const hex = ((h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0")).repeat(2);
  return hex.slice(0, 32);
}

function toStixUuid(seed: string): string {
  const hash = pseudoHash(seed);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function mapAttributeToPattern(type: string, value: string): string | null {
  const normalizedType = type.trim().toLowerCase();
  if (normalizedType === "ip-src" || normalizedType === "ip-dst" || normalizedType === "ip") {
    return `[ipv4-addr:value = '${value}']`;
  }
  if (normalizedType === "domain" || normalizedType === "hostname") {
    return `[domain-name:value = '${value}']`;
  }
  if (normalizedType === "url") {
    return `[url:value = '${value}']`;
  }
  if (normalizedType === "md5") {
    return `[file:hashes.MD5 = '${value}']`;
  }
  if (normalizedType === "sha1") {
    return `[file:hashes.'SHA-1' = '${value}']`;
  }
  if (normalizedType === "sha256") {
    return `[file:hashes.'SHA-256' = '${value}']`;
  }
  if (normalizedType === "email-src" || normalizedType === "email-dst" || normalizedType === "email") {
    return `[email-addr:value = '${value}']`;
  }
  return null;
}

function readMispAttributes(payload: GenericObject): GenericObject[] {
  if (Array.isArray(payload.Attribute)) {
    return payload.Attribute.filter((item) => isObject(item)) as GenericObject[];
  }
  if (isObject(payload.Event) && Array.isArray(payload.Event.Attribute)) {
    return payload.Event.Attribute.filter((item) => isObject(item)) as GenericObject[];
  }
  if (Array.isArray(payload.attributes)) {
    return payload.attributes.filter((item) => isObject(item)) as GenericObject[];
  }
  return [];
}

export function mapMispToStixBundle(input: string): MispStixMapperResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("MISP input must be valid JSON.");
  }
  if (!isObject(parsed)) {
    throw new Error("MISP root must be an object.");
  }

  const attributes = readMispAttributes(parsed);
  const warnings: string[] = [];
  const stixObjects: GenericObject[] = [];
  let unsupported = 0;

  attributes.forEach((attribute, index) => {
    const type = String(attribute.type ?? attribute.category ?? "").trim();
    const value = String(attribute.value ?? "").trim();
    if (!type || !value) {
      warnings.push(`Attribute ${index + 1} skipped due to missing type/value.`);
      unsupported += 1;
      return;
    }

    const pattern = mapAttributeToPattern(type, value);
    if (!pattern) {
      warnings.push(`Unsupported MISP attribute type: ${type}.`);
      unsupported += 1;
      return;
    }

    const stixId = `indicator--${toStixUuid(`${type}:${value}`)}`;
    stixObjects.push({
      type: "indicator",
      spec_version: "2.1",
      id: stixId,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      pattern_type: "stix",
      pattern,
      labels: ["misp-import"],
      confidence: 50,
      name: String(attribute.comment ?? `${type} indicator`),
      external_references: [{
        source_name: "misp",
        external_id: String(attribute.uuid ?? attribute.id ?? index + 1),
      }],
    });
  });

  const bundle = {
    type: "bundle",
    id: `bundle--${toStixUuid(`bundle:${JSON.stringify(stixObjects)}`)}`,
    spec_version: "2.1",
    objects: stixObjects,
  };

  const idSet = new Set<string>();
  let duplicateIds = 0;
  let missingPattern = 0;
  for (const object of stixObjects) {
    const id = String(object.id ?? "");
    if (idSet.has(id)) duplicateIds += 1;
    idSet.add(id);
    if (!object.pattern) missingPattern += 1;
  }

  if (duplicateIds > 0) {
    warnings.push(`Detected ${duplicateIds} duplicate STIX object ID(s).`);
  }
  if (missingPattern > 0) {
    warnings.push(`Detected ${missingPattern} indicator(s) missing pattern.`);
  }

  return {
    bundle,
    summary: {
      attributes: attributes.length,
      mapped: stixObjects.length,
      unsupported,
    },
    warnings,
    consistency: {
      duplicateIds,
      missingPattern,
    },
  };
}
