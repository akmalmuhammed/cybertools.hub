import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const homeSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/pages/Home.tsx"),
  "utf8",
);

test("homepage restores legacy hero headline and pulse animation", () => {
  assert.equal(homeSource.includes("Your Security Arsenal"), true);
  assert.equal(homeSource.includes("animate-pulse"), true);
  assert.equal(
    homeSource.includes("container relative z-10 flex flex-col items-center text-center"),
    true,
  );
});

test("homepage includes popular tools preview cards", () => {
  assert.equal(homeSource.includes("Popular Tools"), true);
  assert.equal(homeSource.includes("<ToolCard tool={tool} />"), true);
  assert.equal(homeSource.includes('to="/tools"'), true);
});
