export type PortSeverity = "low" | "medium" | "high";
export type PortState =
  | "reachable"
  | "unreachable"
  | "timeout"
  | "not_supported"
  | "not_tested";

export interface PortAssessment {
  port: number;
  service: string;
  severity: PortSeverity;
  state: PortState;
  message: string;
  recommendation: string;
}

export interface PortAssessmentReport {
  host: string;
  ports: number[];
  results: PortAssessment[];
  notes: string[];
}

interface ServiceInfo {
  service: string;
  severity: PortSeverity;
  recommendation: string;
}

const DEFAULT_PORTS = [21, 22, 25, 53, 80, 110, 143, 443, 445, 3306, 3389, 8080];

const HTTP_PROBE_PORTS = new Set([80, 443, 8080, 8443, 3000, 5000]);

const SERVICE_MAP: Record<number, ServiceInfo> = {
  21: {
    service: "ftp",
    severity: "high",
    recommendation: "Disable FTP or enforce secure alternatives (SFTP/FTPS).",
  },
  22: {
    service: "ssh",
    severity: "medium",
    recommendation: "Restrict SSH by IP allowlist and key-based auth.",
  },
  23: {
    service: "telnet",
    severity: "high",
    recommendation: "Disable Telnet. Use SSH instead.",
  },
  25: {
    service: "smtp",
    severity: "medium",
    recommendation: "Limit relay and enforce SPF/DKIM/DMARC.",
  },
  53: {
    service: "dns",
    severity: "medium",
    recommendation: "Restrict recursion and monitor for amplification abuse.",
  },
  80: {
    service: "http",
    severity: "medium",
    recommendation: "Prefer HTTPS and redirect cleartext traffic.",
  },
  110: {
    service: "pop3",
    severity: "medium",
    recommendation: "Prefer encrypted protocols (POP3S/IMAPS).",
  },
  143: {
    service: "imap",
    severity: "medium",
    recommendation: "Enforce TLS and MFA for mailbox access.",
  },
  443: {
    service: "https",
    severity: "low",
    recommendation: "Maintain modern TLS config and certificate hygiene.",
  },
  445: {
    service: "smb",
    severity: "high",
    recommendation: "Block SMB from untrusted networks.",
  },
  3306: {
    service: "mysql",
    severity: "high",
    recommendation: "Do not expose DB ports publicly.",
  },
  3389: {
    service: "rdp",
    severity: "high",
    recommendation: "Protect RDP with VPN/jump host and MFA.",
  },
  8080: {
    service: "http-alt",
    severity: "medium",
    recommendation: "Audit admin interfaces and enforce auth/TLS.",
  },
  8443: {
    service: "https-alt",
    severity: "medium",
    recommendation: "Validate TLS and access controls on alternate HTTPS ports.",
  },
};

function isLikelyIPv6(host: string): boolean {
  return host.includes(":") && !host.startsWith("[");
}

function hostForUrl(host: string): string {
  return isLikelyIPv6(host) ? `[${host}]` : host;
}

function inferService(port: number): ServiceInfo {
  return (
    SERVICE_MAP[port] || {
      service: "unknown",
      severity: "low",
      recommendation: "Confirm whether this service needs internet exposure.",
    }
  );
}

function parsePortList(raw: string): number[] {
  const values = raw
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => Number(item));

  if (values.some((value) => !Number.isInteger(value) || value < 1 || value > 65535)) {
    throw new Error("Port list contains invalid values (must be 1-65535).");
  }

  return Array.from(new Set(values)).sort((a, b) => a - b);
}

export function parsePortCheckerInput(input: string): { host: string; ports: number[] } {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Host input is required");

  // URL form: https://example.com:8443
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const host = url.hostname.replace(/^\[|\]$/g, "");
      const inferredPort = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
      return { host, ports: [inferredPort] };
    } catch {
      throw new Error("Invalid URL format");
    }
  }

  // Two-part form: host 22,80,443
  const hostAndPorts = trimmed.match(/^(\S+)\s+(.+)$/);
  if (hostAndPorts) {
    const host = hostAndPorts[1].replace(/^\[|\]$/g, "");
    const ports = parsePortList(hostAndPorts[2]);
    return { host, ports };
  }

  // Bracketed IPv6 with optional port: [2001:db8::1]:443
  const bracketedIpv6 = trimmed.match(/^\[([0-9A-Fa-f:]+)\](?::(\d{1,5}))?$/);
  if (bracketedIpv6) {
    const host = bracketedIpv6[1];
    const port = bracketedIpv6[2] ? Number(bracketedIpv6[2]) : null;
    return { host, ports: port ? [port] : [...DEFAULT_PORTS] };
  }

  // IPv4 or domain with optional port.
  const hostPortMatch = trimmed.match(/^([a-z0-9.-]+)(?::(\d{1,5}))?$/i);
  if (hostPortMatch) {
    const host = hostPortMatch[1];
    const port = hostPortMatch[2] ? Number(hostPortMatch[2]) : null;
    if (port && (port < 1 || port > 65535)) {
      throw new Error("Port must be between 1 and 65535.");
    }
    return { host, ports: port ? [port] : [...DEFAULT_PORTS] };
  }

  // Raw IPv6 (no explicit port support in this shape).
  if (trimmed.includes(":")) {
    return { host: trimmed, ports: [...DEFAULT_PORTS] };
  }

  throw new Error("Could not parse host/port input.");
}

export async function probeHttpPort(
  host: string,
  port: number,
  timeoutMs = 3500,
): Promise<Exclude<PortState, "not_supported" | "not_tested">> {
  const protocol = port === 443 || port === 8443 ? "https" : "http";
  const url = `${protocol}://${hostForUrl(host)}:${port}/`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await fetch(url, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    return "reachable";
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") return "timeout";
    return "unreachable";
  } finally {
    clearTimeout(timer);
  }
}

export async function assessPorts(
  input: string,
  options: { probeWebPorts?: boolean; timeoutMs?: number } = {},
): Promise<PortAssessmentReport> {
  const { host, ports } = parsePortCheckerInput(input);
  const probeWebPorts = options.probeWebPorts ?? true;
  const timeoutMs = options.timeoutMs ?? 3500;

  const notes: string[] = [];
  const results: PortAssessment[] = ports.map((port) => {
    const info = inferService(port);
    return {
      port,
      service: info.service,
      severity: info.severity,
      state: "not_tested",
      message: "Not tested yet.",
      recommendation: info.recommendation,
    };
  });

  if (!probeWebPorts) {
    notes.push("Web probing disabled; returning service/risk intelligence only.");
    return { host, ports, results, notes };
  }

  const probeTasks = results.map(async (result) => {
    if (!HTTP_PROBE_PORTS.has(result.port)) {
      result.state = "not_supported";
      result.message =
        "Browser cannot reliably test this port/protocol client-side.";
      return;
    }

    const state = await probeHttpPort(host, result.port, timeoutMs);
    result.state = state;
    if (state === "reachable") {
      result.message = "HTTP(S) endpoint appears reachable from this browser.";
    } else if (state === "timeout") {
      result.message = "Connection attempt timed out.";
    } else {
      result.message = "Endpoint appears unreachable or blocked.";
    }
  });

  await Promise.all(probeTasks);

  notes.push(
    "Only HTTP(S)-compatible ports can be actively tested from the browser.",
  );
  notes.push(
    "Non-web protocols (e.g., SSH/SMB/DB) are shown as intelligence, not definitive reachability.",
  );

  return { host, ports, results, notes };
}
