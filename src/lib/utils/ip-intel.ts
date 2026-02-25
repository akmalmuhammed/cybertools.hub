export type IpVersion = "IPv4" | "IPv6";

export interface IpClassification {
  type: string;
  scope: "public" | "private" | "reserved";
  description: string;
}

export interface ParsedRdapIp {
  handle: string | null;
  name: string | null;
  country: string | null;
  type: string | null;
  startAddress: string | null;
  endAddress: string | null;
  entities: string[];
}

export interface IpLookupResult {
  ip: string;
  version: IpVersion;
  classification: IpClassification;
  rdap: ParsedRdapIp | null;
  source: "local" | "rdap";
  notes: string[];
}

function ipv4ToInt(ip: string): number {
  return ip
    .split(".")
    .map((part) => Number(part))
    .reduce((acc, value) => ((acc << 8) + value) >>> 0, 0);
}

function inIpv4Range(ip: string, start: string, end: string): boolean {
  const value = ipv4ToInt(ip);
  return value >= ipv4ToInt(start) && value <= ipv4ToInt(end);
}

function extractVCardValue(vcard: unknown, key: string): string | null {
  if (!Array.isArray(vcard)) return null;
  const entry = vcard.find(
    (item): item is [string, unknown, unknown, unknown] =>
      Array.isArray(item) && item[0] === key && item.length >= 4,
  );
  return entry && entry.length >= 4 ? String(entry[3]) : null;
}

export function normalizeIpInput(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      return url.hostname.replace(/^\[|\]$/g, "");
    } catch {
      return trimmed;
    }
  }

  const bracketedIpv6 = trimmed.match(/^\[([0-9A-Fa-f:]+)\](?::\d+)?$/);
  if (bracketedIpv6) {
    return bracketedIpv6[1];
  }

  const ipv4WithPort = trimmed.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
  if (ipv4WithPort) {
    return ipv4WithPort[1];
  }

  return trimmed;
}

export function isIPv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const value = Number(part);
    return value >= 0 && value <= 255;
  });
}

export function isIPv6(ip: string): boolean {
  const candidate = ip.trim();
  if (!candidate.includes(":")) return false;

  // Supports compressed, full, and IPv4-mapped IPv6.
  const ipv6Regex =
    /^((?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}|(?:[A-Fa-f0-9]{1,4}:){1,7}:|(?:[A-Fa-f0-9]{1,4}:){1,6}:[A-Fa-f0-9]{1,4}|(?:[A-Fa-f0-9]{1,4}:){1,5}(?::[A-Fa-f0-9]{1,4}){1,2}|(?:[A-Fa-f0-9]{1,4}:){1,4}(?::[A-Fa-f0-9]{1,4}){1,3}|(?:[A-Fa-f0-9]{1,4}:){1,3}(?::[A-Fa-f0-9]{1,4}){1,4}|(?:[A-Fa-f0-9]{1,4}:){1,2}(?::[A-Fa-f0-9]{1,4}){1,5}|[A-Fa-f0-9]{1,4}:(?::[A-Fa-f0-9]{1,4}){1,6}|:(?::[A-Fa-f0-9]{1,4}){1,7}|::|(?:[A-Fa-f0-9]{1,4}:){6}(?:\d{1,3}\.){3}\d{1,3}|(?:[A-Fa-f0-9]{1,4}:){1,5}:(?:\d{1,3}\.){3}\d{1,3})$/;

  return ipv6Regex.test(candidate);
}

export function classifyIp(ip: string): IpClassification {
  if (isIPv4(ip)) {
    if (inIpv4Range(ip, "10.0.0.0", "10.255.255.255")) {
      return {
        type: "Private (RFC1918)",
        scope: "private",
        description: "Internal address space. Not publicly routable.",
      };
    }
    if (inIpv4Range(ip, "172.16.0.0", "172.31.255.255")) {
      return {
        type: "Private (RFC1918)",
        scope: "private",
        description: "Internal address space. Not publicly routable.",
      };
    }
    if (inIpv4Range(ip, "192.168.0.0", "192.168.255.255")) {
      return {
        type: "Private (RFC1918)",
        scope: "private",
        description: "Internal address space. Not publicly routable.",
      };
    }
    if (inIpv4Range(ip, "127.0.0.0", "127.255.255.255")) {
      return {
        type: "Loopback",
        scope: "reserved",
        description: "Local host loopback range.",
      };
    }
    if (inIpv4Range(ip, "169.254.0.0", "169.254.255.255")) {
      return {
        type: "Link-Local",
        scope: "reserved",
        description: "Self-assigned local network address (APIPA).",
      };
    }
    if (inIpv4Range(ip, "100.64.0.0", "100.127.255.255")) {
      return {
        type: "Carrier-Grade NAT",
        scope: "reserved",
        description: "Shared address space for ISP NAT.",
      };
    }
    if (
      inIpv4Range(ip, "192.0.2.0", "192.0.2.255") ||
      inIpv4Range(ip, "198.51.100.0", "198.51.100.255") ||
      inIpv4Range(ip, "203.0.113.0", "203.0.113.255")
    ) {
      return {
        type: "Documentation",
        scope: "reserved",
        description: "Reserved for examples and documentation.",
      };
    }
    if (inIpv4Range(ip, "198.18.0.0", "198.19.255.255")) {
      return {
        type: "Benchmark Testing",
        scope: "reserved",
        description: "Reserved for benchmark performance testing.",
      };
    }
    if (inIpv4Range(ip, "224.0.0.0", "239.255.255.255")) {
      return {
        type: "Multicast",
        scope: "reserved",
        description: "Multicast address range.",
      };
    }
    if (inIpv4Range(ip, "240.0.0.0", "255.255.255.255")) {
      return {
        type: "Reserved / Experimental",
        scope: "reserved",
        description: "Reserved or broadcast space.",
      };
    }
    return {
      type: "Public",
      scope: "public",
      description: "Publicly routable internet address.",
    };
  }

  const lower = ip.toLowerCase();
  if (lower === "::1") {
    return {
      type: "Loopback",
      scope: "reserved",
      description: "Local host loopback address.",
    };
  }
  if (lower === "::") {
    return {
      type: "Unspecified",
      scope: "reserved",
      description: "Unspecified source address.",
    };
  }
  if (lower.startsWith("fc") || lower.startsWith("fd")) {
    return {
      type: "Unique Local (ULA)",
      scope: "private",
      description: "Private IPv6 range (not globally routable).",
    };
  }
  if (
    lower.startsWith("fe8") ||
    lower.startsWith("fe9") ||
    lower.startsWith("fea") ||
    lower.startsWith("feb")
  ) {
    return {
      type: "Link-Local",
      scope: "reserved",
      description: "Link-local IPv6 range.",
    };
  }
  if (lower.startsWith("ff")) {
    return {
      type: "Multicast",
      scope: "reserved",
      description: "IPv6 multicast range.",
    };
  }
  if (lower.startsWith("2001:db8")) {
    return {
      type: "Documentation",
      scope: "reserved",
      description: "Reserved for documentation examples.",
    };
  }

  return {
    type: "Global Unicast",
    scope: "public",
    description: "Publicly routable IPv6 address.",
  };
}

export function parseRdapIpResponse(payload: unknown): ParsedRdapIp {
  const safePayload =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};

  const entities: string[] = [];
  if (Array.isArray(safePayload.entities)) {
    safePayload.entities.forEach((entity) => {
      if (!entity || typeof entity !== "object") return;
      const safeEntity = entity as Record<string, unknown>;
      const vcardArray = Array.isArray(safeEntity.vcardArray)
        ? safeEntity.vcardArray
        : null;
      const vcard = vcardArray?.[1];
      const org = extractVCardValue(vcard, "org");
      const fn = extractVCardValue(vcard, "fn");
      if (org) entities.push(org);
      else if (fn) entities.push(fn);
      else if (safeEntity.handle) entities.push(String(safeEntity.handle));
    });
  }

  return {
    handle: safePayload.handle ? String(safePayload.handle) : null,
    name: safePayload.name ? String(safePayload.name) : null,
    country: safePayload.country ? String(safePayload.country) : null,
    type: safePayload.type ? String(safePayload.type) : null,
    startAddress: safePayload.startAddress ? String(safePayload.startAddress) : null,
    endAddress: safePayload.endAddress ? String(safePayload.endAddress) : null,
    entities: Array.from(new Set(entities)).filter(Boolean),
  };
}

export async function lookupIpIntel(
  input: string,
  fetchRdap = true,
  timeoutMs = 6000,
): Promise<IpLookupResult> {
  const ip = normalizeIpInput(input);
  if (!ip) {
    throw new Error("IP address is required");
  }

  let version: IpVersion;
  if (isIPv4(ip)) version = "IPv4";
  else if (isIPv6(ip)) version = "IPv6";
  else throw new Error("Invalid IP address");

  const classification = classifyIp(ip);
  const notes: string[] = [];
  let rdap: ParsedRdapIp | null = null;
  let source: IpLookupResult["source"] = "local";

  if (fetchRdap) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`https://rdap.org/ip/${encodeURIComponent(ip)}`, {
        signal: controller.signal,
      });
      if (response.ok) {
        const data = await response.json();
        rdap = parseRdapIpResponse(data);
        source = "rdap";
      } else {
        notes.push(`RDAP lookup failed with HTTP ${response.status}.`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        notes.push(`RDAP lookup timed out after ${timeoutMs}ms.`);
      } else {
        notes.push("RDAP lookup failed (network/CORS issue).");
      }
    } finally {
      clearTimeout(timer);
    }
  }

  if (source === "local") {
    notes.push("Showing local classification only.");
  }

  return { ip, version, classification, rdap, source, notes };
}
