export type ColorInputFormat = "hex" | "rgb" | "hsl";

export interface NormalizedColor {
  inputFormat: ColorInputFormat;
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  rgbString: string;
  hslString: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeHue(hue: number): number {
  const normalized = hue % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function componentToHex(value: number): string {
  return value.toString(16).padStart(2, "0").toUpperCase();
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}

function hslToRgb(
  h: number,
  sPercent: number,
  lPercent: number,
): { r: number; g: number; b: number } {
  const s = clamp(sPercent, 0, 100) / 100;
  const l = clamp(lPercent, 0, 100) / 100;
  const hue = normalizeHue(h) / 360;

  if (s === 0) {
    const gray = Math.round(l * 255);
    return { r: gray, g: gray, b: gray };
  }

  const hueToChannel = (p: number, q: number, t: number): number => {
    let tc = t;
    if (tc < 0) tc += 1;
    if (tc > 1) tc -= 1;
    if (tc < 1 / 6) return p + (q - p) * 6 * tc;
    if (tc < 1 / 2) return q;
    if (tc < 2 / 3) return p + (q - p) * (2 / 3 - tc) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const r = Math.round(hueToChannel(p, q, hue + 1 / 3) * 255);
  const g = Math.round(hueToChannel(p, q, hue) * 255);
  const b = Math.round(hueToChannel(p, q, hue - 1 / 3) * 255);

  return { r, g, b };
}

function rgbToHsl(
  rInput: number,
  gInput: number,
  bInput: number,
): { h: number; s: number; l: number } {
  const r = clamp(rInput, 0, 255) / 255;
  const g = clamp(gInput, 0, 255) / 255;
  const b = clamp(bInput, 0, 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case r:
        h = (g - b) / delta + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      case b:
        h = (r - g) / delta + 4;
        break;
    }
    h *= 60;
  }

  return {
    h: Math.round(normalizeHue(h)),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function parseHex(input: string): { r: number; g: number; b: number } | null {
  let normalized = input.trim().replace(/^#/, "");

  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((char) => `${char}${char}`)
      .join("");
  }

  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) {
    return null;
  }

  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function parseRgb(input: string): { r: number; g: number; b: number } | null {
  const match = input.trim().match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return null;

  const values = match[1].split(",").map((item) => item.trim());
  if (values.length < 3) return null;

  const [rRaw, gRaw, bRaw] = values;
  const r = Number(rRaw);
  const g = Number(gRaw);
  const b = Number(bRaw);

  if ([r, g, b].some((value) => Number.isNaN(value))) return null;
  if ([r, g, b].some((value) => value < 0 || value > 255)) return null;

  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}

function parseHsl(input: string): { h: number; s: number; l: number } | null {
  const match = input.trim().match(/^hsla?\(([^)]+)\)$/i);
  if (!match) return null;

  const values = match[1].split(",").map((item) => item.trim());
  if (values.length < 3) return null;

  const [hRaw, sRaw, lRaw] = values;
  const h = Number(hRaw.replace(/deg$/i, ""));
  const s = Number(sRaw.replace(/%$/, ""));
  const l = Number(lRaw.replace(/%$/, ""));

  if ([h, s, l].some((value) => Number.isNaN(value))) return null;
  if (s < 0 || s > 100 || l < 0 || l > 100) return null;

  return { h, s, l };
}

export function parseAndConvertColor(input: string): NormalizedColor {
  const raw = input.trim();
  if (!raw) {
    throw new Error("Color input is required");
  }

  const fromHex = parseHex(raw);
  if (fromHex) {
    const hsl = rgbToHsl(fromHex.r, fromHex.g, fromHex.b);
    const hex = rgbToHex(fromHex.r, fromHex.g, fromHex.b);
    return {
      inputFormat: "hex",
      hex,
      rgb: fromHex,
      hsl,
      rgbString: `rgb(${fromHex.r}, ${fromHex.g}, ${fromHex.b})`,
      hslString: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
    };
  }

  const fromRgb = parseRgb(raw);
  if (fromRgb) {
    const hsl = rgbToHsl(fromRgb.r, fromRgb.g, fromRgb.b);
    return {
      inputFormat: "rgb",
      hex: rgbToHex(fromRgb.r, fromRgb.g, fromRgb.b),
      rgb: fromRgb,
      hsl,
      rgbString: `rgb(${fromRgb.r}, ${fromRgb.g}, ${fromRgb.b})`,
      hslString: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
    };
  }

  const fromHsl = parseHsl(raw);
  if (fromHsl) {
    const rgb = hslToRgb(fromHsl.h, fromHsl.s, fromHsl.l);
    const hsl = {
      h: Math.round(normalizeHue(fromHsl.h)),
      s: Math.round(clamp(fromHsl.s, 0, 100)),
      l: Math.round(clamp(fromHsl.l, 0, 100)),
    };
    return {
      inputFormat: "hsl",
      hex: rgbToHex(rgb.r, rgb.g, rgb.b),
      rgb,
      hsl,
      rgbString: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
      hslString: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
    };
  }

  throw new Error(
    "Unsupported color format. Use HEX (#RRGGBB), RGB (rgb(r,g,b)), or HSL (hsl(h,s%,l%)).",
  );
}
