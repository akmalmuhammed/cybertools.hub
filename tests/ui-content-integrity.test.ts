import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const SOURCE_ROOT = path.resolve(process.cwd(), "src");
const DISALLOWED_MARKERS = ["Â©", "â€¢", "âŒ˜", "\uFFFD"];

function collectFiles(rootDir: string): string[] {
  const output: string[] = [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });

  entries.forEach((entry) => {
    const absolute = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      output.push(...collectFiles(absolute));
      return;
    }
    if (!entry.isFile()) return;
    if (!absolute.endsWith(".ts") && !absolute.endsWith(".tsx")) return;
    output.push(absolute);
  });

  return output;
}

test("ui source files do not contain known mojibake artifacts", () => {
  const sourceFiles = collectFiles(SOURCE_ROOT);
  const findings: string[] = [];

  sourceFiles.forEach((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    DISALLOWED_MARKERS.forEach((marker) => {
      if (content.includes(marker)) {
        findings.push(`${path.relative(process.cwd(), filePath)} contains ${JSON.stringify(marker)}`);
      }
    });
  });

  assert.equal(
    findings.length,
    0,
    findings.length > 0 ? `found mojibake artifacts:\n${findings.join("\n")}` : undefined,
  );
});
