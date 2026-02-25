import * as jsondiffpatch from "jsondiffpatch";
import { format as formatHtmlDiff } from "jsondiffpatch/formatters/html";

export interface JsonDiffRenderResult {
  html: string;
  hasChanges: boolean;
}

const EMPTY_DIFF_HTML =
  '<div class="p-4 text-muted-foreground">No differences found. Objects are identical.</div>';

function objectHash(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const candidate = value as Record<string, unknown>;
    const identifier = candidate._id ?? candidate.id ?? candidate.name;
    if (typeof identifier === "string" || typeof identifier === "number") {
      return String(identifier);
    }
  }
  return JSON.stringify(value);
}

export function renderJsonDiffHtml(
  left: unknown,
  right: unknown,
): JsonDiffRenderResult {
  const instance = jsondiffpatch.create({ objectHash });
  const delta = instance.diff(left, right);

  if (!delta) {
    return { html: EMPTY_DIFF_HTML, hasChanges: false };
  }

  return {
    html: formatHtmlDiff(delta, left) ?? EMPTY_DIFF_HTML,
    hasChanges: true,
  };
}
