import {
    Binary, FileJson, Hash, Link, Calculator,
    Regex, Shield, Mail, Network, Key,
    Search, Globe, FileDigit, Divide, FileDiff,
    QrCode, Palette, Fingerprint, FileType, Code, MonitorSmartphone
} from "lucide-react"
import { Tool } from "@/types/tool.types"

export const TOOLS: Tool[] = [
    // PRIORITY 1 - CORE
    {
        id: "base64",
        name: "Base64 Converter",
        description: "Encode and decode Base64 data with URL safety options.",
        path: "/tools/base64",
        icon: Binary,
        category: "application",
        status: "ready",
        keywords: ["base64", "encode", "decode", "url"]
    },
    {
        id: "hash",
        name: "Hash Generator",
        description: "Generate MD5, SHA1, SHA256, and SHA512 hashes.",
        path: "/tools/hash",
        icon: Hash,
        category: "security",
        status: "ready",
        keywords: ["md5", "sha1", "sha256", "hash", "crypto"]
    },
    {
        id: "json",
        name: "JSON Formatter",
        description: "Validate, format, and minify JSON data.",
        path: "/tools/json",
        icon: FileJson,
        category: "application",
        status: "ready",
        keywords: ["json", "format", "minify", "validate"]
    },
    {
        id: "url",
        name: "URL Encoder",
        description: "Encode and decode URLs and URI components.",
        path: "/tools/url",
        icon: Link,
        category: "application",
        status: "ready",
        keywords: ["url", "encode", "decode", "uri"]
    },
    {
        id: "url-defang",
        name: "URL Defang/Refang",
        description: "Defang/refang URLs and canonicalize links for IOC workflows.",
        path: "/tools/url-defang",
        icon: Link,
        category: "security",
        status: "new",
        keywords: ["url", "defang", "refang", "canonicalize"]
    },
    {
        id: "timestamp",
        name: "Unix Timestamp",
        description: "Convert between Unix timestamps and human dates.",
        path: "/tools/timestamp",
        icon: Calculator,
        category: "application",
        status: "ready",
        keywords: ["time", "unix", "date", "convert"]
    },

    // PRIORITY 2
    {
        id: "regex",
        name: "Regex Tester",
        description: "Test regular expressions against text.",
        path: "/tools/regex",
        icon: Regex,
        category: "application",
        status: "ready",
        keywords: ["regex", "test", "match"]
    },
    {
        id: "jwt",
        name: "JWT Decoder",
        description: "Decode and inspect JSON Web Tokens.",
        path: "/tools/jwt",
        icon: Key,
        category: "security",
        status: "ready",
        keywords: ["jwt", "token", "decode"]
    },
    {
        id: "jwt-verify",
        name: "JWT/JWS Verifier",
        description: "Verify JWT/JWS signatures and optional claims policy with secret, PEM, JWK, or JWKS URL.",
        path: "/tools/jwt-verify",
        icon: Key,
        category: "security",
        status: "new",
        keywords: ["jwt", "jws", "verify", "jwks"]
    },
    {
        id: "email",
        name: "Email Header Analyzer",
        description: "Parse and analyze email headers.",
        path: "/tools/email",
        icon: Mail,
        category: "security",
        status: "ready",
        keywords: ["email", "header", "smtp"]
    },
    {
        id: "ioc",
        name: "IOC Extractor",
        description: "Extract URLs, domains, IPs, hashes, and CVEs from raw text.",
        path: "/tools/ioc",
        icon: Search,
        category: "security",
        status: "new",
        keywords: ["ioc", "indicators", "threat", "triage"]
    },
    {
        id: "ioc-correlator",
        name: "IOC Correlator",
        description: "Compare two IOC datasets and identify overlap and unique indicators.",
        path: "/tools/ioc-correlator",
        icon: FileDiff,
        category: "security",
        status: "new",
        keywords: ["ioc", "correlate", "overlap", "threat-intel"]
    },
    {
        id: "user-agent",
        name: "User-Agent Analyzer",
        description: "Parse User-Agent strings into browser, OS, device, and automation signals.",
        path: "/tools/user-agent",
        icon: MonitorSmartphone,
        category: "security",
        status: "new",
        keywords: ["user-agent", "ua", "browser", "fingerprint"]
    },
    {
        id: "subnet",
        name: "Subnet Calculator",
        description: "Calculate CIDR ranges and netmasks.",
        path: "/tools/subnet",
        icon: Network,
        category: "network",
        status: "ready",
        keywords: ["cidr", "subnet", "network", "ip"]
    },
    {
        id: "password",
        name: "Password Generator",
        description: "Generate secure random passwords.",
        path: "/tools/password",
        icon: Shield,
        category: "security",
        status: "ready",
        keywords: ["password", "secure", "generator"]
    },

    // PRIORITY 3
    {
        id: "whois",
        name: "Whois Lookup",
        description: "Lookup domain registration details via RDAP (network request).",
        path: "/tools/whois",
        icon: Search,
        category: "network",
        status: "beta",
        keywords: ["whois", "domain", "lookup"]
    },
    {
        id: "dns-toolkit",
        name: "DNS Toolkit",
        description: "Query DNS-over-HTTPS records and inspect SPF/DMARC posture.",
        path: "/tools/dns",
        icon: Network,
        category: "network",
        status: "new",
        keywords: ["dns", "spf", "dmarc", "mx", "txt"]
    },
    {
        id: "certificate",
        name: "Certificate Decoder",
        description: "Inspect certificate text and derive PEM SHA-256 fingerprints.",
        path: "/tools/certificate",
        icon: FileDigit,
        category: "security",
        status: "beta",
        keywords: ["ssl", "cert", "pem", "decode"]
    },
    {
        id: "iplookup",
        name: "IP Lookup",
        description: "Classify IP addresses and optionally enrich with RDAP (network request).",
        path: "/tools/ip",
        icon: Globe,
        category: "network",
        status: "beta",
        keywords: ["ip", "geolocation", "lookup"]
    },
    {
        id: "port",
        name: "Port Checker",
        description: "Assess common ports and probe HTTP(S)-compatible endpoints from browser.",
        path: "/tools/port",
        icon: Divide,
        category: "network",
        status: "beta",
        keywords: ["port", "check", "open"]
    },
    {
        id: "diff",
        name: "Text Diff",
        description: "Compare two texts and find differences.",
        path: "/tools/diff",
        icon: FileDiff,
        category: "application",
        status: "ready",
        keywords: ["diff", "compare", "text"]
    },
    {
        id: "http-headers",
        name: "HTTP Header Analyzer",
        description: "Score HTTP security headers and identify hardening gaps.",
        path: "/tools/http-headers",
        icon: Shield,
        category: "security",
        status: "new",
        keywords: ["http", "headers", "csp", "hsts"]
    },
    {
        id: "reputation",
        name: "Reputation Enricher",
        description: "Bulk-enrich domains/IPs with local scoring, RDAP, and optional provider proxy intel.",
        path: "/tools/reputation",
        icon: Search,
        category: "security",
        status: "new",
        keywords: ["reputation", "bulk", "abuseipdb", "virustotal"]
    },
    {
        id: "cve-prioritizer",
        name: "KEV/CVE Prioritizer",
        description: "Prioritize CVEs client-side using KEV, NVD feeds, CVSS, EPSS, exploit signals, and asset criticality.",
        path: "/tools/cve-prioritizer",
        icon: Search,
        category: "security",
        status: "new",
        keywords: ["cve", "kev", "epss", "prioritization"]
    },
    {
        id: "secrets-scanner",
        name: "Secrets Scanner",
        description: "Detect leaked credentials and high-entropy tokens in pasted content.",
        path: "/tools/secrets-scanner",
        icon: Shield,
        category: "security",
        status: "new",
        keywords: ["secrets", "token", "credential", "leak"]
    },
    {
        id: "ioc-normalizer",
        name: "IOC Canonicalizer",
        description: "Normalize defanged indicators, unicode/punycode domains, and deduplicate by canonical value.",
        path: "/tools/ioc-normalizer",
        icon: Link,
        category: "security",
        status: "new",
        keywords: ["ioc", "canonicalize", "defang", "punycode"]
    },
    {
        id: "stix-taxii",
        name: "STIX/TAXII Utility",
        description: "Parse, validate, compare, and export STIX 2.1 bundles locally.",
        path: "/tools/stix-taxii",
        icon: FileJson,
        category: "security",
        status: "new",
        keywords: ["stix", "taxii", "threat-intel", "bundle"]
    },
    {
        id: "domain-spoof",
        name: "Domain Spoof Detector",
        description: "Score suspected spoofed domains using homoglyph, brand abuse, and domain-age signals.",
        path: "/tools/domain-spoof",
        icon: Globe,
        category: "security",
        status: "new",
        keywords: ["domain", "spoof", "homoglyph", "typosquat"]
    },
    {
        id: "sigma-helper",
        name: "Sigma Linter Helper",
        description: "Lint Sigma rules and generate backend query helpers with ATT&CK coverage checks.",
        path: "/tools/sigma-helper",
        icon: FileType,
        category: "security",
        status: "new",
        keywords: ["sigma", "siem", "attack", "detection"]
    },
    {
        id: "yara-local",
        name: "YARA Local Matcher",
        description: "Run local YARA-style matching against text or local files without upload.",
        path: "/tools/yara-local",
        icon: Search,
        category: "security",
        status: "new",
        keywords: ["yara", "malware", "pattern", "scan"]
    },
    {
        id: "sbom-diff",
        name: "SBOM Diff & Triage",
        description: "Compare CycloneDX/SPDX BOMs and prioritize risky component changes.",
        path: "/tools/sbom-diff",
        icon: FileDiff,
        category: "security",
        status: "new",
        keywords: ["sbom", "cyclonedx", "spdx", "supply-chain"]
    },
    {
        id: "security-header-builder",
        name: "Security Header Builder",
        description: "Generate CSP and security header presets with explicit compatibility tradeoffs.",
        path: "/tools/security-header-builder",
        icon: Shield,
        category: "security",
        status: "new",
        keywords: ["csp", "headers", "hsts", "policy"]
    },

    // PRIORITY 4
    {
        id: "qrcode",
        name: "QR Code Generator",
        description: "Generate QR codes from text.",
        path: "/tools/qrcode",
        icon: QrCode,
        category: "others",
        status: "ready",
        keywords: ["qr", "code", "generate"]
    },
    {
        id: "color",
        name: "Color Converter",
        description: "Convert HEX, RGB, and HSL colors.",
        path: "/tools/color",
        icon: Palette,
        category: "application",
        status: "ready",
        keywords: ["color", "hex", "rgb", "hsl"]
    },
    {
        id: "uuid",
        name: "UUID Generator",
        description: "Generate UUID v4 identifiers.",
        path: "/tools/uuid",
        icon: Fingerprint,
        category: "application",
        status: "ready",
        keywords: ["uuid", "guid", "generate"]
    },
    {
        id: "markdown",
        name: "Markdown Preview",
        description: "Preview Markdown text.",
        path: "/tools/markdown",
        icon: FileType,
        category: "application",
        status: "ready",
        keywords: ["markdown", "preview", "md"]
    },
    {
        id: "html",
        name: "HTML Encoder",
        description: "Encode and decode HTML entities.",
        path: "/tools/html",
        icon: Code,
        category: "application",
        status: "ready",
        keywords: ["html", "encode", "entity"]
    }
]
