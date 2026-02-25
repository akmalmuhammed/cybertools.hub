import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

type ToolEntry = {
  id: string;
  path: string;
};

type DomainEntry = {
  id: string;
  slug: string;
};

function readText(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

function readPublicFile(relativePath: string): string {
  return readText(path.join("public", relativePath));
}

function extractLocs(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((match) => match[1]);
}

function extractArraySection(source: string, marker: string): string {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `missing marker: ${marker}`);
  const assignmentIndex = source.indexOf("=", markerIndex);
  assert.notEqual(assignmentIndex, -1, `missing assignment after marker: ${marker}`);
  const firstBracket = source.indexOf("[", assignmentIndex);
  assert.notEqual(firstBracket, -1, `missing array start after marker: ${marker}`);

  let depth = 0;
  for (let index = firstBracket; index < source.length; index += 1) {
    const char = source[index];
    if (char === "[") depth += 1;
    if (char === "]") depth -= 1;
    if (depth === 0) return source.slice(firstBracket + 1, index);
  }

  throw new Error(`missing array end after marker: ${marker}`);
}

function extractObjectBlocks(section: string): string[] {
  const blocks: string[] = [];
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

function readStringField(block: string, key: string): string {
  return block.match(new RegExp(`${key}:\\s*"([^"]+)"`))?.[1] ?? "";
}

function parseTools(): ToolEntry[] {
  const source = readText("src/lib/constants/tools.ts");
  const section = extractArraySection(source, "export const TOOLS");
  return extractObjectBlocks(section)
    .map((block) => ({
      id: readStringField(block, "id"),
      path: readStringField(block, "path"),
    }))
    .filter((tool) => tool.id && tool.path);
}

function parseDomains(): DomainEntry[] {
  const source = readText("src/lib/constants/tool-domains.ts");
  const section = extractArraySection(source, "export const TOOL_DOMAINS");
  return extractObjectBlocks(section)
    .map((block) => ({
      id: readStringField(block, "id"),
      slug: readStringField(block, "slug"),
    }))
    .filter((domain) => domain.id && domain.slug);
}

const TOOLS = parseTools();
const DOMAINS = parseDomains();

test("robots.txt includes sitemap and AI index pointers", () => {
  const robots = readPublicFile("robots.txt");
  assert.equal(robots.includes("User-agent: *"), true);
  assert.equal(robots.includes("Allow: /"), true);
  assert.equal(robots.includes("Sitemap: https://cybertools.hub/sitemap.xml"), true);
  assert.equal(robots.includes("Sitemap: https://cybertools.hub/sitemap-static.xml"), true);
  assert.equal(robots.includes("Sitemap: https://cybertools.hub/sitemap-domains.xml"), true);
  assert.equal(robots.includes("Sitemap: https://cybertools.hub/sitemap-tools.xml"), true);
  assert.equal(robots.includes("LLM-Index: https://cybertools.hub/llms.txt"), true);
  assert.equal(robots.includes("AI-Index: https://cybertools.hub/ai-index.json"), true);
});

test("segmented sitemap files include static, domain, and tool URLs", () => {
  const sitemapIndex = readPublicFile("sitemap.xml");
  const sitemapStatic = readPublicFile("sitemap-static.xml");
  const sitemapDomains = readPublicFile("sitemap-domains.xml");
  const sitemapTools = readPublicFile("sitemap-tools.xml");

  const indexLocs = extractLocs(sitemapIndex);
  const staticLocs = extractLocs(sitemapStatic);
  const domainLocs = extractLocs(sitemapDomains);
  const toolLocs = extractLocs(sitemapTools);

  [
    "https://cybertools.hub/sitemap-static.xml",
    "https://cybertools.hub/sitemap-domains.xml",
    "https://cybertools.hub/sitemap-tools.xml",
  ].forEach((url) => {
    assert.equal(indexLocs.includes(url), true, `sitemap index missing ${url}`);
  });

  [
    "https://cybertools.hub/",
    "https://cybertools.hub/tools",
    "https://cybertools.hub/about",
  ].forEach((url) => {
    assert.equal(staticLocs.includes(url), true, `static sitemap missing ${url}`);
  });

  DOMAINS.map((domain) => `https://cybertools.hub/domains/${domain.slug}`).forEach((url) => {
    assert.equal(domainLocs.includes(url), true, `domains sitemap missing ${url}`);
  });

  TOOLS.map((tool) => `https://cybertools.hub${tool.path}`).forEach((url) => {
    assert.equal(toolLocs.includes(url), true, `tools sitemap missing ${url}`);
  });
});

test("llms indexes and JSON catalog stay aligned with tool registry", () => {
  const llms = readPublicFile("llms.txt");
  const llmsFull = readPublicFile("llms-full.txt");
  const toolIndex = JSON.parse(readPublicFile("tool-index.json")) as {
    counts: { tools: number; domains: number };
    tools: Array<{ id: string; url: string; domainUrl: string; searchIntents: string[] }>;
    domains: Array<{ id: string; url: string }>;
  };

  assert.equal(toolIndex.counts.tools, TOOLS.length);
  assert.equal(toolIndex.counts.domains, DOMAINS.length);
  assert.equal(llms.includes("https://cybertools.hub/ai-index.json"), true);

  TOOLS.forEach((tool) => {
    assert.equal(
      llms.includes(`https://cybertools.hub${tool.path}`),
      true,
      `llms.txt is missing tool URL: ${tool.path}`,
    );
    assert.equal(
      llmsFull.includes(`id=${tool.id}`),
      true,
      `llms-full.txt is missing tool id: ${tool.id}`,
    );
    const toolRecord = toolIndex.tools.find((entry) => entry.id === tool.id);
    assert.notEqual(toolRecord, undefined, `tool-index.json missing tool entry: ${tool.id}`);
    assert.equal(toolRecord?.url, `https://cybertools.hub${tool.path}`);
    assert.equal((toolRecord?.searchIntents.length ?? 0) > 0, true, `tool-index.json missing intents for ${tool.id}`);
  });

  DOMAINS.forEach((domain) => {
    const expectedDomainUrl = `https://cybertools.hub/domains/${domain.slug}`;
    assert.equal(
      toolIndex.domains.some((entry) => entry.id === domain.id && entry.url === expectedDomainUrl),
      true,
      `tool-index.json is missing domain entry: ${domain.id}`,
    );
  });
});

test("AI indexes and feed stay aligned with tool registry", () => {
  const aiIndex = JSON.parse(readPublicFile("ai-index.json")) as {
    tools: Array<{ id: string; url: string; recommendedPrompts: string[] }>;
    domains: Array<{ id: string; url: string }>;
  };
  const aiToolsJsonl = readPublicFile("ai-tools.jsonl")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { id: string; url: string; searchIntents: string[] });
  const toolsFeed = readPublicFile("tools-feed.xml");

  assert.equal(aiIndex.tools.length, TOOLS.length);
  assert.equal(aiIndex.domains.length, DOMAINS.length);
  assert.equal(aiToolsJsonl.length, TOOLS.length);

  TOOLS.forEach((tool) => {
    const expectedUrl = `https://cybertools.hub${tool.path}`;
    const aiTool = aiIndex.tools.find((entry) => entry.id === tool.id);
    const aiJsonlTool = aiToolsJsonl.find((entry) => entry.id === tool.id);

    assert.notEqual(aiTool, undefined, `ai-index.json missing ${tool.id}`);
    assert.equal(aiTool?.url, expectedUrl, `ai-index.json URL mismatch for ${tool.id}`);
    assert.equal((aiTool?.recommendedPrompts.length ?? 0) > 0, true, `ai-index prompts missing for ${tool.id}`);

    assert.notEqual(aiJsonlTool, undefined, `ai-tools.jsonl missing ${tool.id}`);
    assert.equal(aiJsonlTool?.url, expectedUrl, `ai-tools.jsonl URL mismatch for ${tool.id}`);
    assert.equal((aiJsonlTool?.searchIntents.length ?? 0) > 0, true, `ai-tools.jsonl intents missing for ${tool.id}`);

    assert.equal(toolsFeed.includes(expectedUrl), true, `tools-feed.xml missing ${tool.path}`);
  });
});
