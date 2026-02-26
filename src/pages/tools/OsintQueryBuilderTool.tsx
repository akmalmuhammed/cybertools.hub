import { ToolTemplate } from "@/components/tools/ToolTemplate";
import { buildOsintQueries, type OsintQueryBuildResult } from "@/lib/utils/osint-query-builder";

function typeColor(type: string): string {
  if (type === "email") return "text-amber-600 dark:text-amber-400";
  if (type === "ip") return "text-sky-600 dark:text-sky-300";
  if (type === "domain") return "text-indigo-600 dark:text-indigo-300";
  if (type === "username") return "text-emerald-600 dark:text-emerald-300";
  if (type === "url") return "text-purple-600 dark:text-purple-300";
  return "text-muted-foreground";
}

export default function OsintQueryBuilderTool() {
  const process = (input: string) => {
    const result = buildOsintQueries(input);
    return JSON.stringify(result);
  };

  const renderOutput = (output: string) => {
    if (!output) return null;
    let parsed: OsintQueryBuildResult;
    try {
      parsed = JSON.parse(output) as OsintQueryBuildResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase font-bold text-muted-foreground">Indicators</div>
            <div className="text-xl font-semibold">{parsed.summary.total}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase font-bold text-muted-foreground">Domains + URLs</div>
            <div className="text-xl font-semibold">{parsed.summary.domain + parsed.summary.url}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase font-bold text-muted-foreground">Identity Signals</div>
            <div className="text-xl font-semibold">{parsed.summary.email + parsed.summary.username}</div>
          </div>
        </div>

        <div className="space-y-3">
          {parsed.items.map((item) => (
            <div key={`${item.type}-${item.indicator}`} className="rounded-lg border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-sm break-all">{item.indicator}</div>
                <div className={`text-xs uppercase font-semibold ${typeColor(item.type)}`}>{item.type}</div>
              </div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {item.queries.map((query) => (
                  <li key={query} className="font-mono break-all">- {query}</li>
                ))}
              </ul>
              {item.notes.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {item.notes.join(" ")}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="OSINT Query Builder"
      description="Generate platform-ready OSINT query pivots for domains, emails, usernames, URLs, and IP indicators."
      actionLabel="Build Query Pivots"
      placeholder="example.com&#10;security@example.com&#10;@researcher_handle&#10;https://example.com/login&#10;8.8.8.8"
      onProcess={process}
      renderOutput={renderOutput}
      examples={[
        "example.com\n@threatresearch\nsecurity@example.org",
        "198.51.100.24\nhttps://malicious.example/path",
      ]}
    />
  );
}

