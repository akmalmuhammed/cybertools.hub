import { ToolTemplate } from "@/components/tools/ToolTemplate";
import { parseUserAgent, UserAgentParseResult } from "@/lib/utils/user-agent";

function riskColor(level: UserAgentParseResult["risk"]["level"]): string {
  if (level === "high") return "text-red-600 dark:text-red-400";
  if (level === "medium") return "text-amber-600 dark:text-amber-400";
  return "text-green-600 dark:text-green-400";
}

export default function UserAgentTool() {
  const process = (input: string) => JSON.stringify(parseUserAgent(input));

  const renderOutput = (output: string) => {
    if (!output) return null;

    let parsed: UserAgentParseResult;
    try {
      parsed = JSON.parse(output) as UserAgentParseResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="grid gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <span className="block text-xs font-bold text-muted-foreground uppercase">
              Browser
            </span>
            <span>
              {parsed.browser.name}
              {parsed.browser.version ? ` ${parsed.browser.version}` : ""}
            </span>
            {parsed.browser.engine && (
              <p className="text-xs text-muted-foreground mt-1">
                Engine: {parsed.browser.engine}
              </p>
            )}
          </div>

          <div className="p-3 border rounded bg-muted/20">
            <span className="block text-xs font-bold text-muted-foreground uppercase">
              Operating System
            </span>
            <span>
              {parsed.os.name}
              {parsed.os.version ? ` ${parsed.os.version}` : ""}
            </span>
          </div>

          <div className="p-3 border rounded bg-muted/20">
            <span className="block text-xs font-bold text-muted-foreground uppercase">
              Device
            </span>
            <span className="capitalize">{parsed.device.type}</span>
            {(parsed.device.vendor || parsed.device.model) && (
              <p className="text-xs text-muted-foreground mt-1">
                {parsed.device.vendor || "Unknown Vendor"}
                {parsed.device.model ? ` / ${parsed.device.model}` : ""}
              </p>
            )}
          </div>

          <div className="p-3 border rounded bg-muted/20">
            <span className="block text-xs font-bold text-muted-foreground uppercase">
              Risk
            </span>
            <span className={`font-semibold uppercase ${riskColor(parsed.risk.level)}`}>
              {parsed.risk.level} ({parsed.risk.score}/100)
            </span>
          </div>
        </div>

        <div className="p-3 border rounded bg-muted/20">
          <h3 className="text-sm font-semibold mb-2">Classification</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Bot: {parsed.classification.isBot ? "Yes" : "No"}</div>
            <div>Automated: {parsed.classification.isAutomated ? "Yes" : "No"}</div>
            <div>Headless: {parsed.classification.isHeadless ? "Yes" : "No"}</div>
            <div>Desktop: {parsed.classification.isDesktop ? "Yes" : "No"}</div>
            <div>Mobile: {parsed.classification.isMobile ? "Yes" : "No"}</div>
            <div>Tablet: {parsed.classification.isTablet ? "Yes" : "No"}</div>
          </div>
        </div>

        {parsed.risk.signals.length > 0 && (
          <div className="p-3 border rounded bg-muted/20">
            <h3 className="text-sm font-semibold mb-2">Risk Signals</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              {parsed.risk.signals.map((signal, idx) => (
                <li key={idx}>• {signal}</li>
              ))}
            </ul>
          </div>
        )}

        {parsed.notes.length > 0 && (
          <div className="p-3 border rounded bg-muted/20">
            <h3 className="text-sm font-semibold mb-2">Notes</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              {parsed.notes.map((note, idx) => (
                <li key={idx}>• {note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="User-Agent Analyzer"
      description="Parse User-Agent strings into browser, OS, and device context with automation and risk signals."
      actionLabel="Analyze"
      placeholder="Mozilla/5.0 (...)"
      onProcess={process}
      renderOutput={renderOutput}
      examples={[
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/121.0.6167.85 Safari/537.36",
      ]}
    />
  );
}
