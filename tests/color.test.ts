import "./setup.js";
import assert from "node:assert/strict";
import test from "node:test";
import { parseAndConvertColor } from "../src/lib/utils/color.js";

test("parseAndConvertColor handles HEX input", () => {
  const result = parseAndConvertColor("#10B981");
  assert.equal(result.hex, "#10B981");
  assert.equal(result.rgb.r, 16);
  assert.equal(result.rgb.g, 185);
  assert.equal(result.rgb.b, 129);
});

test("parseAndConvertColor handles RGB input", () => {
  const result = parseAndConvertColor("rgb(255, 87, 51)");
  assert.equal(result.hex, "#FF5733");
  assert.equal(result.hslString.startsWith("hsl("), true);
});

test("parseAndConvertColor handles HSL input", () => {
  const result = parseAndConvertColor("hsl(0, 100%, 50%)");
  assert.equal(result.hex, "#FF0000");
  assert.equal(result.rgbString, "rgb(255, 0, 0)");
});

test("parseAndConvertColor rejects invalid format", () => {
  assert.throws(() => parseAndConvertColor("hello"), /Unsupported color format/);
});
