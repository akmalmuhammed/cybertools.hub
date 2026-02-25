# Domain Expansion Research and Tool Onboarding (February 25, 2026)

## Scope completed

- Domain model migrated to 7 top-level domains:
  - `soc`
  - `threat-intel`
  - `network`
  - `application`
  - `cloud-iam`
  - `supply-chain`
  - `data-privacy`
- Tool schema upgraded with first-class metadata:
  - `domainId`
  - `processingMode`
  - `sensitivity`
  - `evidenceTags`
- Domain navigation now supports both:
  - query deep links: `/tools?domain=...`
  - canonical slug pages: `/domains/<slug>`

## Phase 1 implementation status (16 tools)

All 16 Phase 1 tools are implemented in code, routed, tested, and listed in inventory:

1. Alert Deduplication Simulator (`/tools/alert-dedupe`)
2. Detection Rule Unit Test Harness (`/tools/detection-unit-test`)
3. ATT&CK Coverage Heatmap (`/tools/attack-coverage`)
4. Event Timeline Composer (`/tools/event-timeline`)
5. Log Schema Mapper (`/tools/log-schema-mapper`)
6. IOC Confidence + TTL Scorer (`/tools/ioc-confidence-ttl`)
7. MISP/STIX Mapper (`/tools/misp-stix-mapper`)
8. Artifact Integrity Packager (`/tools/artifact-integrity`)
9. External Exposure Normalizer (`/tools/exposure-normalizer`)
10. Firewall/ACL Conflict Analyzer (`/tools/firewall-acl-analyzer`)
11. TLS Risk Explainer (`/tools/tls-risk-explainer`)
12. OpenAPI AuthZ Gap Analyzer (`/tools/openapi-authz-gap`)
13. CORS Policy Analyzer (`/tools/cors-policy-analyzer`)
14. OAuth/OIDC Scope Minimizer (`/tools/oauth-oidc-linter`)
15. IAM Policy Analyzer (`/tools/iam-policy-analyzer`)
16. Lockfile Risk Diff (`/tools/lockfile-risk-diff`)

## Additional deep-research onboarding (Phase 2 planned tools)

Based on additional report research, the following tools are onboarded as `planned` entries with routable pages:

1. AI Prompt Injection Triage (`/tools/ai-prompt-injection-triage`)
2. Browser Session Triage (`/tools/browser-session-triage`)
3. Identity Blast Radius Simulator (`/tools/identity-blast-radius-simulator`)
4. SaaS OAuth App Risk Assessor (`/tools/saas-oauth-app-risk`)
5. KEV Patch SLA Tracker (`/tools/kev-patch-sla-tracker`)
6. Data Minimization Policy Checker (`/tools/data-minimization-checker`)
7. AI Connector Egress Audit (`/tools/ai-connector-egress-audit`)
8. Model Supply Chain Audit (`/tools/model-supply-chain-audit`)

## Research signals used for Phase 2 prioritization

1. CrowdStrike 2026 Global Threat Report (published February 27, 2026): identity and cloud intrusions accelerated, breakout speed remains low, and adversary AI exploitation increased.  
   Source: https://www.crowdstrike.com/en-us/blog/crowdstrike-2026-global-threat-report/

2. Unit 42 2025 Global Incident Response Report (published February 3, 2025): browser/session telemetry and cloud-origin incidents are materially rising.  
   Source: https://unit42.paloaltonetworks.com/2025-global-incident-response-report/

3. Sophos Active Adversary Report 2025 (published June 3, 2025): compromised credentials remain a primary root cause for incidents.  
   Source: https://news.sophos.com/en-us/2025/06/03/sophos-releases-the-active-adversary-report-2025/

4. ENISA Threat Landscape 2025 (published October 2025): social engineering and vulnerability exploitation remain dominant attack classes.  
   Source: https://www.enisa.europa.eu/sites/default/files/2025-10/enisa-threat-landscape-2025_0.pdf

5. CISA KEV alert activity (example update February 24, 2026): active exploitation adds continued urgency to patch prioritization workflows.  
   Source: https://www.cisa.gov/news-events/alerts/2026/02/24/cisa-adds-six-known-exploited-vulnerabilities-catalog

6. IBM X-Force Threat Intelligence Index 2025: identity abuse and vulnerability exploitation continue as leading initial access paths.  
   Source: https://www.ibm.com/reports/threat-intelligence

## Validation gates completed

- `npm run lint`: pass
- `npm test`: pass
- `npm run build`: pass

## Notes

- All implemented Phase 1 tools remain local-first by default.
- Planned Phase 2 tools are onboarded in IA and routing with explicit `planned` state to avoid broken links while preserving roadmap visibility.
