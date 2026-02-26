import { useMemo, useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import {
  runDnsToolkit,
  type DnsRecordType,
  type DnsToolkitResult,
} from "@/lib/utils/dns-toolkit"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

const AVAILABLE_TYPES: DnsRecordType[] = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "CAA"]

export default function DnsToolkitTool() {
  const [selectedTypes, setSelectedTypes] = useState<Record<DnsRecordType, boolean>>({
    A: true,
    AAAA: true,
    CNAME: true,
    MX: true,
    TXT: true,
    NS: true,
    SOA: false,
    CAA: false,
  })
  const [timeoutMs, setTimeoutMs] = useState("6000")
  const [strictMailPolicy, setStrictMailPolicy] = useState(true)
  const [requireDmarcReporting, setRequireDmarcReporting] = useState(false)
  const [minimumDmarcPct, setMinimumDmarcPct] = useState("100")

  const enabledTypes = useMemo(
    () => AVAILABLE_TYPES.filter((type) => selectedTypes[type]),
    [selectedTypes],
  )

  const process = async (input: string) => {
    if (enabledTypes.length === 0) throw new Error("Select at least one DNS record type.")

    const timeout = Number(timeoutMs) || 6000
    const result = await runDnsToolkit(input, enabledTypes, { timeoutMs: timeout })
    const findings: ToolFinding[] = []

    const spf = result.spf
    const dmarc = result.dmarc
    const hasTxtLookup = enabledTypes.includes("TXT")
    const dmarcPctFloor = Math.max(0, Math.min(100, Number(minimumDmarcPct) || 100))

    if (strictMailPolicy) {
      if (!hasTxtLookup) {
        findings.push({
          id: "dns-policy-txt-disabled",
          severity: "low",
          confidence: 74,
          category: "visibility-gap",
          title: "TXT lookup disabled for strict mail policy",
          description: "SPF validation is incomplete because TXT records were not queried.",
          remediation: "Enable TXT query type when strict mail-policy checks are required.",
        })
      } else if (!spf) {
        findings.push({
          id: "dns-missing-spf",
          severity: "high",
          confidence: 86,
          category: "email-authentication",
          title: "SPF record not found",
          description: "No SPF policy detected in TXT records.",
          remediation: "Publish SPF with explicit sender allowlist and hard fail policy where possible.",
        })
      } else {
        if (!spf.hasHardFail) {
          findings.push({
            id: "dns-spf-no-hardfail",
            severity: "medium",
            confidence: 78,
            category: "email-authentication",
            title: "SPF lacks hard fail",
            description: "SPF policy does not enforce `-all` hard fail.",
            remediation: "Review sender inventory and transition toward stricter SPF enforcement.",
          })
        }

        if (spf.hasNeutralAll) {
          findings.push({
            id: "dns-spf-neutral-all",
            severity: "medium",
            confidence: 72,
            category: "email-authentication",
            title: "SPF uses neutral `?all`",
            description: "SPF neutral mode weakens enforcement and allows ambiguous receiver handling.",
            remediation: "Move from neutral SPF posture to explicit `~all` then `-all` after validation.",
          })
        }

        if (spf.includes.length > 10) {
          findings.push({
            id: "dns-spf-include-over-limit",
            severity: "high",
            confidence: 84,
            category: "email-authentication",
            title: "SPF include chain likely exceeds DNS lookup limits",
            description: `SPF contains ${spf.includes.length} include mechanisms; operational DNS lookup limits may be exceeded.`,
            remediation: "Flatten SPF includes and remove stale third-party sender dependencies.",
          })
        } else if (spf.includes.length >= 7) {
          findings.push({
            id: "dns-spf-include-near-limit",
            severity: "low",
            confidence: 70,
            category: "email-authentication",
            title: "SPF include chain approaching operational limit",
            description: `SPF contains ${spf.includes.length} include mechanisms.`,
            remediation: "Track SPF lookup budget and simplify include chain before failures emerge.",
          })
        }
      }

      if (!dmarc) {
        findings.push({
          id: "dns-missing-dmarc",
          severity: "high",
          confidence: 87,
          category: "email-authentication",
          title: "DMARC record not found",
          description: "No DMARC TXT record detected at _dmarc subdomain.",
          remediation: "Publish DMARC with reporting addresses and staged policy enforcement.",
        })
      }
    } else {
      findings.push({
        id: "dns-strict-mail-policy-disabled",
        severity: "info",
        confidence: 72,
        category: "workflow-mode",
        title: "Strict mail policy checks disabled",
        description: "Mail-auth hardening findings are running in advisory mode.",
        remediation: "Enable strict mail policy mode for enforcement-oriented DNS posture scoring.",
      })
    }

    if (dmarc) {
      if (dmarc.policy === "none") {
        findings.push({
          id: "dns-dmarc-monitoring-only",
          severity: strictMailPolicy ? "medium" : "low",
          confidence: 76,
          category: "email-authentication",
          title: "DMARC policy set to monitoring-only",
          description: "DMARC policy is `p=none` and does not enforce quarantine/reject.",
          remediation: "Progressively move toward `quarantine` or `reject` after alignment monitoring.",
        })
      }

      if (typeof dmarc.pct === "number" && dmarc.pct < dmarcPctFloor) {
        findings.push({
          id: "dns-dmarc-low-enforcement-pct",
          severity: strictMailPolicy ? "medium" : "low",
          confidence: 73,
          category: "email-authentication",
          title: "DMARC enforcement percentage below policy floor",
          description: `DMARC pct=${dmarc.pct}, configured minimum=${dmarcPctFloor}.`,
          remediation: "Increase DMARC percentage gradually toward full coverage after alignment confidence.",
        })
      }

      if (requireDmarcReporting && dmarc.rua.length === 0) {
        findings.push({
          id: "dns-dmarc-rua-missing",
          severity: "medium",
          confidence: 78,
          category: "email-authentication",
          title: "DMARC aggregate reporting (rua) missing",
          description: "DMARC reporting is required by policy but no `rua` destination is configured.",
          remediation: "Add monitored aggregate report mailboxes and automate report ingestion.",
        })
      }

      if (requireDmarcReporting && dmarc.ruf.length === 0) {
        findings.push({
          id: "dns-dmarc-ruf-missing",
          severity: "low",
          confidence: 69,
          category: "email-authentication",
          title: "DMARC forensic reporting (ruf) missing",
          description: "Policy requested forensic reporting but no `ruf` address was configured.",
          remediation: "Add controlled forensic reporting address if operationally appropriate.",
        })
      }

      const relaxedAlignment = dmarc.alignment.adkim !== "s" || dmarc.alignment.aspf !== "s"
      if (relaxedAlignment) {
        findings.push({
          id: "dns-dmarc-relaxed-alignment",
          severity: "low",
          confidence: 68,
          category: "email-authentication",
          title: "DMARC alignment is relaxed",
          description: "DKIM/SPF alignment is not strict (`adkim=s`, `aspf=s`).",
          remediation: "Use strict alignment where possible after validating sender compatibility.",
        })
      }
    }

    const mxQuery = result.queries.find((query) => query.recordType === "MX")
    if (mxQuery?.status === "nodata") {
      findings.push({
        id: "dns-no-mx-records",
        severity: "low",
        confidence: 72,
        category: "service-configuration",
        title: "No MX records resolved",
        description: "Domain returned no MX records.",
        remediation: "Confirm whether the domain should receive email and configure MX accordingly.",
      })
    }

    const caaQuery = result.queries.find((query) => query.recordType === "CAA")
    if (caaQuery && caaQuery.status === "nodata") {
      findings.push({
        id: "dns-no-caa-policy",
        severity: "low",
        confidence: 70,
        category: "certificate-governance",
        title: "CAA record absent",
        description: "No CAA policy found for this domain in requested lookup set.",
        remediation: "Publish CAA records to constrain certificate issuance authorities.",
      })
    }

    const queryErrors = result.queries.filter((query) => query.status === "error")
    if (queryErrors.length > 0) {
      findings.push({
        id: "dns-query-errors",
        severity: "low",
        confidence: 65,
        category: "visibility-gap",
        title: "Some DNS lookups returned errors",
        description: `Error responses observed for: ${queryErrors.map((query) => query.recordType).join(", ")}`,
        remediation: "Retry with adjusted timeout or alternate resolver vantage points.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "DNS toolkit analysis completed",
      text: `Resolved ${result.queries.length} record type(s) for ${result.domain}.`,
      findings,
      metrics: {
        queryCount: result.queries.length,
        successfulQueries: result.queries.filter((query) => query.status === "ok").length,
        nodataQueries: result.queries.filter((query) => query.status === "nodata").length,
        errorQueries: queryErrors.length,
        spfIncludeCount: spf?.includes.length ?? 0,
        dmarcRuaCount: dmarc?.rua.length ?? 0,
        dmarcRufCount: dmarc?.ruf.length ?? 0,
        strictMailPolicy: strictMailPolicy ? 1 : 0,
      },
      baseScore: 94,
    })

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "DNS Toolkit",
        summary,
        findings,
        evidence: result.queries.map((query) => ({
          domain: result.domain,
          ...query,
        })),
        recommendations: [
          "Harden SPF/DMARC posture before mail-flow trust decisions.",
          "Track record drift over time to detect misconfiguration or unauthorized changes.",
          "Use multiple resolver perspectives for high-confidence triage.",
        ],
        raw: {
          dnsToolkit: result,
          config: {
            strictMailPolicy,
            requireDmarcReporting,
            minimumDmarcPct: dmarcPctFloor,
            timeout,
            enabledTypes,
          },
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null
    const envelope = parseToolResultEnvelope(output, "DNS Toolkit")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null
    const parsed = raw?.dnsToolkit as DnsToolkitResult | undefined
    const config = raw?.config && typeof raw.config === "object" && raw.config !== null
      ? (raw.config as Record<string, unknown>)
      : null
    if (!parsed) return null

    return (
      <div className="space-y-4">
        <div className="p-3 border rounded bg-muted/20">
          <div className="text-xs font-bold text-muted-foreground uppercase">Domain</div>
          <div className="font-mono">{parsed.domain}</div>
          {config && (
            <div className="text-xs text-muted-foreground mt-2">
              Strict mail policy: {config.strictMailPolicy ? "enabled" : "disabled"} | Min DMARC pct: {String(config.minimumDmarcPct ?? "100")}
            </div>
          )}
        </div>

        {parsed.spf && (
          <div className="p-3 border rounded bg-muted/20 space-y-1">
            <h3 className="text-sm font-semibold">SPF</h3>
            <p className="text-xs font-mono break-all">{parsed.spf.record}</p>
            <p className="text-xs text-muted-foreground">
              HardFail: {parsed.spf.hasHardFail ? "Yes" : "No"} | SoftFail: {parsed.spf.hasSoftFail ? "Yes" : "No"} | Includes: {parsed.spf.includes.length}
            </p>
          </div>
        )}

        {parsed.dmarc && (
          <div className="p-3 border rounded bg-muted/20 space-y-1">
            <h3 className="text-sm font-semibold">DMARC</h3>
            <p className="text-xs font-mono break-all">{parsed.dmarc.record}</p>
            <p className="text-xs text-muted-foreground">
              Policy: {parsed.dmarc.policy ?? "N/A"} | Subdomain: {parsed.dmarc.subdomainPolicy ?? "N/A"} | Pct: {parsed.dmarc.pct ?? "N/A"}
            </p>
            <p className="text-xs text-muted-foreground">
              RUA: {parsed.dmarc.rua.length} | RUF: {parsed.dmarc.ruf.length} | adkim: {parsed.dmarc.alignment.adkim ?? "N/A"} | aspf: {parsed.dmarc.alignment.aspf ?? "N/A"}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Record Answers</h3>
          {parsed.queries.map((query) => (
            <div key={query.recordType} className="p-3 border rounded bg-muted/20">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{query.recordType}</span>
                <span className="text-xs text-muted-foreground uppercase">{query.status}</span>
              </div>
              {query.answers.length === 0 ? (
                <p className="text-xs text-muted-foreground">{query.error ?? "No answers."}</p>
              ) : (
                <ul className="text-xs space-y-1 font-mono">
                  {query.answers.map((answer, index) => (
                    <li key={`${query.recordType}-${index}`} className="break-all">
                      {answer.data} <span className="text-muted-foreground">(TTL {answer.ttl})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {parsed.notes.length > 0 && (
          <div className="p-3 border rounded bg-muted/20">
            <h3 className="text-sm font-semibold mb-2">Notes</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              {parsed.notes.map((note, index) => (
                <li key={index}>• {note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <ToolTemplate
      toolName="DNS Toolkit"
      description="Resolve DNS records and evaluate SPF/DMARC posture with policy controls and analyst-ready enterprise findings."
      actionLabel="Resolve DNS"
      placeholder="example.com"
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Record Types</Label>
            <div className="grid grid-cols-4 gap-2 text-sm">
              {AVAILABLE_TYPES.map((type) => (
                <label key={type} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedTypes[type]}
                    onChange={(event) =>
                      setSelectedTypes((previous) => ({ ...previous, [type]: event.target.checked }))
                    }
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Timeout (ms)</Label>
              <Input
                value={timeoutMs}
                onChange={(event) => setTimeoutMs(event.target.value)}
                placeholder="6000"
              />
            </div>
            <div className="space-y-1">
              <Label>Minimum DMARC pct</Label>
              <Input
                value={minimumDmarcPct}
                onChange={(event) => setMinimumDmarcPct(event.target.value)}
                placeholder="100"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="dns-strict-mail" className="text-sm">Strict mail-policy checks</Label>
              <Switch
                id="dns-strict-mail"
                checked={strictMailPolicy}
                onChange={(event) => setStrictMailPolicy(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="dns-require-dmarc-reporting" className="text-sm">Require DMARC reporting</Label>
              <Switch
                id="dns-require-dmarc-reporting"
                checked={requireDmarcReporting}
                onChange={(event) => setRequireDmarcReporting(event.target.checked)}
              />
            </div>
          </div>
        </div>
      }
      examples={["example.com", "openai.com", "cloudflare.com"]}
    />
  )
}
