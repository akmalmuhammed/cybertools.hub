import { useState, type ChangeEvent } from "react";
import { ToolTemplate } from "@/components/tools/ToolTemplate";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  runYaraLocalMatcher,
  type YaraScanResult,
} from "@/lib/utils/yara-local";

type ScanMode = "text" | "file";

export default function YaraLocalMatcherTool() {
  const [rulesInput, setRulesInput] = useState(
    [
      "rule SuspiciousKeyword {",
      "  strings:",
      "    $a = \"password=\" nocase",
      "  condition:",
      "    any of them",
      "}",
    ].join("\n"),
  );
  const [scanMode, setScanMode] = useState<ScanMode>("text");
  const [fileContent, setFileContent] = useState("");
  const [fileName, setFileName] = useState("");

  const process = async (input: string): Promise<string> => {
    const target = scanMode === "file" ? fileContent : input;
    const result = runYaraLocalMatcher(rulesInput, target);
    return JSON.stringify({ ...result, scanMode, fileName });
  };

  const renderOutput = (output: string) => {
    if (!output) return null;
    let parsed: YaraScanResult & { scanMode: ScanMode; fileName: string };
    try {
      parsed = JSON.parse(output) as YaraScanResult & { scanMode: ScanMode; fileName: string };
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase font-bold text-muted-foreground">Rules Parsed</div>
            <div className="text-xl font-semibold">{parsed.parsedRules}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase font-bold text-muted-foreground">Matched</div>
            <div className="text-xl font-semibold text-red-600 dark:text-red-400">{parsed.summary.matchedRules}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase font-bold text-muted-foreground">Unmatched</div>
            <div className="text-xl font-semibold">{parsed.summary.unmatchedRules}</div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Mode: {parsed.scanMode} {parsed.fileName ? `| File: ${parsed.fileName}` : ""}
        </div>

        {parsed.parseErrors.length > 0 && (
          <div className="p-3 border rounded bg-amber-500/10 border-amber-600/30">
            <h3 className="text-sm font-semibold mb-2">Rule Parse Notes</h3>
            <ul className="text-sm space-y-1">
              {parsed.parseErrors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          {parsed.matches.map((match) => (
            <div key={match.rule} className="p-3 border rounded bg-muted/20 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{match.rule}</div>
                <div className={match.matched ? "text-red-600 dark:text-red-400 font-semibold" : "text-green-600 dark:text-green-400 font-semibold"}>
                  {match.matched ? "MATCH" : "NO MATCH"}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">Condition: {match.condition}</div>
              <div className="text-xs text-muted-foreground">
                Matched strings: {match.matchedPatterns.length > 0 ? match.matchedPatterns.join(", ") : "none"}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setFileName("");
      setFileContent("");
      return;
    }

    setFileName(file.name);
    try {
      const text = await file.text();
      setFileContent(text);
    } catch {
      setFileContent("");
    }
  };

  return (
    <ToolTemplate
      toolName="YARA Local Matcher"
      description="Run local YARA-style pattern matching in browser against pasted text or a local file."
      actionLabel="Run YARA Match"
      placeholder="Paste text content to scan..."
      onProcess={process}
      renderOutput={renderOutput}
      controls={
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>YARA Rules</Label>
            <Textarea
              value={rulesInput}
              onChange={(event) => setRulesInput(event.target.value)}
              className="min-h-[180px] font-mono text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="yara-mode">Scan Mode</Label>
            <select
              id="yara-mode"
              className="w-full rounded border bg-background px-2 py-2 text-sm"
              value={scanMode}
              onChange={(event) => setScanMode(event.target.value as ScanMode)}
            >
              <option value="text">Text Input</option>
              <option value="file">Local File</option>
            </select>
          </div>

          {scanMode === "file" && (
            <div className="space-y-1">
              <Label htmlFor="yara-file">Local file (never uploaded)</Label>
              <input
                id="yara-file"
                type="file"
                className="w-full rounded border bg-background px-2 py-2 text-sm"
                onChange={onFileChange}
              />
              {fileName && <div className="text-xs text-muted-foreground">Loaded: {fileName}</div>}
            </div>
          )}
        </div>
      }
      examples={[
        "password=Summer2026!\napi_key=123456",
      ]}
    />
  );
}
