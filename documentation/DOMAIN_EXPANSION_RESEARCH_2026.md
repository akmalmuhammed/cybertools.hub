# Domain Expansion Research and Tool Onboarding (Updated February 25, 2026)

## Completed architecture changes

1. Expanded to 7 top-level domains:
   - `soc`
   - `threat-intel`
   - `network`
   - `application`
   - `cloud-iam`
   - `supply-chain`
   - `data-privacy`
2. Tool schema now enforces:
   - `domainId`
   - `processingMode`
   - `sensitivity`
   - `evidenceTags`
3. Navigation and routing support both:
   - query deep links (`/tools?domain=...`)
   - canonical domain paths (`/domains/<slug>`)

## Phase 1 implementation (16 tools) status

All 16 Phase 1 tools are implemented, routed, and tested.

## Phase 2+ onboarding status

The roadmap now includes 22 planned tools with routable pages and searchable metadata:

1. AI Prompt Injection Triage
2. Browser Session Triage
3. Identity Blast Radius Simulator
4. SaaS OAuth App Risk Assessor
5. KEV Patch SLA Tracker
6. Data Minimization Policy Checker
7. AI Connector Egress Audit
8. Model Supply Chain Audit
9. SOAR Playbook Dry Runner
10. XDR Detection Tuning Benchmark
11. Threat Feed Fusion Normalizer
12. Campaign Graph Builder
13. Attack Surface Change Tracker
14. WAF Rule Risk Simulator
15. SAST Finding Deduplicator
16. API Abuse Pattern Lab
17. Cloud Permission Drift Detector
18. SaaS Entitlement Reviewer
19. Container Image Policy Linter
20. Artifact Provenance Verifier
21. DLP Rule Tester
22. Retention Policy Conflict Finder

## Validation status

1. Lint/build/test suite remains green after expansion.
2. Registry integrity tests now enforce route, metadata, and domain-depth consistency.
3. SEO/LLM index tests now enforce synchronization between tool registry and published machine-readable assets.

## Additional detailed plan

See [PAID_TOOL_PARITY_ONBOARDING_2026.md](./PAID_TOOL_PARITY_ONBOARDING_2026.md) for:

1. paid-tool adoption references,
2. domain gap analysis,
3. onboarding rationale,
4. traffic/SEO/LLM strategy,
5. source links.
