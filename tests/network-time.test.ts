import "./setup.js";
import assert from "node:assert/strict";
import test from "node:test";
import { calculateSubnet } from "../src/lib/utils/network.js";
import { dateToUnix, unixToDate } from "../src/lib/utils/time.js";

test("calculateSubnet computes /24 network details", () => {
  const result = calculateSubnet("192.168.1.10", 24);
  assert.equal(result.netmask, "255.255.255.0");
  assert.equal(result.networkAddress, "192.168.1.0");
  assert.equal(result.broadcastAddress, "192.168.1.255");
  assert.equal(result.firstHost, "192.168.1.1");
  assert.equal(result.lastHost, "192.168.1.254");
  assert.equal(result.usableHosts, 254);
});

test("calculateSubnet handles /0 correctly", () => {
  const result = calculateSubnet("8.8.8.8", 0);
  assert.equal(result.netmask, "0.0.0.0");
  assert.equal(result.networkAddress, "0.0.0.0");
  assert.equal(result.broadcastAddress, "255.255.255.255");
  assert.equal(result.firstHost, "0.0.0.1");
  assert.equal(result.lastHost, "255.255.255.254");
});

test("calculateSubnet handles /31 point-to-point addressing", () => {
  const result = calculateSubnet("10.0.0.0", 31);
  assert.equal(result.networkAddress, "10.0.0.0");
  assert.equal(result.broadcastAddress, "10.0.0.1");
  assert.equal(result.firstHost, "10.0.0.0");
  assert.equal(result.lastHost, "10.0.0.1");
  assert.equal(result.usableHosts, 2);
});

test("dateToUnix accepts epoch start (0)", () => {
  const unix = dateToUnix("1970-01-01T00:00:00Z");
  assert.equal(unix, 0);
});

test("dateToUnix returns NaN for invalid input", () => {
  const unix = dateToUnix("not-a-date");
  assert.equal(Number.isNaN(unix), true);
});

test("unixToDate returns formatted value for valid timestamp", () => {
  const output = unixToDate(1735689600);
  assert.match(output, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.notEqual(output, "Invalid Timestamp");
});
