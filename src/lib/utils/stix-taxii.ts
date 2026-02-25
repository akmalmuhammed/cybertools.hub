export interface StixObject {
  type: string;
  id?: string;
  spec_version?: string;
  created?: string;
  modified?: string;
  [key: string]: unknown;
}

export interface StixBundle {
  type: "bundle";
  id: string;
  spec_version: string;
  objects: StixObject[];
}

export interface StixValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  objectCount: number;
}

export interface StixBundleComparison {
  added: string[];
  removed: string[];
  changed: string[];
  unchanged: number;
  summary: {
    before: number;
    after: number;
  };
}

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `bundle--${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (!isObject(value)) {
    return JSON.stringify(value);
  }
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function deriveObjectKey(object: StixObject, index: number): string {
  if (object.id) return object.id;
  return `${object.type || "object"}#${index}`;
}

function normalizeBundleFromUnknown(payload: unknown): StixBundle {
  if (isObject(payload) && payload.type === "bundle" && Array.isArray(payload.objects)) {
    const id = typeof payload.id === "string" && payload.id ? payload.id : randomId();
    const specVersion =
      typeof payload.spec_version === "string" && payload.spec_version
        ? payload.spec_version
        : "2.1";
    return {
      type: "bundle",
      id,
      spec_version: specVersion,
      objects: payload.objects.filter((item) => isObject(item)) as StixObject[],
    };
  }

  if (isObject(payload) && Array.isArray(payload.objects)) {
    // TAXII object envelope often carries an objects array but no explicit bundle wrapper.
    return {
      type: "bundle",
      id: randomId(),
      spec_version: "2.1",
      objects: payload.objects.filter((item) => isObject(item)) as StixObject[],
    };
  }

  if (Array.isArray(payload)) {
    return {
      type: "bundle",
      id: randomId(),
      spec_version: "2.1",
      objects: payload.filter((item) => isObject(item)) as StixObject[],
    };
  }

  if (isObject(payload) && typeof payload.type === "string") {
    return {
      type: "bundle",
      id: randomId(),
      spec_version: typeof payload.spec_version === "string" ? payload.spec_version : "2.1",
      objects: [payload as StixObject],
    };
  }

  throw new Error("Input is not valid STIX/TAXII JSON.");
}

export function parseStixOrTaxii(input: string): StixBundle {
  if (!input.trim()) {
    return {
      type: "bundle",
      id: randomId(),
      spec_version: "2.1",
      objects: [],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("Invalid JSON. STIX/TAXII utilities expect JSON input.");
  }

  return normalizeBundleFromUnknown(parsed);
}

export function validateStixBundle(bundle: StixBundle, expectedSpecVersion = "2.1"): StixValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (bundle.type !== "bundle") {
    errors.push("Root object type must be 'bundle'.");
  }

  if (!/^bundle--[0-9a-fA-F-]{20,}$/.test(bundle.id)) {
    warnings.push("Bundle ID does not match the canonical STIX bundle ID shape.");
  }

  bundle.objects.forEach((object, index) => {
    const objectRef = object.id ?? `${object.type || "object"}#${index}`;
    if (!object.type || typeof object.type !== "string") {
      errors.push(`Object ${objectRef} is missing 'type'.`);
      return;
    }

    const specVersion = object.spec_version ?? bundle.spec_version;
    if (specVersion !== expectedSpecVersion) {
      warnings.push(`Object ${objectRef} uses spec_version=${specVersion}; expected ${expectedSpecVersion}.`);
    }

    if (!object.id) {
      warnings.push(`Object ${objectRef} has no ID; TAXII envelope items should still have stable IDs.`);
    } else if (!object.id.startsWith(`${object.type}--`)) {
      errors.push(`Object ${object.id} ID prefix does not match type '${object.type}'.`);
    }

    if (object.created && object.modified) {
      const createdTs = Date.parse(object.created);
      const modifiedTs = Date.parse(object.modified);
      if (Number.isFinite(createdTs) && Number.isFinite(modifiedTs) && modifiedTs < createdTs) {
        errors.push(`Object ${objectRef} has modified earlier than created.`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    objectCount: bundle.objects.length,
  };
}

export function compareStixBundles(before: StixBundle, after: StixBundle): StixBundleComparison {
  const beforeMap = new Map<string, string>();
  const afterMap = new Map<string, string>();

  before.objects.forEach((object, index) => {
    beforeMap.set(deriveObjectKey(object, index), stableStringify(object));
  });
  after.objects.forEach((object, index) => {
    afterMap.set(deriveObjectKey(object, index), stableStringify(object));
  });

  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  let unchanged = 0;

  beforeMap.forEach((value, key) => {
    if (!afterMap.has(key)) {
      removed.push(key);
      return;
    }
    if (afterMap.get(key) !== value) {
      changed.push(key);
      return;
    }
    unchanged += 1;
  });

  afterMap.forEach((_value, key) => {
    if (!beforeMap.has(key)) {
      added.push(key);
    }
  });

  added.sort((a, b) => a.localeCompare(b));
  removed.sort((a, b) => a.localeCompare(b));
  changed.sort((a, b) => a.localeCompare(b));

  return {
    added,
    removed,
    changed,
    unchanged,
    summary: {
      before: before.objects.length,
      after: after.objects.length,
    },
  };
}

export function exportStixBundle(objects: StixObject[], options: { id?: string; specVersion?: string } = {}): string {
  const bundle: StixBundle = {
    type: "bundle",
    id: options.id && options.id.trim() ? options.id.trim() : randomId(),
    spec_version: options.specVersion && options.specVersion.trim() ? options.specVersion.trim() : "2.1",
    objects,
  };
  return JSON.stringify(bundle, null, 2);
}
