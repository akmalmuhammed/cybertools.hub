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

test("robots.txt includes sitemap pointer", () => {
  const robots = readPublicFile("robots.txt");
  assert.equal(robots.includes("User-agent: *"), true);
  assert.equal(robots.includes("Allow: /"), true);
  assert.equal(robots.includes("Sitemap: https://cybertools.hub/sitemap.xml"), true);
});

test("sitemap.xml includes static, domain, and tool routes", () => {
  const sitemap = readPublicFile("sitemap.xml");
  const locs = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)).map((match) => match[1]);

  const expectedUrls = [
    "https://cybertools.hub/",
    "https://cybertools.hub/tools",
    "https://cybertools.hub/about",
    ...DOMAINS.map((domain) => `https://cybertools.hub/domains/${domain.slug}`),
    ...TOOLS.map((tool) => `https://cybertools.hub${tool.path}`),
  ];

  expectedUrls.forEach((expectedUrl) => {
    assert.equal(
      locs.includes(expectedUrl),
      true,
      `sitemap is missing URL entry: ${expectedUrl}`,
    );
  });
});

test("llms indexes and JSON catalog stay aligned with tool registry", () => {
  const llms = readPublicFile("llms.txt");
  const llmsFull = readPublicFile("llms-full.txt");
  const toolIndex = JSON.parse(readPublicFile("tool-index.json")) as {
    counts: { tools: number; domains: number };
    tools: Array<{ id: string; url: string }>;
    domains: Array<{ id: string; url: string }>;
  };

  assert.equal(toolIndex.counts.tools, TOOLS.length);
  assert.equal(toolIndex.counts.domains, DOMAINS.length);

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
    assert.equal(
      toolIndex.tools.some((entry) => entry.id === tool.id && entry.url === `https://cybertools.hub${tool.path}`),
      true,
      `tool-index.json is missing tool entry: ${tool.id}`,
    );
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
