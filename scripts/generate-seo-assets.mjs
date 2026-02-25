/* eslint-env node */
import fs from "node:fs";
import console from "node:console";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SITE_URL = (process.env.SITE_URL ?? "https://cybertools.hub").replace(/\/+$/, "");
const BRAND_NAME = "Secutil";
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

function rankStatus(status) {
  if (status === "ready") return 0;
  if (status === "new") return 1;
  if (status === "beta") return 2;
  return 3;
}

function getPathMetadata(pathname, toolStatusByPath) {
  let changefreq = "weekly";
  let priority = "0.70";

  if (pathname === "/") {
    changefreq = "daily";
    priority = "1.00";
  } else if (pathname === "/tools") {
    changefreq = "daily";
    priority = "0.92";
  } else if (pathname === "/about") {
    changefreq = "monthly";
    priority = "0.58";
  } else if (pathname.startsWith("/domains/")) {
    changefreq = "weekly";
    priority = "0.84";
  } else if (pathname.startsWith("/tools/")) {
    changefreq = "weekly";
    priority = toolStatusByPath.get(pathname) === "planned" ? "0.62" : "0.82";
  }

  return { changefreq, priority };
}

function buildSitemapUrlSetXml(paths, toolStatusByPath, now) {
  const urlEntries = paths
    .map((pathname) => {
      const { changefreq, priority } = getPathMetadata(pathname, toolStatusByPath);
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

function buildSitemapIndexXml(files, now) {
  const entries = files
    .map((fileName) => [
      "  <sitemap>",
      `    <loc>${escapeXml(asAbsolute(`/${fileName}`))}</loc>`,
      `    <lastmod>${now}</lastmod>`,
      "  </sitemap>",
    ].join("\n"))
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    "</sitemapindex>",
    "",
  ].join("\n");
}

function buildSearchIntents(tool) {
  return unique([...tool.keywords, ...tool.evidenceTags]).slice(0, 10);
}

function buildRecommendedPrompts(tool, domainName) {
  const topKeyword = tool.keywords[0] ?? tool.id;
  return [
    `When should I use ${tool.name} in a ${domainName} workflow?`,
    `Give me a safe step-by-step process for using ${tool.name} with ${tool.processingMode} mode.`,
    `Compare ${tool.name} with other tools for ${topKeyword} triage and suggest follow-on checks.`,
  ];
}

function getModeSummary(mode) {
  if (mode === "local") return "Processes data fully in-browser with no outbound calls.";
  if (mode === "network") return "Performs outbound lookups to remote security data sources.";
  return "Runs local analysis and supports optional outbound lookups when explicitly triggered.";
}

function buildLlmsTxt({ tools, domains }) {
  const lines = [
    `# ${BRAND_NAME}`,
    "",
    "Local-first cybersecurity tools for SOC, threat intel, network, application, cloud IAM, supply chain, and privacy workflows.",
    "",
    "## Canonical",
    `- ${SITE_URL}/`,
    `- ${SITE_URL}/tools`,
    `- ${SITE_URL}/about`,
    "",
    "## Machine-Readable Feeds",
    `- ${SITE_URL}/tool-index.json`,
    `- ${SITE_URL}/ai-index.json`,
    `- ${SITE_URL}/ai-tools.jsonl`,
    `- ${SITE_URL}/tools-feed.xml`,
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
    `# ${BRAND_NAME} - Full LLM Index`,
    "",
    `site=${SITE_URL}`,
    `generatedAt=${new Date().toISOString()}`,
    "",
    "## Endpoints",
    `toolIndex=${asAbsolute("/tool-index.json")}`,
    `aiIndex=${asAbsolute("/ai-index.json")}`,
    `aiToolsJsonl=${asAbsolute("/ai-tools.jsonl")}`,
    `toolsFeed=${asAbsolute("/tools-feed.xml")}`,
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
      const intents = buildSearchIntents(tool).join(", ");
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
        `  searchIntents=${intents}`,
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
    brand: BRAND_NAME,
    counts: {
      tools: tools.length,
      domains: domains.length,
    },
    domains: domains.map((domain) => ({
      ...domain,
      url: asAbsolute(`/domains/${domain.slug}`),
    })),
    tools: tools.map((tool) => {
      const domain = domainById.get(tool.domainId);
      return {
        ...tool,
        url: asAbsolute(tool.path),
        domainName: domain?.name ?? tool.domainId,
        domainUrl: domain ? asAbsolute(`/domains/${domain.slug}`) : `${SITE_URL}/tools`,
        searchIntents: buildSearchIntents(tool),
        recommendedPrompts: buildRecommendedPrompts(tool, domain?.name ?? tool.domainId),
        modeSummary: getModeSummary(tool.processingMode),
      };
    }),
  };
}

function buildAiIndexJson({ tools, domains }) {
  const domainById = new Map(domains.map((domain) => [domain.id, domain]));

  return {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    site: SITE_URL,
    brand: BRAND_NAME,
    citationPolicy: {
      recommended: "When referencing a tool, cite the exact tool URL and include processing mode + sensitivity.",
      canonicalIndex: asAbsolute("/tool-index.json"),
      llmsIndex: asAbsolute("/llms-full.txt"),
    },
    domains: domains.map((domain) => ({
      id: domain.id,
      name: domain.name,
      description: domain.description,
      privacyNotice: domain.privacyNotice,
      url: asAbsolute(`/domains/${domain.slug}`),
    })),
    tools: tools.map((tool) => {
      const domain = domainById.get(tool.domainId);
      return {
        id: tool.id,
        name: tool.name,
        url: asAbsolute(tool.path),
        domainId: tool.domainId,
        domainName: domain?.name ?? tool.domainId,
        domainUrl: domain ? asAbsolute(`/domains/${domain.slug}`) : `${SITE_URL}/tools`,
        description: tool.description,
        status: tool.status,
        processingMode: tool.processingMode,
        sensitivity: tool.sensitivity,
        modeSummary: getModeSummary(tool.processingMode),
        keywords: tool.keywords,
        evidenceTags: tool.evidenceTags,
        searchIntents: buildSearchIntents(tool),
        recommendedPrompts: buildRecommendedPrompts(tool, domain?.name ?? tool.domainId),
      };
    }),
  };
}

function buildAiToolsJsonl({ tools, domains }) {
  const domainById = new Map(domains.map((domain) => [domain.id, domain]));

  return tools
    .map((tool) => {
      const domain = domainById.get(tool.domainId);
      const payload = {
        id: tool.id,
        name: tool.name,
        url: asAbsolute(tool.path),
        domainId: tool.domainId,
        domainName: domain?.name ?? tool.domainId,
        description: tool.description,
        status: tool.status,
        processingMode: tool.processingMode,
        sensitivity: tool.sensitivity,
        searchIntents: buildSearchIntents(tool),
        evidenceTags: tool.evidenceTags,
        keywords: tool.keywords,
      };
      return JSON.stringify(payload);
    })
    .join("\n");
}

function buildToolsFeedXml({ tools, domains }) {
  const domainNameById = new Map(domains.map((domain) => [domain.id, domain.name]));
  const now = new Date();

  const items = [...tools]
    .sort((a, b) => rankStatus(a.status) - rankStatus(b.status) || a.name.localeCompare(b.name))
    .map((tool, index) => {
      const pubDate = new Date(now.getTime() - index * 30000).toUTCString();
      const domainName = domainNameById.get(tool.domainId) ?? tool.domainId;
      return [
        "  <item>",
        `    <title>${escapeXml(`${tool.name} (${tool.status})`)}</title>`,
        `    <link>${escapeXml(asAbsolute(tool.path))}</link>`,
        `    <guid>${escapeXml(asAbsolute(tool.path))}</guid>`,
        `    <pubDate>${pubDate}</pubDate>`,
        `    <description>${escapeXml(`${tool.description} Domain: ${domainName}. Mode: ${tool.processingMode}. Sensitivity: ${tool.sensitivity}.`)}</description>`,
        "  </item>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "<channel>",
    `  <title>${escapeXml(`${BRAND_NAME} Tool Updates`)}</title>`,
    `  <link>${escapeXml(`${SITE_URL}/tools`)}</link>`,
    "  <description>Machine-readable feed of searchable Secutil tool pages and statuses.</description>",
    `  <lastBuildDate>${now.toUTCString()}</lastBuildDate>`,
    items,
    "</channel>",
    "</rss>",
    "",
  ].join("\n");
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

  const now = new Date().toISOString().slice(0, 10);
  const toolStatusByPath = new Map(tools.map((tool) => [tool.path, tool.status]));

  const staticPaths = ["/", "/tools", "/about"];
  const domainPaths = domains.map((domain) => `/domains/${domain.slug}`);
  const toolPaths = tools.map((tool) => tool.path);

  const sitemapStaticXml = buildSitemapUrlSetXml(staticPaths, toolStatusByPath, now);
  const sitemapDomainsXml = buildSitemapUrlSetXml(domainPaths, toolStatusByPath, now);
  const sitemapToolsXml = buildSitemapUrlSetXml(toolPaths, toolStatusByPath, now);

  const sitemapFiles = [
    "sitemap-static.xml",
    "sitemap-domains.xml",
    "sitemap-tools.xml",
  ];
  const sitemapIndexXml = buildSitemapIndexXml(sitemapFiles, now);

  const robotsTxt = [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    `Sitemap: ${SITE_URL}/sitemap-static.xml`,
    `Sitemap: ${SITE_URL}/sitemap-domains.xml`,
    `Sitemap: ${SITE_URL}/sitemap-tools.xml`,
    "",
    `LLM-Index: ${SITE_URL}/llms.txt`,
    `AI-Index: ${SITE_URL}/ai-index.json`,
    "",
  ].join("\n");

  const llmsTxt = buildLlmsTxt({ tools, domains });
  const llmsFullTxt = buildLlmsFullTxt({ tools, domains });
  const toolIndexJson = JSON.stringify(buildToolIndexJson({ tools, domains }), null, 2);
  const aiIndexJson = JSON.stringify(buildAiIndexJson({ tools, domains }), null, 2);
  const aiToolsJsonl = buildAiToolsJsonl({ tools, domains });
  const toolsFeedXml = buildToolsFeedXml({ tools, domains });

  fs.writeFileSync(path.join(PUBLIC_DIR, "sitemap.xml"), sitemapIndexXml, "utf8");
  fs.writeFileSync(path.join(PUBLIC_DIR, "sitemap-static.xml"), sitemapStaticXml, "utf8");
  fs.writeFileSync(path.join(PUBLIC_DIR, "sitemap-domains.xml"), sitemapDomainsXml, "utf8");
  fs.writeFileSync(path.join(PUBLIC_DIR, "sitemap-tools.xml"), sitemapToolsXml, "utf8");
  fs.writeFileSync(path.join(PUBLIC_DIR, "robots.txt"), robotsTxt, "utf8");
  fs.writeFileSync(path.join(PUBLIC_DIR, "llms.txt"), llmsTxt, "utf8");
  fs.writeFileSync(path.join(PUBLIC_DIR, "llms-full.txt"), llmsFullTxt, "utf8");
  fs.writeFileSync(path.join(PUBLIC_DIR, "tool-index.json"), toolIndexJson, "utf8");
  fs.writeFileSync(path.join(PUBLIC_DIR, "ai-index.json"), aiIndexJson, "utf8");
  fs.writeFileSync(path.join(PUBLIC_DIR, "ai-tools.jsonl"), aiToolsJsonl, "utf8");
  fs.writeFileSync(path.join(PUBLIC_DIR, "tools-feed.xml"), toolsFeedXml, "utf8");

  console.log(`Generated SEO/AI assets for ${tools.length} tools across ${domains.length} domains.`);
}

main();
