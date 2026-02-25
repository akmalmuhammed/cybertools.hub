import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Star, Layers } from "lucide-react";
import { ToolCard } from "@/components/tools/ToolCard";
import { TOOLS } from "@/lib/constants/tools";
import {
  TOOL_DOMAINS,
  getDomainById,
  getToolsForDomain,
  isToolDomainId,
  type ToolDomainId,
} from "@/lib/constants/tool-domains";
import {
  getProcessingCounts,
  getSensitivityCounts,
  getToolProcessingMode,
} from "@/lib/constants/tool-trust";
import { useFavoritesStore } from "@/store/useFavoritesStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { ToolProcessingMode, ToolSensitivity } from "@/types/tool.types";

interface DomainGroup {
  domain: ReturnType<typeof getDomainById>;
  tools: typeof TOOLS;
}

export function ToolsList() {
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const [processingFilter, setProcessingFilter] = useState<"all" | ToolProcessingMode>("all");
  const [sensitivityFilter, setSensitivityFilter] = useState<"all" | ToolSensitivity>("all");
  const [searchParams, setSearchParams] = useSearchParams();
  const processingCounts = getProcessingCounts();
  const sensitivityCounts = getSensitivityCounts();
  const searchQuery = searchParams.get("q") ?? "";

  const rawDomain = searchParams.get("domain");
  const domainParam = isToolDomainId(rawDomain) ? rawDomain : null;

  const visibleGroups = useMemo(() => {
    const activeDomainIds = domainParam
      ? [domainParam]
      : TOOL_DOMAINS.map((domain) => domain.id);

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const matchesSearch = (tool: (typeof TOOLS)[number]): boolean => {
      if (!normalizedQuery) return true;
      return [tool.name, tool.description, ...tool.keywords, ...tool.evidenceTags]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    };

    return activeDomainIds
      .map((domainId) => {
        const domainTools = getToolsForDomain(domainId).filter((tool) => {
          if (filter === "favorites" && !isFavorite(tool.id)) return false;
          if (processingFilter !== "all" && getToolProcessingMode(tool.id) !== processingFilter) {
            return false;
          }
          if (sensitivityFilter !== "all" && tool.sensitivity !== sensitivityFilter) return false;
          return matchesSearch(tool);
        });

        return {
          domain: getDomainById(domainId),
          tools: domainTools,
        } satisfies DomainGroup;
      })
      .filter((group) => group.tools.length > 0);
  }, [domainParam, filter, isFavorite, processingFilter, searchQuery, sensitivityFilter]);

  const visibleCount = visibleGroups.reduce(
    (count, group) => count + group.tools.length,
    0,
  );

  const activeFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (domainParam) parts.push(`Domain: ${getDomainById(domainParam).name}`);
    if (filter === "favorites") parts.push("Favorites only");
    if (processingFilter !== "all") parts.push(`Mode: ${processingFilter}`);
    if (sensitivityFilter !== "all") parts.push(`Sensitivity: ${sensitivityFilter}`);
    if (searchQuery.trim()) parts.push(`Query: "${searchQuery.trim()}"`);
    return parts;
  }, [domainParam, filter, processingFilter, searchQuery, sensitivityFilter]);

  const setDomainFilter = (domainId: ToolDomainId | null) => {
    const next = new URLSearchParams(searchParams);
    if (domainId) next.set("domain", domainId);
    else next.delete("domain");
    setSearchParams(next);
  };

  const clearContextFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("domain");
    next.delete("q");
    setSearchParams(next);
    setProcessingFilter("all");
    setSensitivityFilter("all");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-[0.18em] text-primary font-semibold">Tool Inventory</div>
            <h2 className="text-xl sm:text-2xl font-semibold">Filter tools by domain, mode, sensitivity, and workflow</h2>
            <p className="text-sm text-muted-foreground">
              Local processing is preferred by default. Network and hybrid modes are explicitly labeled.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="px-2.5 py-1 text-xs">{visibleCount} visible</Badge>
            <Badge variant="outline" className="px-2.5 py-1 text-xs">{TOOLS.length} total</Badge>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => {
                const next = new URLSearchParams(searchParams);
                const nextQuery = event.target.value;
                if (nextQuery.trim().length > 0) next.set("q", nextQuery);
                else next.delete("q");
                setSearchParams(next, { replace: true });
              }}
              className="pl-9"
              placeholder="Search by tool name, use case, evidence tag, or keyword..."
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={filter === "all" ? "secondary" : "ghost"}
              onClick={() => setFilter("all")}
              size="sm"
              className="min-w-[92px]"
            >
              All Tools
            </Button>
            <Button
              variant={filter === "favorites" ? "secondary" : "ghost"}
              onClick={() => setFilter("favorites")}
              size="sm"
              className="min-w-[92px]"
            >
              <Star className="mr-1.5 h-3.5 w-3.5" /> Favorites
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-background/70 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-semibold">Execution Mode</span>
            <Button
              variant={processingFilter === "all" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setProcessingFilter("all")}
            >
              All
            </Button>
            <Button
              variant={processingFilter === "local" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setProcessingFilter("local")}
            >
              Local Only ({processingCounts.local})
            </Button>
            <Button
              variant={processingFilter === "hybrid" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setProcessingFilter("hybrid")}
            >
              Hybrid ({processingCounts.hybrid})
            </Button>
            <Button
              variant={processingFilter === "network" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setProcessingFilter("network")}
            >
              Network ({processingCounts.network})
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Use Local Only for sensitive workflows. Network and Hybrid tools may perform outbound lookups.
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-background/70 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-semibold">Sensitivity</span>
            <Button
              variant={sensitivityFilter === "all" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setSensitivityFilter("all")}
            >
              All
            </Button>
            <Button
              variant={sensitivityFilter === "high" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setSensitivityFilter("high")}
            >
              High ({sensitivityCounts.high})
            </Button>
            <Button
              variant={sensitivityFilter === "medium" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setSensitivityFilter("medium")}
            >
              Medium ({sensitivityCounts.medium})
            </Button>
            <Button
              variant={sensitivityFilter === "low" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setSensitivityFilter("low")}
            >
              Low ({sensitivityCounts.low})
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Sensitivity reflects likely handling of credentials, incident artifacts, or private operational context.
          </p>
        </div>

        {activeFilterSummary.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Active Filters: {activeFilterSummary.join(" | ")}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant={domainParam === null ? "secondary" : "outline"}
            size="sm"
            onClick={() => setDomainFilter(null)}
          >
            <Layers className="mr-1.5 h-3.5 w-3.5" /> All Domains
          </Button>

          {TOOL_DOMAINS.map((domain) => {
            const count = getToolsForDomain(domain.id).length;
            return (
              <Button
                key={domain.id}
                variant={domainParam === domain.id ? "secondary" : "outline"}
                size="sm"
                onClick={() => setDomainFilter(domain.id)}
                className="gap-1.5"
              >
                <domain.icon className="h-3.5 w-3.5" />
                <span>{domain.name}</span>
                <span className="text-[10px] text-muted-foreground">{count}</span>
              </Button>
            );
          })}

          {(domainParam !== null || processingFilter !== "all" || sensitivityFilter !== "all" || searchQuery.trim().length > 0) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearContextFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              Reset Filters
            </Button>
          )}
        </div>
      </div>

      {visibleGroups.map((group, groupIndex) => (
        <motion.section
          key={group.domain.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: groupIndex * 0.05 }}
          className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary/6 via-transparent to-cyan-500/7 pointer-events-none" />
          <div className="relative p-4 sm:p-5 border-b border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <span className={`p-2 rounded-lg border ${group.domain.accentClass}`}>
                <group.domain.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold text-lg truncate">{group.domain.name}</h3>
                <p className="text-sm text-muted-foreground">{group.domain.description}</p>
              </div>
            </div>
            <Badge variant="secondary" className="w-fit">
              {group.tools.length} tool{group.tools.length === 1 ? "" : "s"}
            </Badge>
          </div>

          <div className="relative p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5">
            {group.tools.map((tool, index) => (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, delay: index * 0.03 }}
                viewport={{ once: true, margin: "-40px" }}
              >
                <ToolCard
                  tool={tool}
                  isFavorite={isFavorite(tool.id)}
                  onToggleFavorite={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleFavorite(tool.id);
                  }}
                />
              </motion.div>
            ))}
          </div>
        </motion.section>
      ))}

      {visibleGroups.length === 0 && (
        <div className="rounded-2xl border border-border/60 bg-card/50 p-10 text-center text-muted-foreground">
          No tools matched this domain/filter combination.
        </div>
      )}
    </div>
  );
}

