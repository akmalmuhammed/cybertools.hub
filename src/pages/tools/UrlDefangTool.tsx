import { useState } from "react";
import { ToolTemplate } from "@/components/tools/ToolTemplate";
import {
  canonicalizeUrl,
  canonicalizeUrlsFromText,
  defangText,
  refangText,
  type CanonicalUrlResult,
} from "@/lib/utils/url-defense";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type UrlDefenseMode = "defang" | "refang" | "canonicalize";

function parseCanonicalOutput(output: string): CanonicalUrlResult[] | null {
  try {
    const parsed = JSON.parse(output) as CanonicalUrlResult[] | CanonicalUrlResult;
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return null;
  }
}

export default function UrlDefangTool() {
  const [mode, setMode] = useState<UrlDefenseMode>("defang");

  const handleModeChange = (value: string) => {
    if (value === "defang" || value === "refang" || value === "canonicalize") {
      setMode(value);
    }
  };

  const process = (input: string) => {
    if (mode === "defang") return defangText(input);
    if (mode === "refang") return refangText(input);

    const urls = canonicalizeUrlsFromText(input);
    if (urls.length > 0) return JSON.stringify(urls);
    return JSON.stringify([canonicalizeUrl(input)]);
  };

  const renderOutput = (output: string) => {
    if (mode !== "canonicalize") {
      return (
        <pre className="h-full min-h-[300px] p-4 rounded-lg bg-background border overflow-auto text-sm font-mono whitespace-pre-wrap break-all">
          {output}
        </pre>
      );
    }
    const parsed = parseCanonicalOutput(output);
    if (!parsed) return null;

    return (
      <div className="space-y-3">
        {parsed.map((result, index) => (
          <div key={`${result.canonical}-${index}`} className="p-3 border rounded bg-muted/20 space-y-2">
            <div className="text-xs text-muted-foreground uppercase font-semibold">Canonical URL</div>
            <div className="font-mono text-sm break-all">{result.canonical}</div>
            <div className="grid sm:grid-cols-2 gap-2 text-xs">
              <div><span className="font-semibold">Host:</span> {result.host}</div>
              <div><span className="font-semibold">Scheme:</span> {result.scheme}</div>
              <div><span className="font-semibold">Path:</span> {result.path}</div>
              <div><span className="font-semibold">Port:</span> {result.port ?? "default"}</div>
            </div>
            {result.warnings.length > 0 && (
              <ul className="text-xs text-muted-foreground space-y-1">
                {result.warnings.map((warning, warningIndex) => (
                  <li key={warningIndex}>• {warning}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="URL Defang/Refang + Canonicalizer"
      description="Safely defang URLs for sharing, refang when needed, and canonicalize URLs for stable IOC comparisons."
      actionLabel={mode === "defang" ? "Defang" : mode === "refang" ? "Refang" : "Canonicalize"}
      placeholder="https://example.com/login?b=2&a=1#fragment"
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <Tabs value={mode} onValueChange={handleModeChange} className="w-[420px] max-w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="defang">Defang</TabsTrigger>
            <TabsTrigger value="refang">Refang</TabsTrigger>
            <TabsTrigger value="canonicalize">Canonicalize</TabsTrigger>
          </TabsList>
        </Tabs>
      }
      examples={[
        "https://example.com/login?b=2&a=1#frag",
        "hxxps://portal[.]example[.]com/reset-password",
        "Multiple URLs: https://a.example.com/x and https://b.example.com/y",
      ]}
    />
  );
}
