import { ToolTemplate } from "@/components/tools/ToolTemplate";
import {
  normalizeAndCanonicalizeIocs,
  type IocNormalizationResult,
} from "@/lib/utils/ioc-normalizer";

function typeBadgeColor(type: string): string {
  if (type === "url") return "text-blue-600 dark:text-blue-400";
  if (type === "domain") return "text-purple-600 dark:text-purple-400";
  if (type === "email") return "text-amber-600 dark:text-amber-400";
  if (type === "ipv4" || type === "ipv6") return "text-green-600 dark:text-green-400";
  return "text-muted-foreground";
}

export default function IocNormalizerTool() {
  const process = (input: string) => JSON.stringify(normalizeAndCanonicalizeIocs(input));

  const renderOutput = (output: string) => {
    if (!output) return null;
    let parsed: IocNormalizationResult;
    try {
      parsed = JSON.parse(output) as IocNormalizationResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold uppercase text-muted-foreground">Input Tokens</div>
            <div className="text-xl font-semibold">{parsed.summary.inputTokens}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold uppercase text-muted-foreground">Normalized</div>
            <div className="text-xl font-semibold">{parsed.summary.normalized}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs font-bold uppercase text-muted-foreground">Deduplicated</div>
            <div className="text-xl font-semibold">{parsed.summary.deduplicated}</div>
          </div>
        </div>

        <div className="space-y-2">
          {parsed.entries.map((entry) => (
            <div key={`${entry.type}:${entry.canonical}`} className="p-3 border rounded bg-muted/20 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs uppercase font-semibold ${typeBadgeColor(entry.type)}`}>{entry.type}</span>
                <span className="text-xs text-muted-foreground">Raw variants: {entry.originals.length}</span>
              </div>
              <div className="text-xs text-muted-foreground">Canonical</div>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">{entry.canonical}</pre>
              <div className="text-xs text-muted-foreground">Defanged</div>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">{entry.defanged}</pre>
              <div className="text-xs text-muted-foreground">Observed forms</div>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">{entry.originals.join("\n")}</pre>
            </div>
          ))}
        </div>

        {parsed.notes.length > 0 && (
          <div className="p-3 border rounded bg-muted/20">
            <h3 className="text-sm font-semibold mb-2">Notes</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              {parsed.notes.map((note, index) => (
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
      toolName="Defanged IOC Normalizer + Canonicalizer"
      description="Refang defanged indicators, normalize unicode/punycode domains, and deduplicate by canonical IOC values."
      actionLabel="Normalize IOCs"
      placeholder="hxxps://login[.]example[.]com\nаррӏе.com\nxn--80ak6aa92e.com"
      onProcess={process}
      renderOutput={renderOutput}
      examples={[
        "hxxps://example[.]com/path\nhttp://EXAMPLE.com/path#frag\nexample(.)com",
        "support[@]paypaI[.]com\nраураl.com\nxn--80ak6aa92e.com",
      ]}
    />
  );
}
