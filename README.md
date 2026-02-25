# Secutil

Secutil is a local-first security utility workspace for SOC analysts, threat-intel teams, AppSec engineers, cloud/IAM teams, and incident responders.

Most tools execute fully in the browser. Tools that require network access are explicitly labeled.

## Key Capabilities

1. Domain-driven architecture across 7 security domains.
2. 75 onboarded tools in catalog (implemented and planned pages), all searchable and routable.
3. Local-first processing metadata per tool:
   - `processingMode` (`local`, `hybrid`, `network`)
   - `sensitivity` (`low`, `medium`, `high`)
   - `evidenceTags` (pain-point alignment tags)
4. Privacy-oriented UI with explicit network mode labeling.
5. SEO and LLM discovery assets generated from the tool registry:
   - `public/sitemap.xml`
   - `public/sitemap-static.xml`
   - `public/sitemap-domains.xml`
   - `public/sitemap-tools.xml`
   - `public/robots.txt`
   - `public/llms.txt`
   - `public/llms-full.txt`
   - `public/tool-index.json`
   - `public/ai-index.json`
   - `public/ai-tools.jsonl`
   - `public/tools-feed.xml`

## Tool Domains

1. SOC and Detection Engineering
2. Threat Intel and DFIR
3. Network and Exposure Security
4. Application and API Security
5. Cloud and IAM Security
6. Software Supply Chain Security
7. Data Security and Privacy Engineering

## Installation

```bash
git clone https://github.com/akmalmuhammed/cybertools.hub.git
cd cybertools.hub
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

`npm run build` also regenerates SEO and LLM index assets before the production build.

## Validation

```bash
npm run lint
npm test
```

## Local Workspace Setup (PowerShell)

From repository root:

```powershell
.\scripts\bootstrap.ps1
```

Start development:

```powershell
.\scripts\dev.ps1
```

## Documentation

1. [Domain Expansion Research](./documentation/DOMAIN_EXPANSION_RESEARCH_2026.md)
2. [Paid Tool Parity Onboarding](./documentation/PAID_TOOL_PARITY_ONBOARDING_2026.md)
3. [Scoring System](./documentation/SCORING_SYSTEM.md)
4. [SaaS Site-Wide Audit](./documentation/SAAS_SITE_AUDIT_2026-02-25.md)

## License

MIT
