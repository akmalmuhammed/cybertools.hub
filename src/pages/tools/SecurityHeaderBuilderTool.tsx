import { useState } from "react";
import { ToolTemplate } from "@/components/tools/ToolTemplate";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  buildSecurityHeaders,
  type CspPreset,
  type SecurityHeaderBuildResult,
} from "@/lib/utils/security-header-builder";

function scoreColor(score: number): string {
  if (score >= 90) return "text-green-600 dark:text-green-400";
  if (score >= 75) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function parseAllowedOrigins(input: string): string[] {
  const entries = input
    .split(/[\n,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const allowlistKeywords = new Set(["'self'", "'none'", "'unsafe-inline'", "'unsafe-eval'", "data:", "blob:"]);
  const urls: string[] = [];

  entries.forEach((entry) => {
    if (allowlistKeywords.has(entry)) {
      urls.push(entry);
      return;
    }

    try {
      const parsed = new URL(entry);
      if (parsed.protocol !== "https:" && parsed.protocol !== "wss:") {
        throw new Error("Only https:// and wss:// origins are allowed.");
      }
      urls.push(parsed.origin);
    } catch {
      throw new Error(`Invalid origin: ${entry}`);
    }
  });

  return Array.from(new Set(urls)).slice(0, 30);
}

export default function SecurityHeaderBuilderTool() {
  const [preset, setPreset] = useState<CspPreset>("strict");
  const [routeProfile, setRouteProfile] = useState<"global" | "admin" | "api">("global");
  const [reportOnly, setReportOnly] = useState(false);
  const [allowInlineScript, setAllowInlineScript] = useState(false);
  const [allowInlineStyle, setAllowInlineStyle] = useState(false);
  const [allowDataImages, setAllowDataImages] = useState(false);
  const [includeUpgrade, setIncludeUpgrade] = useState(true);
  const [scriptSourcesInput, setScriptSourcesInput] = useState("");
  const [connectSourcesInput, setConnectSourcesInput] = useState("");
  const [reportUri, setReportUri] = useState("");

  const process = (input: string): string => {
    const extraOrigins = parseAllowedOrigins(input);
    const scriptSources = parseAllowedOrigins(scriptSourcesInput);
    const connectSources = parseAllowedOrigins(connectSourcesInput);

    const mergedScriptSources = Array.from(new Set([...scriptSources, ...extraOrigins]));
    const mergedConnectSources = Array.from(new Set([...connectSources, ...extraOrigins]));

    const normalizedReportUri = reportUri.trim();
    if (normalizedReportUri) {
      const reportUrl = new URL(normalizedReportUri);
      if (reportUrl.protocol !== "https:") {
        throw new Error("Report URI must use https://");
      }
    }

    const result = buildSecurityHeaders({
      preset,
      reportOnly,
      reportUri: normalizedReportUri || undefined,
      allowInlineScript,
      allowInlineStyle,
      allowDataImages,
      includeUpgradeInsecureRequests: includeUpgrade,
      scriptSources: mergedScriptSources,
      connectSources: mergedConnectSources,
      frameAncestors: routeProfile === "admin" ? "none" : preset === "strict" ? "none" : "self",
    });

    result.tradeoffs.push(`Route profile: ${routeProfile}`);
    if (mergedScriptSources.length > 0 || mergedConnectSources.length > 0) {
      result.tradeoffs.push("Custom origins were normalized and deduplicated.");
    }

    return JSON.stringify(result);
  };

  const renderOutput = (output: string) => {
    if (!output) return null;
    let parsed: SecurityHeaderBuildResult;
    try {
      parsed = JSON.parse(output) as SecurityHeaderBuildResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="p-3 border rounded bg-muted/20">
          <div className="text-xs uppercase font-bold text-muted-foreground">Estimated Header Posture</div>
          <div className={`text-2xl font-bold ${scoreColor(parsed.analysis.score)}`}>
            {parsed.analysis.score}/100 ({parsed.analysis.grade})
          </div>
        </div>

        <div className="p-3 border rounded bg-muted/20 space-y-2">
          <h3 className="text-sm font-semibold">Content-Security-Policy</h3>
          <pre className="text-xs font-mono whitespace-pre-wrap break-all">{parsed.csp}</pre>
        </div>

        <div className="p-3 border rounded bg-muted/20 space-y-2">
          <h3 className="text-sm font-semibold">Generated Headers</h3>
          <ul className="text-xs space-y-2">
            {Object.entries(parsed.headers).map(([name, value]) => (
              <li key={name}>
                <div className="font-mono font-semibold">{name}</div>
                <div className="font-mono text-muted-foreground break-all">{value}</div>
              </li>
            ))}
          </ul>
        </div>

        {parsed.tradeoffs.length > 0 && (
          <div className="p-3 border rounded bg-muted/20">
            <h3 className="text-sm font-semibold mb-2">Tradeoffs</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              {parsed.tradeoffs.map((note, index) => (
                <li key={index}>• {note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="Security Header/CSP Builder"
      description="Generate security headers and CSP policy presets with explicit compatibility tradeoff guidance."
      actionLabel="Generate Policy"
      placeholder="Optional: extra trusted origins (one per line), e.g. https://cdn.example.com"
      requiresInput={false}
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="header-builder-preset">Preset</Label>
            <select
              id="header-builder-preset"
              className="w-full rounded border bg-background px-2 py-2 text-sm"
              value={preset}
              onChange={(event) => setPreset(event.target.value as CspPreset)}
            >
              <option value="strict">Strict</option>
              <option value="balanced">Balanced</option>
              <option value="compat">Compatibility</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="header-builder-route-profile">Route Profile</Label>
            <select
              id="header-builder-route-profile"
              className="w-full rounded border bg-background px-2 py-2 text-sm"
              value={routeProfile}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "global" || value === "admin" || value === "api") {
                  setRouteProfile(value);
                }
              }}
            >
              <option value="global">Global site policy</option>
              <option value="admin">Admin console route</option>
              <option value="api">API route profile</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label>Additional script-src sources (optional)</Label>
            <textarea
              className="w-full min-h-[80px] rounded border bg-background px-2 py-2 text-xs font-mono"
              value={scriptSourcesInput}
              onChange={(event) => setScriptSourcesInput(event.target.value)}
              placeholder="https://cdn.example.com"
            />
          </div>

          <div className="space-y-1">
            <Label>Additional connect-src sources (optional)</Label>
            <textarea
              className="w-full min-h-[80px] rounded border bg-background px-2 py-2 text-xs font-mono"
              value={connectSourcesInput}
              onChange={(event) => setConnectSourcesInput(event.target.value)}
              placeholder="https://api.example.com"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="csp-report-uri">Report URI (optional)</Label>
            <input
              id="csp-report-uri"
              className="w-full rounded border bg-background px-2 py-2 text-sm"
              value={reportUri}
              onChange={(event) => setReportUri(event.target.value)}
              placeholder="https://security.example.com/csp-report"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="csp-report-only">Report-only mode</Label>
              <Switch id="csp-report-only" checked={reportOnly} onChange={(event) => setReportOnly(event.target.checked)} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="csp-inline-script">Allow inline scripts</Label>
              <Switch id="csp-inline-script" checked={allowInlineScript} onChange={(event) => setAllowInlineScript(event.target.checked)} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="csp-inline-style">Allow inline styles</Label>
              <Switch id="csp-inline-style" checked={allowInlineStyle} onChange={(event) => setAllowInlineStyle(event.target.checked)} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="csp-data-images">Allow data: images</Label>
              <Switch id="csp-data-images" checked={allowDataImages} onChange={(event) => setAllowDataImages(event.target.checked)} />
            </div>
            <div className="flex items-center justify-between gap-2 sm:col-span-2">
              <Label htmlFor="csp-upgrade">Enable upgrade-insecure-requests</Label>
              <Switch id="csp-upgrade" checked={includeUpgrade} onChange={(event) => setIncludeUpgrade(event.target.checked)} />
            </div>
          </div>
        </div>
      }
      examples={[
        "https://cdn.jsdelivr.net\nhttps://www.googletagmanager.com",
      ]}
    />
  );
}
