# Batch 4 Productization: App/API Governance Controls (2026-02-26)

## Scope
This batch upgrades six application and API defense tools from raw analyzer output to enterprise governance workflows with policy controls, structured findings, and export-ready evidence.

Included tools:
1. `cors-policy-analyzer`
2. `http-headers`
3. `security-header-builder`
4. `oauth-oidc-linter`
5. `openapi-authz-gap`
6. `iam-policy-analyzer`

## Baseline Gaps Found
1. Tools produced useful diagnostics but lacked release-gate policy controls (thresholds, strict toggles, governance constraints).
2. Outputs were not consistently wrapped in standardized envelopes for findings/evidence/recommendations export.
3. Hardening posture was visible, but exception management and policy drift controls were not first-class.
4. App/API identity and authorization tools needed stronger enforcement semantics (fail conditions, sensitive-path escalation, scope/lifetime caps).

## Implemented in Batch 4

### 1) CORS Policy Analyzer (`src/pages/tools/CorsPolicyAnalyzerTool.tsx`)
1. Added policy controls for:
- strict missing-origin checks
- explicit origin allowlist enforcement
- wildcard + sensitive method gating
- private-network CORS blocking
- Vary: Origin requirement
- max-age cap + baseline score target
2. Added structured findings/evidence envelope and policy-aware recommendations.
3. Added configuration state capture in raw output for auditability.

### 2) HTTP Security Headers Analyzer (`src/pages/tools/HttpHeadersTool.tsx`)
1. Added policy controls for:
- baseline target score
- max allowed missing critical headers
- HSTS preload enforcement
- cross-origin isolation requirements
- strict Permissions-Policy expectation
- server/framework banner exposure detection
- legacy X-XSS-Protection detection
2. Converted analyzer output into enterprise envelope with severity-mapped findings.
3. Added normalized header evidence and governance metadata in raw payload.

### 3) Security Header/CSP Builder (`src/pages/tools/SecurityHeaderBuilderTool.tsx`)
1. Added governance controls for:
- minimum posture score target
- optional COEP inclusion
- required cross-origin isolation profile
- unsafe-inline/eval disallow mode
- nonce/hash strategy requirement
- admin no-store cache policy
2. Added detailed post-build scoring by running generated headers through header analyzer.
3. Wrapped generated policy, findings, tradeoffs, and config into envelope output.

### 4) OAuth/OIDC Scope Minimizer & Policy Linter (`src/pages/tools/OAuthOidcLinterTool.tsx`)
1. Added policy controls for:
- offline_access restrictions
- max access token TTL
- max refresh token lifetime
- PKCE requirement enforcement
- max excess scope threshold
- optional scope prefix taxonomy enforcement
- missing token-policy field detection
2. Added enterprise findings and scoring around scope governance and token lifecycle risk.
3. Added policy config + extracted scope evidence for handoff/export workflows.

### 5) OpenAPI AuthZ Gap Analyzer (`src/pages/tools/OpenApiAuthzGapTool.tsx`)
1. Added policy controls for:
- max unsecured operation threshold
- write-method security enforcement
- query API-key prohibition
- max high/critical findings threshold
- critical path pattern escalation (`/admin`, `/internal`, etc.)
2. Added governance findings (release-blocking style) derived from base analyzer output.
3. Standardized envelope output with operation-level evidence rows.

### 6) IAM Policy Analyzer (`src/pages/tools/IamPolicyAnalyzerTool.tsx`)
1. Added governance controls for:
- fail-on-critical behavior
- max high/critical threshold
- MFA requirement for AssumeRole
- wildcard principal prohibition
- PassRole wildcard grant detection
- low-signal finding suppression toggle
2. Added supplemental AWS trust/escalation heuristics on top of baseline utility findings.
3. Standardized envelope output with platform findings and policy config context.

## Validation
1. `npm run lint` passed.
2. `npm test` passed (134/134).
3. `npm run build` passed.

## Enterprise Capability Delta (After Batch 4)
1. All six app/API defense tools now support policy-driven enterprise triage rather than static one-shot diagnostics.
2. Findings are now governance-aligned with deterministic severity, confidence, and remediation paths.
3. Evidence outputs are normalized for case export, review boards, and release-gate automation.
4. Tool configurations are captured in raw payload to support audit replay and change-control traceability.

## Next Batch Recommendation
Batch 5 should target core SOC/intel orchestration tools to build a cross-tool investigation workbench:
1. `ioc-extractor`
2. `ioc-correlator`
3. `ioc-normalizer`
4. `ioc-confidence-ttl`
5. `event-timeline`
6. `alert-deduplication`

Reason: these tools can be combined into a unified incident triage pipeline (extract → normalize → correlate → prioritize → timeline → dedupe) with the same enterprise envelope model.
