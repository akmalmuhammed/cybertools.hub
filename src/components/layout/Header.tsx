import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, Search, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DarkModeToggle } from "@/components/features/DarkModeToggle";
import { cn } from "@/lib/utils/cn";
import { SearchDialog } from "@/components/features/SearchDialog";
import { useSearchStore } from "@/store/useSearchStore";
import { MobileNav } from "./MobileNav";
import { TOOL_DOMAINS } from "@/lib/constants/tool-domains";

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const location = useLocation();

  const { setIsOpen } = useSearchStore();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 12);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const openSearch = () => {
    setIsOpen(true);
  };

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 w-full border-b backdrop-blur-xl transition-all duration-300",
          isScrolled
            ? "bg-background/85 border-border/70"
            : "bg-background/55 border-border/40",
        )}
      >
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="border border-primary/35 bg-primary/10 p-2 rounded-lg group-hover:bg-primary/20 transition-colors shadow-[0_0_30px_-12px_rgba(16,185,129,0.75)]">
              <Terminal className="h-5 w-5 text-primary" />
            </div>
            <span className="font-semibold text-lg tracking-tight hidden sm:inline-block">
              CyberTools<span className="text-primary">.Hub</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            <Link
              to="/"
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/70",
                location.pathname === "/" ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Home
            </Link>

            <div className="relative group">
              <Link
                to="/tools"
                className={cn(
                  "flex items-center gap-1 px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/70",
                  location.pathname.startsWith("/tools") || location.pathname === "/hash-generator"
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Tool Domains
              </Link>

              <div className="absolute left-0 top-full pt-2 w-80 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ease-in-out z-50">
                <div className="bg-popover/95 backdrop-blur-xl border border-border rounded-xl shadow-xl overflow-hidden p-2">
                  <Link
                    to="/tools"
                    className="block px-3 py-2 rounded-md text-sm font-medium text-primary hover:bg-muted/70"
                  >
                    All Domains Dashboard
                  </Link>

                  <div className="my-2 border-t border-border/60" />

                  {TOOL_DOMAINS.map((domain) => (
                    <Link
                      key={domain.id}
                      to={`/tools?domain=${domain.id}`}
                      className="flex items-start gap-3 px-3 py-2 rounded-md hover:bg-muted/70 transition-colors"
                    >
                      <span className={cn("mt-0.5 p-1.5 rounded-md border", domain.accentClass)}>
                        <domain.icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="text-sm font-medium block leading-tight">{domain.name}</span>
                        <span className="text-xs text-muted-foreground line-clamp-2">{domain.description}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <Link
              to="/about"
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors rounded-md hover:bg-muted/70",
                location.pathname === "/about" ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              About
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex h-9 w-64 items-center justify-between px-4 text-muted-foreground hover:text-foreground bg-background/70"
              onClick={openSearch}
            >
              <span className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                <span>Search tools...</span>
              </span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>

            <Button variant="ghost" size="icon" className="sm:hidden" onClick={openSearch}>
              <Search className="h-5 w-5" />
            </Button>

            <DarkModeToggle />

            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsMobileNavOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <MobileNav isOpen={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} />
      <SearchDialog />
    </>
  );
}
