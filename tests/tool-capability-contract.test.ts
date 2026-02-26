import assert from "node:assert/strict";
import test from "node:test";
import { TOOLS } from "../src/lib/constants/tools.js";
import {
  getToolCapability,
  getToolDefaultPanels,
  getToolOutboundPolicy,
  getToolPageMode,
  toolRequiresExplicitAction,
} from "../src/lib/constants/tool-capabilities.js";

test("every tool resolves capability metadata", () => {
  TOOLS.forEach((tool) => {
    const capability = getToolCapability(tool.id);
    assert.equal(capability.inputModes.length > 0, true, `${tool.id} should expose at least one input mode`);
    assert.equal(capability.outputKinds.length > 0, true, `${tool.id} should expose at least one output kind`);
    assert.equal(typeof capability.supportsExport, "boolean");
    assert.equal(typeof capability.supportsBatch, "boolean");
    assert.equal(typeof capability.supportsLocalOnly, "boolean");
  });
});

test("outbound policy aligns with processing mode baseline", () => {
  TOOLS.forEach((tool) => {
    const outboundPolicy = getToolOutboundPolicy(tool.id);
    if (tool.processingMode === "local") {
      assert.equal(outboundPolicy === "none" || outboundPolicy === "optional", true);
    }
    if (tool.processingMode === "network") {
      assert.equal(outboundPolicy, "required");
      assert.equal(toolRequiresExplicitAction(tool.id), true);
    }
  });
});

test("tool page mode and default panels are always available", () => {
  TOOLS.forEach((tool) => {
    const pageMode = getToolPageMode(tool.id);
    assert.equal(pageMode === "analyst" || pageMode === "simple", true);

    const panels = getToolDefaultPanels(tool.id);
    assert.equal(panels.length > 0, true);
  });
});

