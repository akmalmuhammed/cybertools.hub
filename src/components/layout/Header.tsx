import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DarkModeToggle } from "@/components/features/DarkModeToggle";
import { SearchDialog } from "@/components/features/SearchDialog";
import { useSearchStore } from "@/store/useSearchStore";
import { findToolByPath, getDomainById, getToolDomainId } from "@/lib/constants/tool-domains";

function headerTitle(pathname: string): string {
  if (pathname === "/") return "Mission Overview";
  if (pathname === "/tools") return "Tool Operations";
  if (pathname === "/about") return "About CyberTools Hub";
  return "Tool Workspace";
}

function headerDescription(pathname: string): string {
  if (pathname === "/") return "Domain-driven cybersecurity toolkit shell.";
  if (pathname === "/tools") return "Browse SOC, network, application, and utility tool stacks.";
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

  const domainLabel = useMemo(() => {
    if (!activeTool) return null;
    const domain = getDomainById(getToolDomainId(activeTool.id));
    return domain.name;
  }, [activeTool]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/78 backdrop-blur-xl">
        <div className="container h-16 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">
              {activeTool ? activeTool.name : headerTitle(location.pathname)}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {domainLabel ?? headerDescription(location.pathname)}
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
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
                <span className="text-xs">⌘</span>K
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
