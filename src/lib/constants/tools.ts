import {
    Binary, FileJson, Hash, Link, Calculator,
    Regex, Shield, Mail, Network, Key,
    Search, Globe, FileDigit, Divide, FileDiff,
    QrCode, Palette, Fingerprint, FileType, Code
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
        path: "/hash-generator",
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
        status: "planned",
        keywords: ["regex", "test", "match"]
    },
    {
        id: "jwt",
        name: "JWT Decoder",
        description: "Decode and inspect JSON Web Tokens.",
        path: "/tools/jwt",
        icon: Key,
        category: "security",
        status: "planned",
        keywords: ["jwt", "token", "decode"]
    },
    {
        id: "email",
        name: "Email Header Analyzer",
        description: "Parse and analyze email headers.",
        path: "/tools/email",
        icon: Mail,
        category: "security",
        status: "planned",
        keywords: ["email", "header", "smtp"]
    },
    {
        id: "subnet",
        name: "Subnet Calculator",
        description: "Calculate CIDR ranges and netmasks.",
        path: "/tools/subnet",
        icon: Network,
        category: "network",
        status: "planned",
        keywords: ["cidr", "subnet", "network", "ip"]
    },
    {
        id: "password",
        name: "Password Generator",
        description: "Generate secure random passwords.",
        path: "/tools/password",
        icon: Shield,
        category: "security",
        status: "planned",
        keywords: ["password", "secure", "generator"]
    },

    // PRIORITY 3
    {
        id: "whois",
        name: "Whois Lookup",
        description: "Lookup domain registration information.",
        path: "/tools/whois",
        icon: Search,
        category: "network",
        status: "planned",
        keywords: ["whois", "domain", "lookup"]
    },
    {
        id: "certificate",
        name: "Certificate Decoder",
        description: "Parse PEM/DER SSL certificates.",
        path: "/tools/certificate",
        icon: FileDigit,
        category: "security",
        status: "planned",
        keywords: ["ssl", "cert", "pem", "decode"]
    },
    {
        id: "iplookup",
        name: "IP Lookup",
        description: "Get details about an IP address.",
        path: "/tools/ip",
        icon: Globe,
        category: "network",
        status: "planned",
        keywords: ["ip", "geolocation", "lookup"]
    },
    {
        id: "port",
        name: "Port Checker",
        description: "Check if ports are open.",
        path: "/tools/port",
        icon: Divide,
        category: "network",
        status: "planned",
        keywords: ["port", "check", "open"]
    },
    {
        id: "diff",
        name: "Text Diff",
        description: "Compare two texts and find differences.",
        path: "/tools/diff",
        icon: FileDiff,
        category: "application",
        status: "planned",
        keywords: ["diff", "compare", "text"]
    },

    // PRIORITY 4
    {
        id: "qrcode",
        name: "QR Code Generator",
        description: "Generate QR codes from text.",
        path: "/tools/qrcode",
        icon: QrCode,
        category: "others",
        status: "planned",
        keywords: ["qr", "code", "generate"]
    },
    {
        id: "color",
        name: "Color Converter",
        description: "Convert HEX, RGB, and HSL colors.",
        path: "/tools/color",
        icon: Palette,
        category: "application",
        status: "planned",
        keywords: ["color", "hex", "rgb", "hsl"]
    },
    {
        id: "uuid",
        name: "UUID Generator",
        description: "Generate UUID v4 identifiers.",
        path: "/tools/uuid",
        icon: Fingerprint,
        category: "application",
        status: "planned",
        keywords: ["uuid", "guid", "generate"]
    },
    {
        id: "markdown",
        name: "Markdown Preview",
        description: "Preview Markdown text.",
        path: "/tools/markdown",
        icon: FileType,
        category: "application",
        status: "planned",
        keywords: ["markdown", "preview", "md"]
    },
    {
        id: "html",
        name: "HTML Encoder",
        description: "Encode and decode HTML entities.",
        path: "/tools/html",
        icon: Code,
        category: "application",
        status: "planned",
        keywords: ["html", "encode", "entity"]
    }
]
