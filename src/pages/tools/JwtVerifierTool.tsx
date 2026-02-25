import { useState } from "react";
import { ToolTemplate } from "@/components/tools/ToolTemplate";
import {
  verifyJwsSignature,
  type JwtKeySource,
  type SupportedJwtAlgorithm,
  type VerifyJwsResult,
} from "@/lib/utils/jwt-verify";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

type KeyMode = JwtKeySource["kind"];

const SUPPORTED_ALGS: SupportedJwtAlgorithm[] = [
  "HS256",
  "HS384",
  "HS512",
  "RS256",
  "RS384",
  "RS512",
  "PS256",
  "PS384",
  "PS512",
];

export default function JwtVerifierTool() {
  const [keyMode, setKeyMode] = useState<KeyMode>("secret");
  const [keyInput, setKeyInput] = useState("");
  const [expectedAlg, setExpectedAlg] = useState<string>("");
  const [expectedIssuer, setExpectedIssuer] = useState("");
  const [expectedAudience, setExpectedAudience] = useState("");
  const [expectedSubject, setExpectedSubject] = useState("");
  const [validateTimeClaims, setValidateTimeClaims] = useState(true);
  const [clockSkewSec, setClockSkewSec] = useState("60");
  const [timeoutMs, setTimeoutMs] = useState("8000");

  const handleKeyModeChange = (value: string) => {
    if (value === "secret" || value === "pem" || value === "jwk" || value === "jwks-url") {
      setKeyMode(value);
    }
  };

  const process = async (input: string) => {
    if (!keyInput.trim()) throw new Error("Verification key input is required.");

    const keySource: JwtKeySource =
      keyMode === "secret"
        ? { kind: "secret", secret: keyInput }
        : keyMode === "pem"
          ? { kind: "pem", pem: keyInput }
          : keyMode === "jwk"
            ? { kind: "jwk", jwk: keyInput }
            : { kind: "jwks-url", url: keyInput.trim() };

    const normalizedExpectedAlg = expectedAlg.trim().toUpperCase();
    const expectedAlgorithm = SUPPORTED_ALGS.includes(normalizedExpectedAlg as SupportedJwtAlgorithm)
      ? (normalizedExpectedAlg as SupportedJwtAlgorithm)
      : undefined;

    const result = await verifyJwsSignature(input, {
      keySource,
      expectedAlgorithm,
      expectedIssuer: expectedIssuer.trim() || undefined,
      expectedAudience: expectedAudience.trim() || undefined,
      expectedSubject: expectedSubject.trim() || undefined,
      validateTimeClaims,
      clockSkewSec: Number(clockSkewSec) || 0,
      timeoutMs: Number(timeoutMs) || 8000,
    });
    return JSON.stringify(result);
  };

  const renderOutput = (output: string) => {
    if (!output) return null;
    let parsed: VerifyJwsResult;
    try {
      parsed = JSON.parse(output) as VerifyJwsResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="p-3 border rounded bg-muted/20">
          <div className="text-xs font-bold text-muted-foreground uppercase">Verification Status</div>
          <div
            className={
              parsed.valid
                ? "text-green-600 dark:text-green-400 font-semibold"
                : "text-red-600 dark:text-red-400 font-semibold"
            }
          >
            {parsed.valid ? "Token Accepted" : "Token Rejected"}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Algorithm: {parsed.algorithm ?? "Unknown"} | Key Source: {parsed.keySource}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Signature: {parsed.signatureVerified ? "valid" : "invalid"} | Claims: {parsed.claimsValid ? "valid" : "invalid"}
          </div>
          {parsed.reason && <div className="text-sm text-muted-foreground mt-1">{parsed.reason}</div>}
          {parsed.claimErrors.length > 0 && (
            <ul className="text-xs text-muted-foreground mt-2 space-y-1">
              {parsed.claimErrors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">JWT Header</h3>
          <pre className="p-3 rounded border bg-muted/20 text-xs font-mono overflow-auto">
            {JSON.stringify(parsed.header, null, 2)}
          </pre>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">JWT Payload</h3>
          <pre className="p-3 rounded border bg-muted/20 text-xs font-mono overflow-auto">
            {JSON.stringify(parsed.payload, null, 2)}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="JWT/JWS Signature Verifier"
      description="Verify JWT/JWS signatures and optionally validate registered claims (exp/nbf/iss/aud/sub). JWKS mode performs outbound network requests."
      actionLabel="Verify Signature"
      placeholder="eyJhbGciOi..."
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Key Source</Label>
            <Tabs value={keyMode} onValueChange={handleKeyModeChange} className="w-full">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="secret">Secret</TabsTrigger>
                <TabsTrigger value="pem">PEM</TabsTrigger>
                <TabsTrigger value="jwk">JWK</TabsTrigger>
                <TabsTrigger value="jwks-url">JWKS URL</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-1">
            <Label>{keyMode === "jwks-url" ? "JWKS URL" : "Verification Key"}</Label>
            {keyMode === "jwks-url" ? (
              <Input
                value={keyInput}
                onChange={(event) => setKeyInput(event.target.value)}
                placeholder="https://issuer.example/.well-known/jwks.json"
              />
            ) : (
              <Textarea
                value={keyInput}
                onChange={(event) => setKeyInput(event.target.value)}
                className="min-h-[100px] font-mono text-xs"
                placeholder={
                  keyMode === "secret"
                    ? "shared-secret"
                    : keyMode === "pem"
                      ? "-----BEGIN PUBLIC KEY-----..."
                      : '{"kty":"RSA","n":"...","e":"AQAB"}'
                }
              />
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Expected Algorithm (optional)</Label>
              <Input
                value={expectedAlg}
                onChange={(event) => setExpectedAlg(event.target.value)}
                placeholder="HS256 / RS256 / PS256..."
              />
            </div>
            <div className="space-y-1">
              <Label>Timeout (ms)</Label>
              <Input
                value={timeoutMs}
                onChange={(event) => setTimeoutMs(event.target.value)}
                placeholder="8000"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Expected Issuer (iss)</Label>
              <Input
                value={expectedIssuer}
                onChange={(event) => setExpectedIssuer(event.target.value)}
                placeholder="https://issuer.example"
              />
            </div>
            <div className="space-y-1">
              <Label>Expected Audience (aud)</Label>
              <Input
                value={expectedAudience}
                onChange={(event) => setExpectedAudience(event.target.value)}
                placeholder="api://my-service"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Expected Subject (sub)</Label>
              <Input
                value={expectedSubject}
                onChange={(event) => setExpectedSubject(event.target.value)}
                placeholder="user-123"
              />
            </div>
            <div className="space-y-1">
              <Label>Clock Skew (sec)</Label>
              <Input
                value={clockSkewSec}
                onChange={(event) => setClockSkewSec(event.target.value)}
                placeholder="60"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="jwt-validate-time-claims">Validate exp/nbf time claims</Label>
            <Switch
              id="jwt-validate-time-claims"
              checked={validateTimeClaims}
              onChange={(event) => setValidateTimeClaims(event.target.checked)}
            />
          </div>
        </div>
      }
      examples={[
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "Bearer eyJraWQiOiJrZXkxIiwiYWxnIjoiUlMyNTYifQ...",
      ]}
    />
  );
}
