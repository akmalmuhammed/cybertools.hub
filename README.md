# CyberTools Hub

**CyberTools Hub** is a comprehensive suite of security utilities designed for developers, SOC analysts, and penetration testers. Built with a privacy-first philosophy, most tools run fully client-side in your browser; network-intelligence tools (WHOIS/IP/Port web probing) make explicit outbound requests.

![CyberTools Hub Screenshot](/screenshot.png)

## 🚀 Features

- **20+ Security Tools**: From Base64 encoding to JWT analysis and Subnet calculations.
- **Privacy First**: Core transformations and forensic logic run locally in the browser.
- **Modern UI/UX**: Minimalist "hacker" aesthetic with glassmorphism, smooth animations (Framer Motion), and responsive design.
- **Advanced Features**: 
    - 🌗 Dark/Light Mode with persistence
    - 🔍 Command K Search (Spotlight style)
    - ⭐ Favorites & History
    - 📱 Mobile Responsive
- **Tech Stack**: React 18, Vite, TypeScript, TailwindCSS, Shadcn/UI, Zustand.

## 🛠️ Tools Included

### Core Utilities
- **Base64** (Encoder/Decoder)
- **Hash Generator** (MD5, SHA1, SHA256, SHA512)
- **JSON Formatter** (Validate & Minify)
- **URL Encoder** (Decode/Encode)
- **Timestamp Converter** (Unix/ISO)

### Popular Tools
- **RegEx Tester** (Real-time matching)
- **JWT Debugger** (Decode tokens)
- **Email Header Analyzer** (Trace hops)
- **Subnet Calculator** (CIDR/Masks)
- **Password Generator** (Secure random)

### Advanced Tools
- **WHOIS Lookup** (RDAP, network request)
- **Certificate Decoder** (Text metadata + PEM fingerprint)
- **IP Lookup** (Local classification + optional RDAP)
- **Port Checker** (Browser-safe HTTP(S) probing + service intelligence)
- **Text Diff** (Side-by-side comparison)
- **KEV/CVE Prioritizer** (Client-side vulnerability triage)
- **Secrets Scanner** (Credential/token leak detection)
- **IOC Canonicalizer** (Defanged IOC normalization + unicode/punycode dedupe)
- **STIX/TAXII Utility** (Parse, validate, compare, export local bundles)
- **Domain Spoof Detector** (Homoglyph/brand-abuse/domain-age heuristics)
- **Sigma Linter Helper** (Rule syntax + ATT&CK completeness + query helpers)
- **YARA Local Matcher** (Local text/file pattern matching, no upload)
- **SBOM Diff & Risk Triage** (CycloneDX/SPDX compare + vulnerable change triage)
- **Security Header/CSP Builder** (Preset policy generation + tradeoff guidance)

### Utilities
- **QR Code Generator**
- **Color Converter** (HEX/RGB/HSL)
- **UUID Generator** (v4)
- **Markdown Preview**
- **HTML Encoder**

## Domain Expansion (2026)

The workspace now uses 7 top-level security domains:

- SOC & Detection Engineering
- Threat Intel & DFIR
- Network & Exposure Security
- Application & API Security
- Cloud & IAM Security
- Software Supply Chain Security
- Data Security & Privacy Engineering

Phase 1 onboarding shipped 16 new tools across these domains.  
See `documentation/DOMAIN_EXPANSION_RESEARCH_2026.md` for deep-research evidence mapping and Phase 2 planned tools.

## 📦 Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/cybertools-hub.git
    cd cybertools-hub
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start development server:
    ```bash
    npm run dev
    ```

4.  Build for production:
    ```bash
    npm run build
    ```

5.  Run tool accuracy tests:
    ```bash
    npm test
    ```

## 🔒 Privacy Notes

- Core tools (encoding, hashing, formatting, parsing, generation) process data locally.
- Some intel/verification tools make outbound requests when used:
  - `WHOIS`: `https://rdap.org/domain/...`
  - `IP Lookup`: `https://rdap.org/ip/...`
  - `DNS Toolkit`: `https://dns.google/resolve?...`
  - `JWT/JWS Verifier` (JWKS mode): user-supplied JWKS URL
  - `Port Checker`: attempts HTTP(S) requests to target hosts/ports
  - `Reputation Enricher`: user-supplied proxy endpoint (recommended), plus optional RDAP lookups
- For provider reputation APIs, use your own backend proxy. Direct browser API-key calls are intentionally avoided.

## 🤝 Contributing

Contributions are welcome! Please check out the [issues](https://github.com/yourusername/cybertools-hub/issues) or submit a PR.

## 📄 License

MIT License. Free forever.

## Local Workspace Setup (PowerShell)

From the repository root:

```powershell
.\scripts\bootstrap.ps1
```

This installs dependencies and validates the workspace with lint, tests, and build.

To start development:

```powershell
.\scripts\dev.ps1
```

Optional:

- Open `cybertools-hub.code-workspace` in VS Code for preconfigured tasks/launch.
- Use Node `20` (pinned in `.nvmrc`) to match CI.
