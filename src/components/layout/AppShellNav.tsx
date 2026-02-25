import { Link, useLocation } from "react-router-dom";
import type { ComponentType } from "react";
import {
  Home,
  Info,
  Layers,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useSearchStore } from "@/store/useSearchStore";
import {
  TOOL_DOMAINS,
  findDomainByPath,
  findToolByPath,
  getDomainQueryPath,
  getToolDomainId,
} from "@/lib/constants/tool-domains";
import type { ToolDomainId } from "@/types/tool.types";

interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  domainId?: ToolDomainId;
}

const DESKTOP_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  ...TOOL_DOMAINS.map((domain) => ({
    label: domain.name,
    href: getDomainQueryPath(domain.id),
    icon: domain.icon,
    domainId: domain.id,
  })),
  { label: "All Tools", href: "/tools", icon: Layers },
  { label: "About", href: "/about", icon: Info },
];

const SOC_ICON = TOOL_DOMAINS.find((domain) => domain.id === "soc")?.icon ?? Layers;
const INTEL_ICON = TOOL_DOMAINS.find((domain) => domain.id === "threat-intel")?.icon ?? Layers;
const NETWORK_ICON = TOOL_DOMAINS.find((domain) => domain.id === "network")?.icon ?? Layers;

const MOBILE_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "SOC", href: getDomainQueryPath("soc"), icon: SOC_ICON, domainId: "soc" },
  {
    label: "Intel",
    href: getDomainQueryPath("threat-intel"),
    icon: INTEL_ICON,
    domainId: "threat-intel",
  },
  {
    label: "Network",
    href: getDomainQueryPath("network"),
    icon: NETWORK_ICON,
    domainId: "network",
  },
  { label: "Tools", href: "/tools", icon: Layers },
];

function splitHref(href: string): { pathname: string; query: string } {
  const [pathname, rawQuery] = href.split("?");
  return {
    pathname,
    query: rawQuery ? `?${rawQuery}` : "",
  };
}

function isItemActive(
  item: NavItem,
  pathname: string,
  search: string,
  activeDomain: ToolDomainId | null,
): boolean {
  if (item.domainId && activeDomain === item.domainId) {
    return true;
  }

  const { pathname: itemPathname, query } = splitHref(item.href);
  if (pathname !== itemPathname) return false;
  if (!query) return true;
  return search === query;
}

export function AppShellNav() {
  const location = useLocation();
  const { setIsOpen } = useSearchStore();

  const activeTool = findToolByPath(location.pathname);
  const activeDomainFromPath = findDomainByPath(location.pathname)?.id ?? null;
  const activeDomain = activeTool ? getToolDomainId(activeTool.id) : activeDomainFromPath;

  return (
    <>
      <aside className="hidden lg:flex fixed left-0 top-0 z-50 h-screen w-20 border-r border-border/70 bg-background/92 backdrop-blur-xl flex-col items-center py-4">
        <Link
          to="/"
          className="h-10 w-10 rounded-xl border border-primary/35 bg-primary/10 text-primary flex items-center justify-center shadow-[0_0_32px_-12px_rgba(16,185,129,0.9)]"
          title="CyberTools Hub"
          aria-label="CyberTools Hub"
        >
          <Layers className="h-5 w-5" />
        </Link>

        <nav className="mt-5 flex-1 flex flex-col items-center gap-2">
          {DESKTOP_ITEMS.map((item) => {
            const active = isItemActive(item, location.pathname, location.search, activeDomain);
            return (
              <Link
                key={item.href}
                to={item.href}
                title={item.label}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "h-11 w-11 rounded-xl flex items-center justify-center border transition-colors",
                  active
                    ? "border-primary/55 bg-primary/18 text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/70",
                )}
              >
                <item.icon className="h-5 w-5" />
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col items-center gap-2 mt-auto">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            title="Search tools"
            aria-label="Search tools"
            className="h-11 w-11 rounded-xl flex items-center justify-center border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>
      </aside>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border/70 bg-background/94 backdrop-blur-xl pb-[max(0.35rem,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-5">
          {MOBILE_ITEMS.map((item) => {
            const active = isItemActive(item, location.pathname, location.search, activeDomain);
            return (
              <Link
                key={item.href}
                to={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-1 pt-2 pb-1.5 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center",
                    active ? "bg-primary/18" : "",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
