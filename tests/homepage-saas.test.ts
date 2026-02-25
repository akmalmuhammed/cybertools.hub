import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const homeSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/pages/Home.tsx"),
  "utf8",
);

test("homepage includes moving popular tools rail with tools-page click-through", () => {
  assert.equal(homeSource.includes("tool-marquee-mask"), true);
  assert.equal(homeSource.includes("tool-marquee-track"), true);
  assert.equal(homeSource.includes("/tools?q="), true);
});

test("homepage includes explicit privacy verification instructions", () => {
  assert.equal(homeSource.includes("Privacy Verification"), true);
  assert.equal(homeSource.includes("Network tab"), true);
  assert.equal(homeSource.includes("no outbound requests"), true);
});
