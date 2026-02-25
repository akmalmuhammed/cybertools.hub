import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { getDomainById, getToolDomainId } from "@/lib/constants/tool-domains";
import {
  getProcessingDescription,
  getProcessingLabel,
  getToolProcessingMode,
} from "@/lib/constants/tool-trust";
import { Globe, Monitor, ShieldCheck } from "lucide-react";

interface ToolTrustBadgesProps {
  toolId: string;
  compact?: boolean;
}

function modeVisual(mode: ReturnType<typeof getToolProcessingMode>): {
  className: string;
  icon: typeof ShieldCheck;
} {
  if (mode === "network") {
    return {
      className: "border-amber-500/35 bg-amber-500/12 text-amber-600 dark:text-amber-300",
      icon: Globe,
    };
  }
  if (mode === "hybrid") {
    return {
      className: "border-sky-500/35 bg-sky-500/12 text-sky-600 dark:text-sky-300",
      icon: Monitor,
    };
  }
  return {
    className: "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    icon: ShieldCheck,
  };
}

export function ToolTrustBadges({ toolId, compact = false }: ToolTrustBadgesProps) {
  const domain = getDomainById(getToolDomainId(toolId));
  const processingMode = getToolProcessingMode(toolId);
  const processing = modeVisual(processingMode);
  const ProcessingIcon = processing.icon;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", compact && "gap-1.5")}>
      <Badge variant="outline" className="border-primary/35 bg-primary/10 text-primary">
        {domain.name}
      </Badge>
      <Badge variant="outline" className={processing.className}>
        <ProcessingIcon className="h-3.5 w-3.5 mr-1" />
        {getProcessingLabel(processingMode)}
      </Badge>
      {!compact && (
        <span className="text-xs text-muted-foreground">{getProcessingDescription(processingMode)}</span>
      )}
    </div>
  );
}
