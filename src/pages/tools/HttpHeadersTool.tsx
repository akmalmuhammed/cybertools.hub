import { ToolTemplate } from "@/components/tools/ToolTemplate";
import {
  analyzeHttpSecurityHeaders,
  parseHttpHeaders,
  type HttpHeadersAnalysisResult,
} from "@/lib/utils/http-headers";

function scoreColor(score: number): string {
  if (score >= 90) return "text-green-600 dark:text-green-400";
  if (score >= 70) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export default function HttpHeadersTool() {
  const process = (input: string) => {
    const parsed = parseHttpHeaders(input);
    const analysis = analyzeHttpSecurityHeaders(parsed);
    return JSON.stringify(analysis);
  };

  const renderOutput = (output: string) => {
    if (!output) return null;

    let parsed: HttpHeadersAnalysisResult;
    try {
      parsed = JSON.parse(output) as HttpHeadersAnalysisResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="p-3 border rounded bg-muted/20">
          <div className="text-xs font-bold text-muted-foreground uppercase">Security Score</div>
          <div className={`text-2xl font-bold ${scoreColor(parsed.score)}`}>
            {parsed.score}/100 ({parsed.grade})
          </div>
        </div>

        <div className="p-3 border rounded bg-muted/20">
          <h3 className="text-sm font-semibold mb-2">Missing Critical Headers</h3>
          {parsed.missing.length === 0 ? (
            <div className="text-sm text-green-600 dark:text-green-400">No critical headers missing.</div>
          ) : (
            <ul className="text-sm text-muted-foreground space-y-1">
              {parsed.missing.map((header) => (
                <li key={header}>• {header}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Findings</h3>
          {parsed.findings.map((finding, index) => (
            <div key={`${finding.header}-${index}`} className="p-3 border rounded bg-muted/20 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{finding.header}</span>
                <span
                  className={
                    finding.status === "good"
                      ? "text-green-600 dark:text-green-400"
                      : finding.status === "warn"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400"
                  }
                >
                  {finding.status.toUpperCase()}
                </span>
              </div>
              <p className="text-muted-foreground mt-1">{finding.message}</p>
              {finding.recommendation && (
                <p className="text-xs text-muted-foreground mt-1">
                  Recommendation: {finding.recommendation}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="HTTP Security Headers Analyzer"
      description="Analyze HTTP response headers and score security posture (CSP, HSTS, XFO, XCTO, Referrer-Policy, Permissions-Policy)."
      actionLabel="Analyze Headers"
      placeholder={"HTTP/1.1 200 OK\nStrict-Transport-Security: max-age=31536000; includeSubDomains\nContent-Security-Policy: default-src 'self'"}
      onProcess={process}
      renderOutput={renderOutput}
      examples={[
        "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload\nContent-Security-Policy: default-src 'self'\nX-Frame-Options: DENY\nX-Content-Type-Options: nosniff\nReferrer-Policy: strict-origin-when-cross-origin\nPermissions-Policy: geolocation=()",
        "Server: Apache/2.4\nContent-Type: text/html",
      ]}
    />
  );
}
