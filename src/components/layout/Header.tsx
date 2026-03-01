import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DarkModeToggle } from "@/components/features/DarkModeToggle";
import { SearchDialog } from "@/components/features/SearchDialog";
import { useSearchStore } from "@/store/useSearchStore";
import {
  findDomainByPath,
  findToolByPath,
  getDomainById,
  getToolDomainId,
} from "@/lib/constants/tool-domains";
import {
  getProcessingDescription,
  getProcessingLabel,
  getToolProcessingMode,
} from "@/lib/constants/tool-trust";

function headerTitle(pathname: string): string {
  if (pathname === "/") return "Mission Overview";
  if (pathname === "/tools") return "Tool Operations";
  if (pathname.startsWith("/domains/")) return "Domain Workspace";
  if (pathname === "/about") return "About Secutil";
  return "Tool Workspace";
}

function headerDescription(pathname: string): string {
  if (pathname === "/") return "Domain-driven cybersecurity toolkit shell.";
  if (pathname === "/tools") return "Browse SOC, threat intel, network, appsec, cloud IAM, supply chain, OSINT, pentest, AI/LLM, and privacy stacks.";
  if (pathname.startsWith("/domains/")) return "Operational domain landing page with privacy mode guidance.";
  if (pathname === "/about") return "Privacy-first platform context and methodology.";
  return "Run local-first security analysis workflows.";
}

export function Header() {
  const location = useLocation();
  const { setIsOpen } = useSearchStore();

  const activeTool = useMemo(
    () => findToolByPath(location.pathname),
    [location.pathname],
  );
  const activeDomainFromPath = useMemo(
    () => findDomainByPath(location.pathname),
    [location.pathname],
  );

  const domainLabel = useMemo(() => {
    if (!activeTool) return null;
    const domain = getDomainById(getToolDomainId(activeTool.id));
    return domain.name;
  }, [activeTool]);
  const routeDomainLabel = activeDomainFromPath?.name ?? null;

  const processingMode = useMemo(
    () => (activeTool ? getToolProcessingMode(activeTool.id) : null),
    [activeTool],
  );

  const processingLabel = processingMode ? getProcessingLabel(processingMode) : null;
  const processingDescription = processingMode ? getProcessingDescription(processingMode) : null;
  const shortcutText =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
      ? "Cmd+K"
      : "Ctrl+K";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/78 backdrop-blur-xl">
        <div className="container h-16 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">
              {activeTool ? activeTool.name : headerTitle(location.pathname)}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {domainLabel ? (
                <Badge variant="outline" className="text-[11px] h-5">
                  {domainLabel}
                </Badge>
              ) : routeDomainLabel ? (
                <Badge variant="outline" className="text-[11px] h-5">
                  {routeDomainLabel}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground truncate">
                  {headerDescription(location.pathname)}
                </span>
              )}
              {processingLabel && (
                <Badge
                  variant="outline"
                  title={processingDescription ?? undefined}
                  className="text-[11px] h-5"
                >
                  {processingLabel}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex h-9 w-64 items-center justify-between px-4 text-muted-foreground hover:text-foreground bg-background/70"
              onClick={() => setIsOpen(true)}
            >
              <span className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                <span>Search tools...</span>
              </span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[11px] font-medium opacity-100">
                {shortcutText}
              </kbd>
            </Button>

            <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setIsOpen(true)}>
              <Search className="h-5 w-5" />
            </Button>

            <DarkModeToggle />
          </div>
        </div>
      </header>

      <SearchDialog />
    </>
  );
}
