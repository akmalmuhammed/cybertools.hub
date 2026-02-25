export interface ParsedRdapDomain {
  domain: string;
  handle: string | null;
  registrar: string | null;
  status: string[];
  createdAt: string | null;
  updatedAt: string | null;
  expiresAt: string | null;
  nameservers: string[];
  dnssec: string | null;
  notices: string[];
}

export interface WhoisLookupResult {
  query: string;
  source: "rdap";
  data: ParsedRdapDomain;
}

function extractVCardValue(vcard: unknown, key: string): string | null {
  if (!Array.isArray(vcard)) return null;
  const entry = vcard.find(
    (item): item is [string, unknown, unknown, unknown] =>
      Array.isArray(item) && item[0] === key && item.length >= 4,
  );
  return entry && entry.length >= 4 ? String(entry[3]) : null;
}

function extractRegistrarName(entities: unknown[]): string | null {
  for (const entity of entities) {
    const safeEntity = (entity && typeof entity === "object"
      ? (entity as Record<string, unknown>)
      : {}) as Record<string, unknown>;
    const roles = Array.isArray(safeEntity.roles)
      ? safeEntity.roles
      : [];
    if (!roles.includes("registrar")) continue;

    const vcardArray = Array.isArray(safeEntity.vcardArray)
      ? safeEntity.vcardArray
      : null;
    const vcard = vcardArray?.[1];
    const org = extractVCardValue(vcard, "org");
    const fn = extractVCardValue(vcard, "fn");
    if (org) return org;
    if (fn) return fn;
    if (safeEntity.handle) return String(safeEntity.handle);
  }
  return null;
}

function eventDate(events: unknown[], action: string): string | null {
  const event = events.find((item) => {
    if (!item || typeof item !== "object") return false;
    return (item as Record<string, unknown>).eventAction === action;
  }) as Record<string, unknown> | undefined;
  return event?.eventDate ? String(event.eventDate) : null;
}

export function normalizeDomainInput(rawInput: string): string {
  const trimmed = rawInput.trim().toLowerCase();
  if (!trimmed) return "";

  let candidate = trimmed;
  if (/^https?:\/\//.test(trimmed)) {
    try {
      candidate = new URL(trimmed).hostname.toLowerCase();
    } catch {
      candidate = trimmed;
    }
  }

  candidate = candidate.replace(/\.$/, "");
  candidate = candidate.replace(/^www\./, "");

  const slashIndex = candidate.indexOf("/");
  if (slashIndex >= 0) {
    candidate = candidate.slice(0, slashIndex);
  }

  return candidate;
}

export function isValidDomain(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  if (!domain.includes(".")) return false;

  const labels = domain.split(".");
  return labels.every((label) => {
    if (!label || label.length > 63) return false;
    if (!/^[a-z0-9-]+$/i.test(label)) return false;
    if (label.startsWith("-") || label.endsWith("-")) return false;
    return true;
  });
}

export function parseRdapDomainResponse(payload: unknown): ParsedRdapDomain {
  const safePayload =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};

  const ldhName = safePayload.ldhName ? String(safePayload.ldhName).toLowerCase() : "";
  const unicodeName = safePayload.unicodeName ? String(safePayload.unicodeName) : null;
  const domain = unicodeName || ldhName || "unknown";

  const events = Array.isArray(safePayload.events) ? safePayload.events : [];
  const entities = Array.isArray(safePayload.entities) ? safePayload.entities : [];

  return {
    domain,
    handle: safePayload.handle ? String(safePayload.handle) : null,
    registrar: extractRegistrarName(entities),
    status: Array.isArray(safePayload.status)
      ? safePayload.status.map((value) => String(value))
      : [],
    createdAt: eventDate(events, "registration"),
    updatedAt: eventDate(events, "last changed"),
    expiresAt: eventDate(events, "expiration"),
    nameservers: Array.isArray(safePayload.nameservers)
      ? safePayload.nameservers
          .map((ns) => {
            if (!ns || typeof ns !== "object") return null;
            const safeNs = ns as Record<string, unknown>;
            return safeNs.ldhName || safeNs.unicodeName;
          })
          .filter(Boolean)
          .map((name) => String(name).toLowerCase())
      : [],
    dnssec:
      typeof (safePayload.secureDNS as Record<string, unknown> | undefined)?.delegationSigned === "boolean"
        ? (safePayload.secureDNS as Record<string, unknown>).delegationSigned
          ? "signed"
          : "unsigned"
        : null,
    notices: Array.isArray(safePayload.notices)
      ? safePayload.notices
          .map((notice) => {
            if (!notice || typeof notice !== "object") return "";
            const safeNotice = notice as Record<string, unknown>;
            const title = safeNotice.title ? `${safeNotice.title}` : "";
            const description = Array.isArray(safeNotice.description)
              ? safeNotice.description.join(" ")
              : "";
            return `${title} ${description}`.trim();
          })
          .filter(Boolean)
      : [],
  };
}

export async function lookupWhois(
  domainInput: string,
  options: { timeoutMs?: number } = {},
): Promise<WhoisLookupResult> {
  const domain = normalizeDomainInput(domainInput);
  if (!domain) throw new Error("Domain is required");
  if (!isValidDomain(domain)) throw new Error("Invalid domain format");

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 6000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("WHOIS lookup timed out.");
    }
    throw new Error("WHOIS lookup failed (network/CORS issue).");
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`WHOIS lookup failed with HTTP ${response.status}.`);
  }

  const payload = await response.json();
  return {
    query: domain,
    source: "rdap",
    data: parseRdapDomainResponse(payload),
  };
}
