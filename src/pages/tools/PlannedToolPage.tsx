import { Navigate, useLocation } from "react-router-dom";
import { ToolTemplate } from "@/components/tools/ToolTemplate";
import { TOOLS } from "@/lib/constants/tools";

export default function PlannedToolPage() {
  const location = useLocation();
  const tool = TOOLS.find((item) => item.path === location.pathname) ?? null;

  if (!tool || tool.status !== "planned") {
    return <Navigate to="/tools" replace />;
  }

  const process = () =>
    JSON.stringify({
      status: "planned",
      tool: tool.name,
      domain: tool.domainId,
      processingMode: tool.processingMode,
      sensitivity: tool.sensitivity,
      evidenceTags: tool.evidenceTags,
      note: "Implementation is queued in the next onboarding wave.",
    });

  const renderOutput = (output: string) => (
    <pre className="min-h-[220px] p-4 rounded-lg bg-background border overflow-auto text-xs font-mono whitespace-pre-wrap break-all">
      {output}
    </pre>
  );

  return (
    <ToolTemplate
      toolName={`${tool.name} (Planned)`}
      description={`${tool.description} This tool is onboarded in the roadmap and pending implementation.`}
      actionLabel="View Planned Spec"
      placeholder="Planned tool metadata"
      initialInput=""
      requiresInput={false}
      onProcess={process}
      renderOutput={renderOutput}
    />
  );
}
