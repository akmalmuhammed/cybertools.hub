import { ToolTemplate } from "@/components/tools/ToolTemplate";
import {
  explainTlsRisk,
  type TlsRiskResult,
} from "@/lib/utils/tls-risk";

export default function TlsRiskExplainerTool() {
  const process = (input: string) => JSON.stringify(explainTlsRisk(input));

  const renderOutput = (output: string) => {
    let parsed: TlsRiskResult;
    try {
      parsed = JSON.parse(output) as TlsRiskResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">TLS Score</div>
            <div className="text-2xl font-semibold">{parsed.score}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Grade</div>
            <div className="text-2xl font-semibold">{parsed.grade}</div>
          </div>
        </div>

        <div className="space-y-2">
          {parsed.findings.map((finding) => (
            <div key={`${finding.issue}:${finding.severity}`} className="p-3 border rounded bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{finding.issue}</div>
                <div className="text-xs uppercase">{finding.severity}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{finding.evidence}</div>
              <div className="text-xs text-muted-foreground">{finding.recommendation}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="TLS Configuration Risk Explainer"
      description="Interpret TLS scan output and explain protocol, cipher, and certificate risk with practical remediation guidance."
      actionLabel="Explain TLS Risk"
      placeholder="Protocols: TLS1.0,TLS1.2\nCiphers: TLS_RSA_WITH_3DES_EDE_CBC_SHA\nexpires: 2026-03-01T00:00:00Z\nselfSigned: false"
      onProcess={process}
      renderOutput={renderOutput}
    />
  );
}
