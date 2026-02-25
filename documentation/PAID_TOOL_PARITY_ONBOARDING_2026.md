# Paid Utility Parity Onboarding Plan (February 25, 2026)

## Scope

This plan expands `cybertools.hub` against high-adoption paid security utility categories, then maps missing domain capabilities into onboarded roadmap tools.

The objective is not to clone paid platforms. The objective is to provide local-first, analyst-ready utility workflows that reduce triage time and improve output quality.

## Adoption Signals Used

As of February 25, 2026, paid-tool adoption references used for prioritization include:

1. `Microsoft Sentinel` reported over 25,000 customers (SOC/SIEM market signal).
2. `Rapid7` reported over 11,000 customers (exposure, vulnerability, SOC workflows).
3. `Tenable` reported over 44,000 customers (vulnerability and exposure posture workflows).
4. `Qualys` reported over 10,000 customers and broad cloud footprint (continuous exposure posture workflows).
5. `Wiz` reported 50% of Fortune 100 as customers (CNAPP/CSPM/IAM posture signal).
6. `Okta` reported over 18,000 customers (identity governance and SaaS access risk signal).
7. `Snyk` reported over 3,100 enterprise customers (AppSec and software supply-chain signal).
8. `JFrog` reported over 7,000 customers (artifact lifecycle and supply-chain signal).
9. `Veracode` reports broad enterprise use across regulated industries (AppSec and risk governance signal).

These are used as directional market-adoption signals for backlog prioritization.

## Domain Gap Review and Onboarding

Below are missing capability areas by domain and the tools onboarded in this release as `planned` pages (discoverable, searchable, routable, SEO indexed).

### SOC & Detection Engineering

- Missing coverage:
  - playbook simulation quality checks
  - XDR rule tuning benchmark workflows
- Onboarded:
  - `SOAR Playbook Dry Runner` (`/tools/soar-playbook-dry-runner`)
  - `XDR Detection Tuning Benchmark` (`/tools/xdr-detection-tuning-benchmark`)

### Threat Intel & DFIR

- Missing coverage:
  - multi-feed confidence fusion
  - campaign-graph analysis support
- Onboarded:
  - `Threat Feed Fusion Normalizer` (`/tools/threat-feed-fusion-normalizer`)
  - `Campaign Graph Builder` (`/tools/campaign-graph-builder`)

### Network & Exposure Security

- Missing coverage:
  - attack surface drift tracking
  - WAF rule safety simulation
- Onboarded:
  - `Attack Surface Change Tracker` (`/tools/asm-change-diff-tracker`)
  - `WAF Rule Risk Simulator` (`/tools/waf-rule-risk-simulator`)

### Application & API Security

- Missing coverage:
  - SAST multi-engine deduplication
  - API abuse scenario replay validation
- Onboarded:
  - `SAST Finding Deduplicator` (`/tools/sast-finding-deduplicator`)
  - `API Abuse Pattern Lab` (`/tools/api-abuse-pattern-lab`)

### Cloud & IAM Security

- Missing coverage:
  - IAM drift snapshots over time
  - SaaS entitlement and access-review hygiene
- Onboarded:
  - `Cloud Permission Drift Detector` (`/tools/cloud-permission-drift-detector`)
  - `SaaS Entitlement Reviewer` (`/tools/saas-entitlement-reviewer`)

### Software Supply Chain Security

- Missing coverage:
  - container policy linting
  - provenance attestation verification
- Onboarded:
  - `Container Image Policy Linter` (`/tools/container-image-policy-linter`)
  - `Artifact Provenance Verifier` (`/tools/artifact-provenance-verifier`)

### Data Security & Privacy Engineering

- Missing coverage:
  - DLP rule precision tuning
  - retention-policy conflict detection
- Onboarded:
  - `DLP Rule Tester` (`/tools/dlp-rule-tester`)
  - `Retention Policy Conflict Finder` (`/tools/retention-policy-conflict-finder`)

## Accuracy and Testing Method Expansion

Testing is now reinforced across utility logic, registry consistency, and discovery integrity:

1. Tool logic tests (existing):
   - deterministic unit fixtures for parsing, scoring, linting, and normalization modules.
2. Tool registry integrity tests (new):
   - unique `id`/`path`/`name` checks
   - metadata completeness checks (`keywords`, `evidenceTags`, description depth)
   - route coverage checks (non-planned explicit route, planned wildcard route)
   - domain depth checks.
3. SEO/discovery integrity tests (new):
   - `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, and `tool-index.json` synchronization checks against registry.
4. UI content integrity tests (new):
   - automated scan for known mojibake/data-mismatch artifacts.

## Traffic, Search, and LLM Discoverability Controls

Implemented to increase discoverability and referral traffic:

1. Automated SEO asset generation:
   - `sitemap.xml` (all static/domain/tool routes)
   - `robots.txt`
   - `llms.txt`
   - `llms-full.txt`
   - `tool-index.json`
2. Structured data upgrades:
   - Home: `WebSite` + `SearchAction` + `WebApplication`
   - Tools page: `CollectionPage` + `ItemList`
   - Domain pages: `CollectionPage` + `ItemList`
   - Tool pages: per-tool `SoftwareApplication` metadata (already present)
3. Search/share enhancements:
   - tools search query now syncs to URL (`/tools?q=...`) for crawlable/shareable intent hints.

## Sources

- Microsoft Sentinel growth metric: https://www.microsoft.com/en-us/security/blog/2024/04/09/microsoft-named-a-leader-in-the-gartner-magic-quadrant-for-security-information-and-event-management/
- Rapid7 growth metric: https://www.rapid7.com/newsroom/rapid7-reaches-major-milestone-with-over-11000-customers-globally/
- Tenable customer metric: https://www.tenable.com/about-tenable
- Qualys customer/cloud metric: https://www.qualys.com/llm-info/
- Wiz enterprise penetration metric: https://www.wiz.io/press-release/wiz-reaches-100-million-arr
- Okta customer metric: https://www.okta.com/okta-data-access-policy/
- Snyk customer metric: https://snyk.io/blog/snyk-fy24-results/
- JFrog customer metric: https://jfrog.com/blog/jfrog-closes-2023-with-349-6m-in-revenue-a-24-increase-over-2022/
- Veracode enterprise footprint context: https://www.veracode.com/
- Splunk security report context: https://www.splunk.com/en_us/resources/reports/the-state-of-security-2025.html
- SANS 2025 SOC survey context: https://www.sans.org/blog/sans-2025-soc-survey-release/
- SANS cloud security context: https://www.sans.org/resources/research/2024-state-of-cloud-security/
- ENISA threat landscape 2025: https://www.enisa.europa.eu/publications/enisa-threat-landscape-2025
- CISA KEV catalog context: https://www.cisa.gov/known-exploited-vulnerabilities-catalog
