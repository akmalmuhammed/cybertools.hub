import { Link, Navigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/features/SEO";
import { ToolCard } from "@/components/tools/ToolCard";
import {
  getDomainBySlug,
  getDomainQueryPath,
  getToolsForDomain,
} from "@/lib/constants/tool-domains";

export default function DomainPage() {
  const params = useParams<{ domainSlug: string }>();
  const domain = params.domainSlug ? getDomainBySlug(params.domainSlug) : null;

  if (!domain) {
    return <Navigate to="/tools" replace />;
  }

  const tools = getToolsForDomain(domain.id);
  const localCount = tools.filter((tool) => tool.processingMode === "local").length;
  const hybridCount = tools.filter((tool) => tool.processingMode === "hybrid").length;
  const networkCount = tools.filter((tool) => tool.processingMode === "network").length;

  return (
    <div className="space-y-8">
      <SEO
        title={domain.name}
        description={`${domain.description} ${domain.privacyNotice}`}
        canonical={`/domains/${domain.slug}`}
        keywords={[
          domain.name.toLowerCase(),
          `${domain.id} tools`,
          "local-first security tools",
          "privacy-first security workflows",
        ]}
      />

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/55 backdrop-blur-xl p-6 sm:p-8"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_8%,rgba(16,185,129,0.24),transparent_45%),radial-gradient(circle_at_85%_18%,rgba(6,182,212,0.18),transparent_44%)] pointer-events-none" />
        <div className="relative space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <domain.icon className="h-3.5 w-3.5" />
            Domain Landing
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold">{domain.name}</h1>
          <p className="text-muted-foreground max-w-3xl">{domain.description}</p>
          <div className="rounded-xl border border-primary/35 bg-primary/10 px-4 py-3 text-sm text-primary">
            <span className="font-semibold">Local vs Network Handling:</span> {domain.privacyNotice}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{tools.length} tool{tools.length === 1 ? "" : "s"}</Badge>
            <Badge variant="outline">Local {localCount}</Badge>
            <Badge variant="outline">Hybrid {hybridCount}</Badge>
            <Badge variant="outline">Network {networkCount}</Badge>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to={getDomainQueryPath(domain.id)}>Open Filtered Inventory View</Link>
          </Button>
        </div>
      </motion.section>

      <section className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5">
        {tools.map((tool, index) => (
          <motion.div
            key={tool.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: index * 0.03 }}
          >
            <ToolCard tool={tool} />
          </motion.div>
        ))}
      </section>
    </div>
  );
}
