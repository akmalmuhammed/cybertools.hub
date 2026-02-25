export type DeviceType =
  | "desktop"
  | "mobile"
  | "tablet"
  | "bot"
  | "tv"
  | "console"
  | "unknown";

export interface UserAgentBrowser {
  name: string;
  version: string | null;
  engine: string | null;
}

export interface UserAgentOs {
  name: string;
  version: string | null;
}

export interface UserAgentDevice {
  type: DeviceType;
  vendor: string | null;
  model: string | null;
}

export interface UserAgentClassification {
  isBot: boolean;
  isAutomated: boolean;
  isHeadless: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

export interface UserAgentRisk {
  score: number;
  level: "low" | "medium" | "high";
  signals: string[];
}

export interface UserAgentParseResult {
  raw: string;
  browser: UserAgentBrowser;
  os: UserAgentOs;
  device: UserAgentDevice;
  classification: UserAgentClassification;
  risk: UserAgentRisk;
  notes: string[];
}

function extractVersion(ua: string, pattern: RegExp): string | null {
  const match = ua.match(pattern);
  return match?.[1] ?? null;
}

function normalizeVersion(version: string | null): string | null {
  return version ? version.replace(/_/g, ".") : null;
}

function parseBrowser(ua: string): UserAgentBrowser {
  if (/Edg\//i.test(ua)) {
    return {
      name: "Microsoft Edge",
      version: extractVersion(ua, /Edg\/([\d.]+)/i),
      engine: "Blink",
    };
  }

  if (/OPR\//i.test(ua)) {
    return {
      name: "Opera",
      version: extractVersion(ua, /OPR\/([\d.]+)/i),
      engine: "Blink",
    };
  }

  if (/SamsungBrowser\//i.test(ua)) {
    return {
      name: "Samsung Internet",
      version: extractVersion(ua, /SamsungBrowser\/([\d.]+)/i),
      engine: "Blink",
    };
  }

  if (/CriOS\//i.test(ua)) {
    return {
      name: "Chrome (iOS)",
      version: extractVersion(ua, /CriOS\/([\d.]+)/i),
      engine: "WebKit",
    };
  }

  if (/FxiOS\//i.test(ua)) {
    return {
      name: "Firefox (iOS)",
      version: extractVersion(ua, /FxiOS\/([\d.]+)/i),
      engine: "WebKit",
    };
  }

  if (/HeadlessChrome\//i.test(ua)) {
    return {
      name: "Headless Chrome",
      version: extractVersion(ua, /HeadlessChrome\/([\d.]+)/i),
      engine: "Blink",
    };
  }

  if (/Chrome\//i.test(ua) && !/Chromium\//i.test(ua)) {
    return {
      name: "Google Chrome",
      version: extractVersion(ua, /Chrome\/([\d.]+)/i),
      engine: "Blink",
    };
  }

  if (/Firefox\//i.test(ua)) {
    return {
      name: "Mozilla Firefox",
      version: extractVersion(ua, /Firefox\/([\d.]+)/i),
      engine: "Gecko",
    };
  }

  if (/Version\//i.test(ua) && /Safari\//i.test(ua)) {
    return {
      name: "Safari",
      version: extractVersion(ua, /Version\/([\d.]+)/i),
      engine: "WebKit",
    };
  }

  if (/MSIE\s/i.test(ua)) {
    return {
      name: "Internet Explorer",
      version: extractVersion(ua, /MSIE\s([\d.]+)/i),
      engine: "Trident",
    };
  }

  if (/Trident\/7.0/i.test(ua) && /rv:/i.test(ua)) {
    return {
      name: "Internet Explorer",
      version: extractVersion(ua, /rv:([\d.]+)/i),
      engine: "Trident",
    };
  }

  if (/curl\//i.test(ua)) {
    return {
      name: "curl",
      version: extractVersion(ua, /curl\/([\d.]+)/i),
      engine: null,
    };
  }

  if (/Wget\//i.test(ua)) {
    return {
      name: "wget",
      version: extractVersion(ua, /Wget\/([\d.]+)/i),
      engine: null,
    };
  }

  if (/PostmanRuntime\//i.test(ua)) {
    return {
      name: "Postman Runtime",
      version: extractVersion(ua, /PostmanRuntime\/([\d.]+)/i),
      engine: null,
    };
  }

  if (/python-requests\//i.test(ua)) {
    return {
      name: "python-requests",
      version: extractVersion(ua, /python-requests\/([\d.]+)/i),
      engine: null,
    };
  }

  return {
    name: "Unknown",
    version: null,
    engine: null,
  };
}

function parseWindowsVersion(ntVersion: string | null): string | null {
  if (!ntVersion) return null;
  if (ntVersion === "10.0") return "10/11";
  if (ntVersion === "6.3") return "8.1";
  if (ntVersion === "6.2") return "8";
  if (ntVersion === "6.1") return "7";
  if (ntVersion === "6.0") return "Vista";
  if (ntVersion === "5.1") return "XP";
  return ntVersion;
}

function parseOs(ua: string): UserAgentOs {
  if (/Windows NT/i.test(ua)) {
    const ntVersion = extractVersion(ua, /Windows NT ([\d.]+)/i);
    return {
      name: "Windows",
      version: parseWindowsVersion(ntVersion),
    };
  }

  if (/Android/i.test(ua)) {
    return {
      name: "Android",
      version: extractVersion(ua, /Android ([\d.]+)/i),
    };
  }

  if (/iPhone OS/i.test(ua)) {
    return {
      name: "iOS",
      version: normalizeVersion(extractVersion(ua, /iPhone OS ([\d_]+)/i)),
    };
  }

  if (/iPad; CPU OS/i.test(ua)) {
    return {
      name: "iPadOS",
      version: normalizeVersion(extractVersion(ua, /CPU OS ([\d_]+)/i)),
    };
  }

  if (/Mac OS X/i.test(ua)) {
    return {
      name: "macOS",
      version: normalizeVersion(extractVersion(ua, /Mac OS X ([\d_]+)/i)),
    };
  }

  if (/CrOS/i.test(ua)) {
    return {
      name: "ChromeOS",
      version: extractVersion(ua, /CrOS [^\s]+ ([\d.]+)/i),
    };
  }

  if (/Linux/i.test(ua)) {
    return {
      name: "Linux",
      version: null,
    };
  }

  return {
    name: "Unknown",
    version: null,
  };
}

function parseDevice(ua: string, isBot: boolean): UserAgentDevice {
  const lower = ua.toLowerCase();

  if (isBot) {
    return { type: "bot", vendor: null, model: null };
  }

  if (/smart-tv|hbbtv|appletv|googletv|tizen/i.test(ua)) {
    return { type: "tv", vendor: null, model: null };
  }

  if (/xbox|playstation|nintendo/i.test(ua)) {
    return { type: "console", vendor: null, model: null };
  }

  if (/ipad|tablet|kindle/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) {
    if (/ipad/i.test(ua)) {
      return { type: "tablet", vendor: "Apple", model: "iPad" };
    }
    return { type: "tablet", vendor: null, model: null };
  }

  if (/iphone/i.test(ua)) {
    return { type: "mobile", vendor: "Apple", model: "iPhone" };
  }

  const pixelMatch = ua.match(/\bPixel\s([\w-]+)/i);
  if (pixelMatch) {
    return { type: "mobile", vendor: "Google", model: `Pixel ${pixelMatch[1]}` };
  }

  const samsungMatch = ua.match(/\bSM-[A-Z0-9]+\b/i);
  if (samsungMatch) {
    return { type: "mobile", vendor: "Samsung", model: samsungMatch[0] };
  }

  if (/mobile|android/i.test(lower)) {
    return { type: "mobile", vendor: null, model: null };
  }

  if (/windows|macintosh|linux|cros/i.test(lower)) {
    return { type: "desktop", vendor: null, model: null };
  }

  return { type: "unknown", vendor: null, model: null };
}

function majorVersion(version: string | null): number | null {
  if (!version) return null;
  const major = Number(version.split(".")[0]);
  return Number.isFinite(major) ? major : null;
}

function isOutdated(browser: UserAgentBrowser, os: UserAgentOs): string[] {
  const signals: string[] = [];
  const browserMajor = majorVersion(browser.version);
  const osMajor = majorVersion(os.version);

  if (browser.name === "Internet Explorer") {
    signals.push("Internet Explorer is end-of-life and unsupported.");
  }

  if (browser.name === "Google Chrome" && browserMajor !== null && browserMajor < 120) {
    signals.push("Chrome version appears outdated (<120).");
  }

  if (
    browser.name === "Mozilla Firefox" &&
    browserMajor !== null &&
    browserMajor < 120
  ) {
    signals.push("Firefox version appears outdated (<120).");
  }

  if (browser.name === "Microsoft Edge" && browserMajor !== null && browserMajor < 120) {
    signals.push("Edge version appears outdated (<120).");
  }

  if (browser.name === "Safari" && browserMajor !== null && browserMajor < 16) {
    signals.push("Safari version appears outdated (<16).");
  }

  if (os.name === "Windows" && os.version && ["7", "Vista", "XP"].includes(os.version)) {
    signals.push("Detected legacy Windows release.");
  }

  if (os.name === "Android" && osMajor !== null && osMajor < 10) {
    signals.push("Detected older Android release (<10).");
  }

  if ((os.name === "iOS" || os.name === "iPadOS") && osMajor !== null && osMajor < 15) {
    signals.push("Detected older iOS/iPadOS release (<15).");
  }

  return signals;
}

export function parseUserAgent(input: string): UserAgentParseResult {
  const raw = input.trim();
  if (!raw) throw new Error("User-Agent string is required.");

  const isBot =
    /(bot|crawler|spider|slurp|bingpreview|facebookexternalhit|googlebot|duckduckbot|baiduspider)/i.test(
      raw,
    ) ||
    /(curl\/|wget\/|python-requests\/|go-http-client|httpclient)/i.test(raw);

  const isHeadless = /(headlesschrome|phantomjs)/i.test(raw);
  const isAutomated = /(selenium|puppeteer|playwright|webdriver|cypress)/i.test(raw) || isHeadless;

  const browser = parseBrowser(raw);
  const os = parseOs(raw);
  const device = parseDevice(raw, isBot);

  const outdatedSignals = isOutdated(browser, os);

  const signals: string[] = [];
  let score = 0;

  if (isBot) {
    signals.push("Bot/crawler or scripted client signature detected.");
    score += 30;
  }
  if (isAutomated) {
    signals.push("Automation framework markers detected.");
    score += 30;
  }
  if (isHeadless) {
    signals.push("Headless browser signature detected.");
    score += 25;
  }
  if (browser.name === "Unknown") {
    signals.push("Browser could not be identified.");
    score += 10;
  }
  if (raw.length < 20) {
    signals.push("Very short User-Agent string.");
    score += 10;
  }
  if (outdatedSignals.length > 0) {
    signals.push(...outdatedSignals);
    score += 20;
  }
  if (browser.name === "Internet Explorer") {
    score += 20;
  }

  score = Math.min(score, 100);
  const level = score >= 60 ? "high" : score >= 30 ? "medium" : "low";

  const classification: UserAgentClassification = {
    isBot,
    isAutomated,
    isHeadless,
    isMobile: device.type === "mobile",
    isTablet: device.type === "tablet",
    isDesktop: device.type === "desktop",
  };

  const notes: string[] = [];
  if (!isBot && device.type === "desktop" && browser.name !== "Unknown") {
    notes.push("Looks like a standard desktop browser profile.");
  }
  if (isBot && /(curl|wget|python-requests|go-http-client)/i.test(raw)) {
    notes.push("Likely API/script traffic rather than human browser activity.");
  }
  if (os.name === "Unknown") {
    notes.push("Operating system could not be confidently determined.");
  }

  return {
    raw,
    browser,
    os,
    device,
    classification,
    risk: {
      score,
      level,
      signals,
    },
    notes,
  };
}
