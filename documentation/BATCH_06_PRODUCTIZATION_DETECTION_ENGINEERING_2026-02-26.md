# Batch 6 Productization: Detection Engineering (2026-02-26)

## Scope
This batch upgrades six detection-engineering tools from simple analyzer outputs to policy-driven security products with enterprise result envelopes, governance controls, and release-gate findings.

Included tools:
1. `sigma-helper`
2. `detection-unit-test-harness`
3. `yara-local-matcher`
4. `attack-coverage`
5. `log-schema-mapper`
6. `kev-cve-prioritizer`

## Baseline Gaps Found
1. Outputs were utility-grade and lacked configurable policy thresholds for go/no-go security decisions.
2. Risk and quality conditions existed in raw data but were not promoted into explicit findings/recommendations.
3. Cross-step detection lifecycle controls (authoring -> testing -> matching -> coverage -> telemetry mapping -> vuln prioritization) were not enforceable.
4. Evidence payload size and triage emphasis were inconsistent for enterprise workflows.

## Implemented in Batch 6

### 1) Sigma Helper (`src/pages/tools/SigmaHelperTool.tsx`)
1. Added policy controls for required ATT&CK tags, minimum tactic/technique depth, rule ID requirements, translation requirements, and warning thresholds.
2. Wrapped results in a structured enterprise envelope with severity-ranked findings and targeted recommendations.
3. Added governance checks for production readiness and ATT&CK mapping quality.

### 2) Detection Unit Test Harness (`src/pages/tools/DetectionUnitTestHarnessTool.tsx`)
1. Added release-gate controls for minimum pass rate, failure ceiling, fixture count floor, fixture polarity requirements, mismatch handling, and condition-note review.
2. Added explicit findings for weak test confidence, fixture quality gaps, and detection release risk.
3. Standardized raw + evidence output for repeatable QA sign-off and CI workflow export.

### 3) YARA Local Matcher (`src/pages/tools/YaraLocalMatcherTool.tsx`)
1. Added controls for parser-error tolerance, match floor/ceiling, parsed rule volume ceiling, regex volume ceiling, and file-mode filename requirements.
2. Added findings for parse health, over/under matching, and potential performance instability.
3. Preserved scan context and rule statistics in enterprise envelopes for analyst triage.

### 4) ATT&CK Coverage (`src/pages/tools/AttackCoverageTool.tsx`)
1. Added policy controls for minimum coverage score, mapped ratio baseline, tactic/technique diversity floors, gap limits, required tactics, and full-mapping enforcement.
2. Added findings for strategic ATT&CK blind spots and insufficient detection breadth.
3. Structured evidence for coverage dashboards and detection roadmap governance.

### 5) Log Schema Mapper (`src/pages/tools/LogSchemaMapperTool.tsx`)
1. Added controls for minimum mapping confidence, unmapped field limits, low-confidence hint limits, required timestamp/source/destination mappings, and sensitive-field exposure checks.
2. Added findings for telemetry normalization risk, missing critical fields, and schema hygiene gaps.
3. Added configurable evidence capping for enterprise data handling discipline.

### 6) KEV CVE Prioritizer (`src/pages/tools/KevCvePrioritizerTool.tsx`)
1. Preserved weighting profile workbench and added governance controls for priority queue saturation, KEV presence policy, exploit evidence policy, and P1 scoring floors.
2. Added findings for mis-prioritized critical vulnerabilities and weak exploitation-driven triage.
3. Added evidence caps and standardized outputs for vuln review boards.

## Validation
1. `npm run lint` passed.
2. `npm test` passed (134/134).
3. `npm run build` passed.

## Enterprise Capability Delta (After Batch 6)
1. Detection engineering tooling now enforces enterprise quality gates from rule authoring to remediation prioritization.
2. All six tools emit consistent findings/evidence/recommendation envelopes suitable for SOC and governance workflows.
3. Detection blind spots, schema quality issues, parser stability, and prioritization drift are now surfaced as first-class risks.
4. Teams can tune policy thresholds to align with maturity targets without changing backend logic.

## Next Batch Recommendation
Batch 7 should target foundational security utility workbenches:
1. `base64`
2. `hash-generator`
3. `url-encoder`
4. `json-formatter`
5. `timestamp-converter`
6. `password-generator`

Reason: these high-traffic tools are still mostly transform utilities; converting them into policy-aware products will create enterprise-grade guardrails across everyday analyst/developer workflows.
