import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Star, TerminalSquare } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useFavoritesStore } from "@/store/useFavoritesStore";
import {
  TOOL_DOMAINS,
  findDomainByPath,
  findToolByPath,
  getDomainCanonicalPath,
  getDomainQueryPath,
  getToolDomainId,
  getToolsForDomain,
  isToolDomainId,
} from "@/lib/constants/tool-domains";

export function ToolDomainSidebar() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const favoriteCount = useFavoritesStore((state) => state.favorites.length);

  const selectedDomainParam = searchParams.get("domain");
  const selectedDomain = isToolDomainId(selectedDomainParam) ? selectedDomainParam : null;
  const domainFromPath = findDomainByPath(location.pathname)?.id ?? null;

  const activeTool = findToolByPath(location.pathname);
  const activeDomain = activeTool ? getToolDomainId(activeTool.id) : domainFromPath ?? selectedDomain;
  const activeDomainTools = activeDomain ? getToolsForDomain(activeDomain) : [];

  return (
    <aside className="hidden 2xl:flex flex-col rounded-2xl border border-border/60 bg-card/70 backdrop-blur-xl shadow-[0_24px_70px_-45px_hsl(var(--primary)/0.4)] sticky top-24 max-h-[calc(100vh-7.25rem)] overflow-hidden">
      <div className="p-4 border-b border-border/60 bg-gradient-to-br from-primary/12 via-transparent to-link/10 space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <TerminalSquare className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-[0.22em]">Domain Navigation</span>
        </div>
        <p className="text-sm text-muted-foreground">Navigate by domain first, then jump directly to relevant tools.</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{TOOL_DOMAINS.reduce((count, domain) => count + getToolsForDomain(domain.id).length, 0)} tools indexed</span>
          <span className="inline-flex items-center gap-1">
            <Star className="h-3.5 w-3.5" /> {favoriteCount} starred
          </span>
        </div>
      </div>

      <div className="p-3 overflow-y-auto space-y-3">
        <Link
          to="/tools"
          className={cn(
            "flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors",
            !selectedDomain && !domainFromPath && location.pathname === "/tools"
              ? "border-primary/50 bg-primary/15 text-primary"
              : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/60",
          )}
        >
          <span>All Domains</span>
          <span className="text-xs">Overview</span>
        </Link>

        {TOOL_DOMAINS.map((domain) => {
          const domainTools = getToolsForDomain(domain.id);
          const isDomainActive = activeDomain === domain.id;

          return (
            <section
              key={domain.id}
              className={cn(
                "rounded-xl border transition-colors",
                isDomainActive
                  ? "border-primary/50 bg-primary/10"
                  : "border-border/60 bg-card/40",
              )}
            >
              <Link
                to={getDomainCanonicalPath(domain.id)}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className={cn("p-1.5 rounded-md border", domain.accentClass)}>
                    <domain.icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm font-semibold truncate">{domain.name}</span>
                </span>
                <span className="text-xs text-muted-foreground">{domainTools.length}</span>
              </Link>
              <div className="px-3 pb-2">
                <Link
                  to={getDomainQueryPath(domain.id)}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Open in all-tools filter
                </Link>
              </div>
            </section>
          );
        })}

        {activeDomain && activeDomainTools.length > 0 && (
          <section className="rounded-xl border border-border/60 bg-card/40 p-2 space-y-1">
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Quick Jump
            </div>
            {activeDomainTools.map((tool) => (
              <Link
                key={tool.id}
                to={tool.path}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                  location.pathname === tool.path
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/70",
                )}
              >
                <tool.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{tool.name}</span>
              </Link>
            ))}
          </section>
        )}
      </div>
    </aside>
  );
}
