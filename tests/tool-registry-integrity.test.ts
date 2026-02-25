import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

type ToolEntry = {
  id: string;
  name: string;
  description: string;
  path: string;
  domainId: string;
  status: string;
  keywords: string[];
  evidenceTags: string[];
};

type DomainEntry = {
  id: string;
  slug: string;
  name: string;
};

function readText(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
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
    if (depth === 0) {
      return source.slice(firstBracket + 1, index);
    }
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

function readArrayField(block: string, key: string): string[] {
  const values = block.match(new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`))?.[1] ?? "";
  return Array.from(values.matchAll(/"([^"]+)"/g)).map((item) => item[1]);
}

function parseTools(): ToolEntry[] {
  const source = readText("src/lib/constants/tools.ts");
  const section = extractArraySection(source, "export const TOOLS");
  return extractObjectBlocks(section)
    .map((block) => ({
      id: readStringField(block, "id"),
      name: readStringField(block, "name"),
      description: readStringField(block, "description"),
      path: readStringField(block, "path"),
      domainId: readStringField(block, "domainId"),
      status: readStringField(block, "status"),
      keywords: readArrayField(block, "keywords"),
      evidenceTags: readArrayField(block, "evidenceTags"),
    }))
    .filter((tool) => tool.id && tool.path && tool.name);
}

function parseDomains(): DomainEntry[] {
  const source = readText("src/lib/constants/tool-domains.ts");
  const section = extractArraySection(source, "export const TOOL_DOMAINS");
  return extractObjectBlocks(section)
    .map((block) => ({
      id: readStringField(block, "id"),
      slug: readStringField(block, "slug"),
      name: readStringField(block, "name"),
    }))
    .filter((domain) => domain.id && domain.slug && domain.name);
}

const TOOLS = parseTools();
const DOMAINS = parseDomains();

test("tool registry keeps unique identifiers and complete discovery metadata", () => {
  const ids = TOOLS.map((tool) => tool.id);
  const paths = TOOLS.map((tool) => tool.path);
  const names = TOOLS.map((tool) => tool.name);

  assert.equal(new Set(ids).size, ids.length, "tool ids must be unique");
  assert.equal(new Set(paths).size, paths.length, "tool paths must be unique");
  assert.equal(new Set(names).size, names.length, "tool names must be unique");

  TOOLS.forEach((tool) => {
    assert.equal(tool.path.startsWith("/tools/"), true, `${tool.id} must use /tools/* route space`);
    assert.equal(tool.keywords.length >= 3, true, `${tool.id} must have 3+ keywords for search coverage`);
    assert.equal(tool.evidenceTags.length >= 2, true, `${tool.id} must have 2+ evidence tags`);
    assert.equal(tool.description.length >= 20, true, `${tool.id} should have meaningful description text`);
  });
});

test("every domain has meaningful onboarded depth", () => {
  DOMAINS.forEach((domain) => {
    const tools = TOOLS.filter((tool) => tool.domainId === domain.id);
    assert.equal(
      tools.length >= 5,
      true,
      `${domain.id} should have at least 5 onboarded tools to avoid shallow domain coverage`,
    );
  });
});

test("tool routing stays synchronized with app route declarations", () => {
  const appSource = readText("src/App.tsx");
  const declaredRoutes = Array.from(appSource.matchAll(/<Route path="([^"]+)"/g)).map(
    (match) => match[1],
  );

  const wildcardPlannedRoute = "/tools/:toolSlug";
  assert.equal(
    declaredRoutes.includes(wildcardPlannedRoute),
    true,
    "planned tool wildcard route must remain present",
  );

  const plannedPaths = new Set(
    TOOLS.filter((tool) => tool.status === "planned").map((tool) => tool.path),
  );
  const nonPlannedPaths = TOOLS.filter((tool) => tool.status !== "planned").map((tool) => tool.path);

  nonPlannedPaths.forEach((toolPath) => {
    assert.equal(
      declaredRoutes.includes(toolPath),
      true,
      `missing explicit route for non-planned tool path: ${toolPath}`,
    );
  });

  plannedPaths.forEach((toolPath) => {
    assert.equal(
      declaredRoutes.includes(toolPath),
      false,
      `planned tool path should use wildcard route until implemented: ${toolPath}`,
    );
  });
});

test("home spotlight tool ids resolve to real tools", () => {
  const homeSource = readText("src/pages/Home.tsx");
  const previewBlockMatch = homeSource.match(/const (?:previewToolIds|MARQUEE_TOOL_IDS) = \[([\s\S]*?)\]/);
  assert.notEqual(previewBlockMatch, null, "Home spotlight tool id block is required");

  const previewIds = Array.from((previewBlockMatch?.[1] ?? "").matchAll(/"([^"]+)"/g)).map(
    (item) => item[1],
  );

  previewIds.forEach((previewId) => {
    assert.equal(
      TOOLS.some((tool) => tool.id === previewId),
      true,
      `Home spotlight section references unknown tool id: ${previewId}`,
    );
  });
});
