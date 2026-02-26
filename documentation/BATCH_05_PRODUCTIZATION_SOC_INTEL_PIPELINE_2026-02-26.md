# Batch 5 Productization: SOC Intel Pipeline (2026-02-26)

## Scope
This batch upgrades six SOC/intel workflow tools from basic transforms into policy-driven investigation modules with structured findings, evidence limits, and release-gate style controls.

Included tools:
1. `ioc-extractor`
2. `ioc-correlator`
3. `ioc-normalizer`
4. `ioc-confidence-ttl`
5. `event-timeline`
6. `alert-deduplication`

## Baseline Gaps Found
1. Tools returned raw analysis payloads but lacked enterprise policy thresholds (quality gates, overlap baselines, TTL/freshness controls).
2. Outputs were not standardized into findings/evidence envelopes suitable for repeatable case export.
3. Cross-tool workflow behavior (extract → normalize → correlate → prioritize → timeline → dedupe) was possible but not enforced via governance controls.
4. High-volume or low-quality data conditions were not surfaced as first-class triage findings.

## Implemented in Batch 5

### 1) IOC Extractor (`src/pages/tools/IocExtractorTool.tsx`)
1. Added controls for:
- high-volume threshold
- evidence row cap
- weak hash quality policy
- email exposure flagging
- existing derivation toggles (URL/email domain pivots)
2. Added findings for volume pressure, coverage gaps, weak hash-only feeds, non-public IP context, and punycode domain signals.
3. Wrapped output in enterprise envelope with flattened IOC evidence and config traceability.

### 2) IOC Correlator (`src/pages/tools/IocCorrelatorTool.tsx`)
1. Added controls for:
- minimum overlap baseline
- max unique drift percentage
- critical IOC type overlap requirements
- strict source presence check
- evidence cap
2. Added findings for zero/low overlap, source drift, critical-type gaps, and high-signal overlap markers.
3. Added per-type overlap evidence rows and config metadata in raw payload.

### 3) IOC Normalizer (`src/pages/tools/IocNormalizerTool.tsx`)
1. Added controls for:
- variant-count threshold
- collapse-ratio threshold
- non-TLS URL flagging
- punycode/unicode domain flagging
- unmatched token flagging
- evidence cap
2. Added findings for obfuscation collapse, high variant counts, insecure transport observables, and parsing coverage gaps.
3. Standardized canonical/defanged evidence rows for downstream enrichment and sharing.

### 4) IOC Confidence + TTL Scorer (`src/pages/tools/IocConfidenceTtlTool.tsx`)
1. Added controls for:
- minimum action confidence
- max TTL cap
- stale/near-expiry windows
- low-trust source policy
- unknown type handling
- evidence cap
2. Added findings for stale high-confidence indicators, TTL cap violations, low-trust source amplification, and unknown type quality gaps.
3. Added action-ready metrics and deterministic evidence mapping.

### 5) Event Timeline Composer (`src/pages/tools/EventTimelineTool.tsx`)
1. Added controls for:
- configurable gap threshold
- max timeline duration
- critical event threshold
- minimum source diversity requirement
- evidence cap
2. Added findings for timeline gaps, excessive dwell duration, critical-event escalation, and low source diversity.
3. Added custom gap calculations tied to policy thresholds for governance visibility.

### 6) Alert Deduplication Simulator (`src/pages/tools/AlertDeduplicationTool.tsx`)
1. Added controls for:
- dedupe window
- reduction target
- storm-group threshold
- high-severity repetition escalation threshold
- high-efficiency gate toggle
- timestamp quality check
- evidence cap
2. Added findings for low reduction performance, alert storms, repeated high-severity clusters, and timestamp quality issues.
3. Added grouped evidence records with configurable governance context.

## Validation
1. `npm run lint` passed.
2. `npm test` passed (134/134).
3. `npm run build` passed.

## Enterprise Capability Delta (After Batch 5)
1. All six SOC/intel pipeline tools now emit standardized enterprise envelopes with summary, findings, evidence, and recommendations.
2. SOC teams can enforce deterministic quality gates at each pipeline step, not just inspect raw outputs.
3. High-volume, stale, low-overlap, and low-fidelity conditions are promoted to explicit triage findings.
4. Cross-tool workflow outputs are now better suited for case management, export, and governance replay.

## Next Batch Recommendation
Batch 6 should target threat-hunting and detection engineering workbenches:
1. `sigma-helper`
2. `detection-unit-test-harness`
3. `yara-local-matcher`
4. `attack-coverage`
5. `log-schema-mapper`
6. `kev-cve-prioritizer`

Reason: these tools naturally form a detection lifecycle pipeline (rule quality, testability, matching, ATT&CK coverage, telemetry mapping, vuln-driven prioritization).
