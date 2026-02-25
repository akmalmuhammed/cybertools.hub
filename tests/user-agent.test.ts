import assert from "node:assert/strict";
import test from "node:test";
import { parseUserAgent } from "../src/lib/utils/user-agent.js";

test("parseUserAgent identifies desktop Chrome profile", () => {
  const result = parseUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  );

  assert.equal(result.browser.name, "Google Chrome");
  assert.equal(result.os.name, "Windows");
  assert.equal(result.device.type, "desktop");
  assert.equal(result.classification.isDesktop, true);
  assert.equal(result.classification.isBot, false);
});

test("parseUserAgent identifies iPhone Safari as mobile", () => {
  const result = parseUserAgent(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  );

  assert.equal(result.browser.name, "Safari");
  assert.equal(result.os.name, "iOS");
  assert.equal(result.device.type, "mobile");
  assert.equal(result.classification.isMobile, true);
});

test("parseUserAgent detects bot clients", () => {
  const result = parseUserAgent(
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  );

  assert.equal(result.classification.isBot, true);
  assert.equal(result.device.type, "bot");
  assert.equal(result.risk.level, "medium");
});

test("parseUserAgent detects headless automation", () => {
  const result = parseUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/121.0.6167.85 Safari/537.36",
  );

  assert.equal(result.classification.isHeadless, true);
  assert.equal(result.classification.isAutomated, true);
  assert.equal(result.risk.level, "medium");
});

test("parseUserAgent flags outdated legacy browser", () => {
  const result = parseUserAgent(
    "Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko",
  );

  assert.equal(result.browser.name, "Internet Explorer");
  assert.equal(result.os.version, "7");
  assert.equal(result.risk.level, "medium");
  assert.ok(
    result.risk.signals.some((signal) => signal.includes("end-of-life")),
  );
});

test("parseUserAgent requires non-empty input", () => {
  assert.throws(() => parseUserAgent("   "), /required/i);
});
