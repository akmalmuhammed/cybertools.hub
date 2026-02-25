import { useState } from "react";
import { CopyButton } from "@/components/features/CopyButton";
import { ToolTemplate } from "@/components/tools/ToolTemplate";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  extractIocs,
  flattenIocs,
  IocExtractionResult,
  IocType,
} from "@/lib/utils/ioc";

const IOC_ORDER: IocType[] = [
  "url",
  "domain",
  "email",
  "ipv4",
  "ipv6",
  "md5",
  "sha1",
  "sha256",
  "sha512",
  "cve",
];

const IOC_LABELS: Record<IocType, string> = {
  url: "URLs",
  domain: "Domains",
  email: "Emails",
  ipv4: "IPv4",
  ipv6: "IPv6",
  md5: "MD5",
  sha1: "SHA-1",
  sha256: "SHA-256",
  sha512: "SHA-512",
  cve: "CVEs",
};

function parseOutput(output: string): IocExtractionResult | null {
  try {
    return JSON.parse(output) as IocExtractionResult;
  } catch {
    return null;
  }
}

export default function IocExtractorTool() {
  const [includePrivateIps, setIncludePrivateIps] = useState(false);
  const [includeDomainsFromUrls, setIncludeDomainsFromUrls] = useState(true);
  const [includeDomainsFromEmails, setIncludeDomainsFromEmails] = useState(true);

  const process = (input: string) =>
    JSON.stringify(
      extractIocs(input, {
        includePrivateIps,
        includeDomainsFromUrls,
        includeDomainsFromEmails,
      }),
    );

  const renderOutput = (output: string) => {
    const parsed = parseOutput(output);
    if (!parsed) return null;

    if (parsed.total === 0) {
      return (
        <div className="h-full min-h-[300px] rounded-lg border border-dashed flex items-center justify-center text-muted-foreground">
          No indicators found in the input.
        </div>
      );
    }

    const flattened = flattenIocs(parsed);
    const exportText = flattened
      .map((ioc) => `${ioc.type.toUpperCase()},${ioc.value}`)
      .join("\n");

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Detected <span className="font-semibold text-foreground">{parsed.total}</span>{" "}
            indicators.
          </div>
          <CopyButton text={exportText} size="sm" variant="outline" />
        </div>

        <div className="flex flex-wrap gap-2">
          {IOC_ORDER.filter((type) => parsed.counts[type] > 0).map((type) => (
            <Badge key={type} variant="secondary" className="font-mono">
              {IOC_LABELS[type]}: {parsed.counts[type]}
            </Badge>
          ))}
        </div>

        <div className="space-y-3">
          {IOC_ORDER.filter((type) => parsed.counts[type] > 0).map((type) => {
            const values = parsed.items[type];
            const text = values.join("\n");
            return (
              <div key={type} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    {IOC_LABELS[type]} ({values.length})
                  </h3>
                  <CopyButton text={text} size="sm" variant="outline" />
                </div>
                <pre className="max-h-40 overflow-auto rounded border bg-background p-2 text-xs font-mono whitespace-pre-wrap break-all">
                  {text}
                </pre>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="IOC Extractor"
      description="Extract indicators of compromise (URLs, domains, IPs, emails, hashes, CVEs) from raw logs or incident notes."
      actionLabel="Extract IOCs"
      placeholder="Paste logs, headers, chat transcripts, or incident notes..."
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="ioc-private-ips">Include private/reserved IPs</Label>
            <Switch
              id="ioc-private-ips"
              checked={includePrivateIps}
              onChange={(event) => setIncludePrivateIps(event.target.checked)}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="ioc-domain-from-url">Derive domains from URLs</Label>
            <Switch
              id="ioc-domain-from-url"
              checked={includeDomainsFromUrls}
              onChange={(event) => setIncludeDomainsFromUrls(event.target.checked)}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="ioc-domain-from-email">Derive domains from emails</Label>
            <Switch
              id="ioc-domain-from-email"
              checked={includeDomainsFromEmails}
              onChange={(event) => setIncludeDomainsFromEmails(event.target.checked)}
            />
          </div>
        </div>
      }
      examples={[
        "https://example.com/login?token=abc\nuser@corp.com\n8.8.8.8\nCVE-2024-12345",
        "Alert: md5=d41d8cd98f00b204e9800998ecf8427e sha256=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "Received from 10.10.1.5 to 203.0.113.10, callback hxxp://evil.example[.]com",
      ]}
    />
  );
}
