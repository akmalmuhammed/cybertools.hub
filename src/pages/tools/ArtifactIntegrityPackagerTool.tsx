import { useState } from "react";
import { ToolTemplate } from "@/components/tools/ToolTemplate";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  buildArtifactIntegrityPackage,
  type ArtifactIntegrityPackage,
} from "@/lib/utils/artifact-integrity";

export default function ArtifactIntegrityPackagerTool() {
  const [custodyNotes, setCustodyNotes] = useState("");

  const process = (input: string) =>
    JSON.stringify(buildArtifactIntegrityPackage(input, { custodyNotes }));

  const renderOutput = (output: string) => {
    let parsed: ArtifactIntegrityPackage;
    try {
      parsed = JSON.parse(output) as ArtifactIntegrityPackage;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="p-3 border rounded bg-muted/20">
          <div className="text-xs uppercase text-muted-foreground">Package ID</div>
          <div className="text-sm font-mono break-all">{parsed.packageId}</div>
        </div>
        <div className="text-xs text-muted-foreground">
          Manifest entries: {parsed.summary.total} | with hashes: {parsed.summary.withHashes}
        </div>
        <pre className="min-h-[220px] p-4 rounded-lg bg-background border overflow-auto text-xs font-mono whitespace-pre-wrap break-all">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="Artifact Integrity Packager"
      description="Build a deterministic hash manifest and chain-of-custody package for DFIR artifact handling."
      actionLabel="Build Integrity Package"
      placeholder="memory_dump_01.raw,sha256:98ab4f...\nphishing.eml,2f0f89..."
      onProcess={process}
      renderOutput={renderOutput}
      controls={(
        <div className="space-y-1">
          <Label>Chain of custody notes (optional)</Label>
          <Textarea
            value={custodyNotes}
            onChange={(event) => setCustodyNotes(event.target.value)}
            placeholder="Collected by analyst-a at 2026-02-25T10:00:00Z"
            className="min-h-[120px] font-mono text-xs"
          />
        </div>
      )}
    />
  );
}
