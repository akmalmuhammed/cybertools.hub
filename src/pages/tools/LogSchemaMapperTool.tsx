import { useState } from "react"
import { ToolTemplate } from "@/components/tools/ToolTemplate"
import {
  mapLogsToSchemaHints,
  type SchemaMappingResult,
  type SchemaMappingHint,
} from "@/lib/utils/log-schema-mapper"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { buildToolResultEnvelope, parseToolResultEnvelope } from "@/lib/utils/tool-results"
import { createSummaryFromFindings } from "@/lib/utils/tool-result-scoring"
import type { ToolFinding } from "@/types/tool.types"

export default function LogSchemaMapperTool() {
  const [minimumMappingConfidencePercent, setMinimumMappingConfidencePercent] = useState("70")
  const [maxUnmappedFields, setMaxUnmappedFields] = useState("3")
  const [maxLowConfidenceHints, setMaxLowConfidenceHints] = useState("5")
  const [requireTimestampFieldMapping, setRequireTimestampFieldMapping] = useState(true)
  const [requireSourceDestinationIpMappings, setRequireSourceDestinationIpMappings] = useState(true)
  const [flagSensitiveUnmappedFields, setFlagSensitiveUnmappedFields] = useState(true)
  const [maxEvidenceRows, setMaxEvidenceRows] = useState("300")

  const process = (input: string) => {
    const mapping = mapLogsToSchemaHints(input)
    const findings: ToolFinding[] = []

    const confidenceFloor = Math.max(0, Math.min(100, Number(minimumMappingConfidencePercent) || 70)) / 100
    const unmappedLimit = Math.max(0, Number(maxUnmappedFields) || 3)
    const lowConfidenceLimit = Math.max(0, Number(maxLowConfidenceHints) || 5)
    const evidenceLimit = Math.max(20, Math.min(2000, Number(maxEvidenceRows) || 300))

    if (mapping.recordCount === 0) {
      findings.push({
        id: "schema-mapper-no-records",
        severity: "info",
        confidence: 74,
        category: "input-quality",
        title: "No log records parsed",
        description: "Schema mapper did not parse any records from provided input.",
        remediation: "Provide JSON/NDJSON or key=value logs with stable field keys.",
      })
    }

    if (mapping.unmappedFields.length > unmappedLimit) {
      findings.push({
        id: "schema-mapper-unmapped-over-limit",
        severity: mapping.unmappedFields.length > unmappedLimit + 3 ? "high" : "medium",
        confidence: 80,
        category: "schema-coverage",
        title: "Unmapped field count exceeds threshold",
        description: `Unmapped fields=${mapping.unmappedFields.length}, maximum allowed=${unmappedLimit}.`,
        remediation: "Define field mappings for unmapped keys before production ingestion.",
      })
    }

    const lowConfidenceHints = mapping.hints.filter((hint) => hint.confidence > 0 && hint.confidence < confidenceFloor)
    if (lowConfidenceHints.length > lowConfidenceLimit) {
      findings.push({
        id: "schema-mapper-low-confidence-hints",
        severity: lowConfidenceHints.length > lowConfidenceLimit + 3 ? "medium" : "low",
        confidence: 72,
        category: "mapping-confidence",
        title: "Low-confidence mapping hints exceed threshold",
        description: `${lowConfidenceHints.length} hint(s) are below confidence floor ${(confidenceFloor * 100).toFixed(0)}%.`,
        remediation: "Review field semantics and tune parser mappings for low-confidence fields.",
      })
    }

    if (requireTimestampFieldMapping) {
      const hasTimestampMapping = mapping.hints.some((hint) => hint.ecsField === "@timestamp" || hint.ocsfField === "time")
      if (!hasTimestampMapping) {
        findings.push({
          id: "schema-mapper-timestamp-missing",
          severity: "high",
          confidence: 85,
          category: "schema-core-fields",
          title: "Timestamp mapping missing",
          description: "No timestamp field mapping was detected for ECS/OCSF alignment.",
          remediation: "Map time fields explicitly to ensure event sequencing and retention correctness.",
        })
      }
    }

    if (requireSourceDestinationIpMappings) {
      const hasSourceIp = mapping.hints.some((hint) => hint.ecsField === "source.ip" || hint.ocsfField === "src_endpoint.ip")
      const hasDestIp = mapping.hints.some((hint) => hint.ecsField === "destination.ip" || hint.ocsfField === "dst_endpoint.ip")
      if (!hasSourceIp || !hasDestIp) {
        findings.push({
          id: "schema-mapper-ip-mapping-missing",
          severity: "medium",
          confidence: 78,
          category: "schema-core-fields",
          title: "Source/destination IP mapping incomplete",
          description: `Source mapped=${hasSourceIp ? "yes" : "no"}, destination mapped=${hasDestIp ? "yes" : "no"}.`,
          remediation: "Map source and destination network endpoints for reliable detection and enrichment joins.",
        })
      }
    }

    if (flagSensitiveUnmappedFields) {
      const sensitiveUnmapped = mapping.unmappedFields.filter((field) => /password|secret|token|apikey|api_key|credential|auth/i.test(field))
      if (sensitiveUnmapped.length > 0) {
        findings.push({
          id: "schema-mapper-sensitive-unmapped",
          severity: "high",
          confidence: 82,
          category: "data-risk",
          title: "Sensitive unmapped fields detected",
          description: `Sensitive unmapped fields: ${sensitiveUnmapped.join(", ")}.`,
          remediation: "Map and govern sensitive fields with masking/tokenization before broad pipeline access.",
        })
      }
    }

    if (mapping.hints.length > 0 && mapping.unmappedFields.length === 0) {
      findings.push({
        id: "schema-mapper-full-coverage",
        severity: "info",
        confidence: 70,
        category: "quality-signal",
        title: "All observed fields mapped",
        description: "No unmapped fields detected in current sample set.",
        remediation: "Validate mappings against larger production samples to prevent schema drift.",
      })
    }

    const summary = createSummaryFromFindings({
      title: "Log schema mapping completed",
      text: `Parsed ${mapping.recordCount} record(s), generated ${mapping.hints.length} field mapping hint(s), unmapped=${mapping.unmappedFields.length}.`,
      findings,
      metrics: {
        recordCount: mapping.recordCount,
        hints: mapping.hints.length,
        unmapped: mapping.unmappedFields.length,
        lowConfidenceHints: lowConfidenceHints.length,
      },
      baseScore: 93,
    })

    const evidenceRows = mapping.hints.map((hint) => ({
      rawField: hint.rawField,
      ecsField: hint.ecsField,
      ocsfField: hint.ocsfField,
      confidence: hint.confidence,
      sampleValues: hint.sampleValues,
    }))

    return JSON.stringify(
      buildToolResultEnvelope({
        toolName: "Log Schema Mapper",
        summary,
        findings,
        evidence: evidenceRows.slice(0, evidenceLimit),
        recommendations: [
          "Treat timestamp and network endpoint mappings as mandatory ingestion prerequisites.",
          "Monitor unmapped field drift continuously as log sources evolve.",
          "Apply sensitive-field governance (masking/tokenization) before broad downstream use.",
        ],
        raw: {
          schemaMapping: mapping,
          config: {
            confidenceFloor,
            unmappedLimit,
            lowConfidenceLimit,
            requireTimestampFieldMapping,
            requireSourceDestinationIpMappings,
            flagSensitiveUnmappedFields,
            evidenceLimit,
          },
          evidenceTruncated: evidenceRows.length > evidenceLimit,
        },
      }),
    )
  }

  const renderOutput = (output: string) => {
    if (!output) return null
    const envelope = parseToolResultEnvelope(output, "Log Schema Mapper")
    const raw = envelope.raw && typeof envelope.raw === "object" && envelope.raw !== null
      ? (envelope.raw as Record<string, unknown>)
      : null
    const parsed = raw?.schemaMapping as SchemaMappingResult | undefined
    const config = raw?.config && typeof raw.config === "object" && raw.config !== null
      ? (raw.config as Record<string, unknown>)
      : null

    if (!parsed) return null

    return (
      <div className="space-y-4">
        <div className="p-3 border rounded bg-muted/20 text-sm">
          Records parsed: <span className="font-semibold">{parsed.recordCount}</span> | Unmapped fields: <span className="font-semibold">{parsed.unmappedFields.length}</span>
          {config && <> | Confidence floor: {Math.round(Number(config.confidenceFloor ?? 0.7) * 100)}%</>}
        </div>

        <div className="space-y-2">
          {parsed.hints.map((hint: SchemaMappingHint) => (
            <div key={hint.rawField} className="p-3 border rounded bg-muted/20 text-xs space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{hint.rawField}</span>
                <span>{Math.round(hint.confidence * 100)}%</span>
              </div>
              <div>ECS: {hint.ecsField ?? "-"}</div>
              <div>OCSF: {hint.ocsfField ?? "-"}</div>
              <div className="text-muted-foreground">Samples: {hint.sampleValues.join(", ") || "-"}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <ToolTemplate
      toolName="Log Schema Mapper"
      description="Map raw logs to ECS/OCSF with enterprise thresholds for schema completeness, confidence, and sensitive-field governance."
      actionLabel="Map Schema"
      placeholder='timestamp=2026-02-25T11:20:00Z src_ip=10.10.5.5 dst_ip=8.8.8.8 user=akmal event_id=4624 process_name=powershell.exe'
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Minimum mapping confidence (%)</Label>
              <Input
                value={minimumMappingConfidencePercent}
                onChange={(event) => setMinimumMappingConfidencePercent(event.target.value)}
                placeholder="70"
              />
            </div>
            <div className="space-y-1">
              <Label>Max unmapped fields</Label>
              <Input
                value={maxUnmappedFields}
                onChange={(event) => setMaxUnmappedFields(event.target.value)}
                placeholder="3"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Max low-confidence hints</Label>
              <Input
                value={maxLowConfidenceHints}
                onChange={(event) => setMaxLowConfidenceHints(event.target.value)}
                placeholder="5"
              />
            </div>
            <div className="space-y-1">
              <Label>Max evidence rows</Label>
              <Input
                value={maxEvidenceRows}
                onChange={(event) => setMaxEvidenceRows(event.target.value)}
                placeholder="300"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="schema-require-timestamp" className="text-sm">Require timestamp mapping</Label>
              <Switch
                id="schema-require-timestamp"
                checked={requireTimestampFieldMapping}
                onChange={(event) => setRequireTimestampFieldMapping(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="schema-require-ip" className="text-sm">Require source/destination IP mapping</Label>
              <Switch
                id="schema-require-ip"
                checked={requireSourceDestinationIpMappings}
                onChange={(event) => setRequireSourceDestinationIpMappings(event.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 sm:col-span-2">
              <Label htmlFor="schema-sensitive-unmapped" className="text-sm">Flag sensitive unmapped fields</Label>
              <Switch
                id="schema-sensitive-unmapped"
                checked={flagSensitiveUnmappedFields}
                onChange={(event) => setFlagSensitiveUnmappedFields(event.target.checked)}
              />
            </div>
          </div>
        </div>
      }
    />
  )
}
