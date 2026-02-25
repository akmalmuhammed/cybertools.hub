import { ToolTemplate } from "@/components/tools/ToolTemplate";
import {
  minimizeScopesAndLintPolicy,
  type OAuthOidcLinterResult,
} from "@/lib/utils/oauth-oidc-scope";

export default function OAuthOidcLinterTool() {
  const process = (input: string) => JSON.stringify(minimizeScopesAndLintPolicy(input));

  const renderOutput = (output: string) => {
    let parsed: OAuthOidcLinterResult;
    try {
      parsed = JSON.parse(output) as OAuthOidcLinterResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="p-3 border rounded bg-muted/20">
          <div className="text-xs uppercase text-muted-foreground">Requested Scopes</div>
          <div className="text-sm">{parsed.requestedScopes.join(", ") || "-"}</div>
        </div>
        <div className="p-3 border rounded bg-muted/20">
          <div className="text-xs uppercase text-muted-foreground">Recommended Scopes</div>
          <div className="text-sm">{parsed.recommendedScopes.join(", ") || "-"}</div>
        </div>
        {parsed.excessScopes.length > 0 && (
          <div className="p-3 border rounded bg-amber-500/10 border-amber-600/30">
            <div className="text-xs uppercase mb-1">Excess Scopes</div>
            <div className="text-sm">{parsed.excessScopes.join(", ")}</div>
          </div>
        )}
        <div className="space-y-2">
          {parsed.findings.map((finding, index) => (
            <div key={`${finding.issue}:${index}`} className="p-3 border rounded bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{finding.issue}</div>
                <div className="text-xs uppercase">{finding.severity}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{finding.recommendation}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="OAuth/OIDC Scope Minimizer & Policy Linter"
      description="Reduce excess scopes and lint token policy controls for least-privilege identity posture."
      actionLabel="Lint OAuth/OIDC Policy"
      placeholder={`{
  "requestedScopes": ["openid", "profile", "email", "admin", "offline_access"],
  "usedClaims": ["sub", "email"],
  "tokenPolicy": {
    "accessTokenTtlMinutes": 120,
    "refreshTokenDays": 90,
    "pkceRequired": false
  }
}`}
      onProcess={process}
      renderOutput={renderOutput}
    />
  );
}
