/* eslint-env node */
import fs from "node:fs";
import console from "node:console";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SITE_URL = (process.env.SITE_URL ?? "https://cybertools.hub").replace(/\/+$/, "");
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const TOOLS_FILE = path.join(ROOT, "src/lib/constants/tools.ts");
const DOMAINS_FILE = path.join(ROOT, "src/lib/constants/tool-domains.ts");
const PUBLIC_DIR = path.join(ROOT, "public");

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function extractArraySection(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Unable to find marker: ${marker}`);
  }

  const assignmentIndex = source.indexOf("=", markerIndex);
  if (assignmentIndex === -1) {
    throw new Error(`Unable to locate assignment for marker: ${marker}`);
  }

  const firstBracket = source.indexOf("[", assignmentIndex);
  if (firstBracket === -1) {
    throw new Error(`Unable to locate array start for marker: ${marker}`);
  }

  let depth = 0;
  for (let index = firstBracket; index < source.length; index += 1) {
    const char = source[index];
    if (char === "[") depth += 1;
    if (char === "]") depth -= 1;
    if (depth === 0) {
      return source.slice(firstBracket + 1, index);
    }
  }

  throw new Error(`Unable to locate array end for marker: ${marker}`);
}

function extractObjectBlocks(section) {
  const blocks = [];
  let depth = 0;
  let blockStart = -1;

  for (let index = 0; index < section.length; index += 1) {
    const char = section[index];
    if (char === "{") {
      if (depth === 0) blockStart = index;
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0 && blockStart >= 0) {
        blocks.push(section.slice(blockStart, index + 1));
        blockStart = -1;
      }
    }
  }

  return blocks;
}

function readStringField(block, key) {
  const match = block.match(new RegExp(`${key}:\\s*"([^"]+)"`));
  return match?.[1] ?? "";
}

function readArrayField(block, key) {
  const match = block.match(new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`));
  if (!match) return [];
  return Array.from(match[1].matchAll(/"([^"]+)"/g)).map((item) => item[1]);
}

function parseTools(source) {
  const section = extractArraySection(source, "export const TOOLS");
  const blocks = extractObjectBlocks(section);
  return blocks
    .map((block) => ({
      id: readStringField(block, "id"),
      name: readStringField(block, "name"),
      description: readStringField(block, "description"),
      path: readStringField(block, "path"),
      domainId: readStringField(block, "domainId"),
      processingMode: readStringField(block, "processingMode"),
      sensitivity: readStringField(block, "sensitivity"),
      status: readStringField(block, "status"),
      keywords: readArrayField(block, "keywords"),
      evidenceTags: readArrayField(block, "evidenceTags"),
    }))
    .filter((tool) => tool.id && tool.path && tool.name);
}

function parseDomains(source) {
  const section = extractArraySection(source, "export const TOOL_DOMAINS");
  const blocks = extractObjectBlocks(section);
  return blocks
    .map((block) => ({
      id: readStringField(block, "id"),
      slug: readStringField(block, "slug"),
      name: readStringField(block, "name"),
      description: readStringField(block, "description"),
      privacyNotice: readStringField(block, "privacyNotice"),
    }))
    .filter((domain) => domain.id && domain.slug && domain.name);
}

function asAbsolute(pathname) {
  return `${SITE_URL}${pathname}`;
}

function unique(values) {
  return Array.from(new Set(values));
}

function buildSitemapXml({ tools, domains }) {
  const now = new Date().toISOString().slice(0, 10);
  const toolStatusByPath = new Map(tools.map((tool) => [tool.path, tool.status]));

  const paths = unique([
    "/",
    "/tools",
    "/about",
    ...domains.map((domain) => `/domains/${domain.slug}`),
    ...tools.map((tool) => tool.path),
  ]);

  const urlEntries = paths
    .map((pathname) => {
      let changefreq = "weekly";
      let priority = "0.70";

      if (pathname === "/") {
        changefreq = "daily";
        priority = "1.00";
      } else if (pathname === "/tools") {
        changefreq = "daily";
        priority = "0.90";
      } else if (pathname === "/about") {
        changefreq = "monthly";
        priority = "0.50";
      } else if (pathname.startsWith("/domains/")) {
        changefreq = "weekly";
        priority = "0.80";
      } else if (pathname.startsWith("/tools/")) {
        changefreq = "weekly";
        priority = toolStatusByPath.get(pathname) === "planned" ? "0.55" : "0.80";
      }

      return [
        "  <url>",
        `    <loc>${escapeXml(asAbsolute(pathname))}</loc>`,
        `    <lastmod>${now}</lastmod>`,
        `    <changefreq>${changefreq}</changefreq>`,
        `    <priority>${priority}</priority>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urlEntries,
    "</urlset>",
    "",
  ].join("\n");
}

function buildLlmsTxt({ tools, domains }) {
  const lines = [
    "# CyberTools Hub",
    "",
    "Local-first cybersecurity tools for SOC, threat intel, network, application, cloud IAM, supply chain, and privacy workflows.",
    "",
    "## Canonical",
    `- ${SITE_URL}/`,
    `- ${SITE_URL}/tools`,
    `- ${SITE_URL}/about`,
    "",
    "## Domain Pages",
    ...domains.map(
      (domain) =>
        `- [${domain.name}](${asAbsolute(`/domains/${domain.slug}`)}): ${domain.description}`,
    ),
    "",
    "## Tool Index",
    ...tools.map(
      (tool) =>
        `- [${tool.name}](${asAbsolute(tool.path)}) | domain=${tool.domainId} | mode=${tool.processingMode} | sensitivity=${tool.sensitivity} | status=${tool.status}`,
    ),
    "",
  ];
  return lines.join("\n");
}

function buildLlmsFullTxt({ tools, domains }) {
  const domainNameById = new Map(domains.map((domain) => [domain.id, domain.name]));
  const lines = [
    "# CyberTools Hub - Full LLM Index",
    "",
    `site=${SITE_URL}`,
    `generatedAt=${new Date().toISOString()}`,
    "",
    "## Domains",
    ...domains.map(
      (domain) =>
        `- id=${domain.id} | name=${domain.name} | url=${asAbsolute(`/domains/${domain.slug}`)} | note=${domain.privacyNotice}`,
    ),
    "",
    "## Tools",
    ...tools.map((tool) => {
      const domainName = domainNameById.get(tool.domainId) ?? tool.domainId;
      const keywords = tool.keywords.join(", ");
      const tags = tool.evidenceTags.join(", ");
      return [
        `- id=${tool.id}`,
        `  name=${tool.name}`,
        `  url=${asAbsolute(tool.path)}`,
        `  domain=${domainName} (${tool.domainId})`,
        `  status=${tool.status}`,
        `  mode=${tool.processingMode}`,
        `  sensitivity=${tool.sensitivity}`,
        `  description=${tool.description}`,
        `  keywords=${keywords}`,
        `  evidenceTags=${tags}`,
      ].join("\n");
    }),
    "",
  ];
  return lines.join("\n");
}

function buildToolIndexJson({ tools, domains }) {
  const domainById = new Map(domains.map((domain) => [domain.id, domain]));
  return {
    generatedAt: new Date().toISOString(),
    site: SITE_URL,
    counts: {
      tools: tools.length,
      domains: domains.length,
    },
    domains: domains.map((domain) => ({
      ...domain,
      url: asAbsolute(`/domains/${domain.slug}`),
    })),
    tools: tools.map((tool) => ({
      ...tool,
      url: asAbsolute(tool.path),
      domainName: domainById.get(tool.domainId)?.name ?? tool.domainId,
    })),
  };
}

function main() {
  const toolsSource = fs.readFileSync(TOOLS_FILE, "utf8");
  const domainsSource = fs.readFileSync(DOMAINS_FILE, "utf8");

  const tools = parseTools(toolsSource);
  const domains = parseDomains(domainsSource);

  if (tools.length === 0) {
    throw new Error("No tools parsed from src/lib/constants/tools.ts");
  }
  if (domains.length === 0) {
    throw new Error("No domains parsed from src/lib/constants/tool-domains.ts");
  }

  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  const sitemapXml = buildSitemapXml({ tools, domains });
  const robotsTxt = [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
  const llmsTxt = buildLlmsTxt({ tools, domains });
  const llmsFullTxt = buildLlmsFullTxt({ tools, domains });
  const toolIndexJson = JSON.stringify(buildToolIndexJson({ tools, domains }), null, 2);

  fs.writeFileSync(path.join(PUBLIC_DIR, "sitemap.xml"), sitemapXml, "utf8");
  fs.writeFileSync(path.join(PUBLIC_DIR, "robots.txt"), robotsTxt, "utf8");
  fs.writeFileSync(path.join(PUBLIC_DIR, "llms.txt"), llmsTxt, "utf8");
  fs.writeFileSync(path.join(PUBLIC_DIR, "llms-full.txt"), llmsFullTxt, "utf8");
  fs.writeFileSync(path.join(PUBLIC_DIR, "tool-index.json"), toolIndexJson, "utf8");

  console.log(`Generated SEO/LLM assets for ${tools.length} tools across ${domains.length} domains.`);
}

main();
