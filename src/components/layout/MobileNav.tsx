import { Link, useLocation } from "react-router-dom";
import { Github, Home, Info, Layers, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { cn } from "@/lib/utils/cn";
import { TOOL_DOMAINS } from "@/lib/constants/tool-domains";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

function linkActive(pathname: string, search: string, href: string): boolean {
  const [hrefPath, hrefQuery] = href.split("?");
  if (pathname !== hrefPath) return false;
  if (!hrefQuery) return true;
  return search === `?${hrefQuery}`;
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const location = useLocation();

  useEffect(() => {
    onClose();
  }, [location.pathname, location.search, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isOpen]);

  const coreItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "All Domains", href: "/tools", icon: Layers },
    { label: "About", href: "/about", icon: Info },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm"
          />

          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 290 }}
            className="fixed right-0 top-0 z-50 h-full w-[320px] border-l border-border bg-background/95 backdrop-blur-xl p-5 shadow-[0_0_80px_-30px_rgba(16,185,129,0.75)]"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">Navigation</div>
                <div className="text-lg font-semibold">Secutil Shell</div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
                <span className="sr-only">Close menu</span>
              </Button>
            </div>

            <nav className="space-y-4 overflow-y-auto h-[calc(100%-6rem)] pb-6">
              <div className="space-y-2">
                {coreItems.map((item, index) => (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.06 }}
                  >
                    <Link
                      to={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors",
                        linkActive(location.pathname, location.search, item.href)
                          ? "bg-primary/15 text-primary"
                          : "hover:bg-muted/70 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  </motion.div>
                ))}
              </div>

              <div className="pt-2 border-t border-border/60 space-y-2">
                <div className="px-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">Domains</div>
                {TOOL_DOMAINS.map((domain, index) => (
                  <motion.div
                    key={domain.id}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.18 + index * 0.06 }}
                  >
                    <Link
                      to={`/domains/${domain.slug}`}
                      className={cn(
                        "flex items-start gap-3 px-3 py-2.5 rounded-md transition-colors",
                        linkActive(location.pathname, location.search, `/domains/${domain.slug}`)
                          ? "bg-primary/15 text-primary"
                          : "hover:bg-muted/70 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span className={cn("p-1.5 rounded-md border", domain.accentClass)}>
                        <domain.icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="font-medium text-sm block">{domain.name}</span>
                        <span className="text-xs text-muted-foreground line-clamp-2">{domain.description}</span>
                      </span>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </nav>

            <div className="absolute bottom-4 left-5 right-5 border-t border-border/60 pt-4 flex justify-center">
              <a
                href="https://github.com/akmalmuhammed/cybertools.hub"
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="h-5 w-5" />
              </a>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
