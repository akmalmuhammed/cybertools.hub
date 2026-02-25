import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ToolsList } from "@/components/tools/ToolsList";
import { SEO } from "@/components/features/SEO";
import {
  TOOL_DOMAINS,
  getDomainCanonicalPath,
  getDomainCounts,
} from "@/lib/constants/tool-domains";
import { TOOLS } from "@/lib/constants/tools";

export default function ToolsPage() {
  const counts = getDomainCounts();
  const inventoryStructuredData = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Secutil Security Tool Inventory",
      description:
        "Domain-indexed security tool inventory covering SOC, threat intel, network, application, cloud IAM, supply chain, and data privacy workflows.",
      url: "/tools",
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Secutil Tool Inventory",
      itemListElement: TOOLS.map((tool, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: tool.name,
        url: tool.path,
        description: tool.description,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Can I filter tools by processing mode?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. The tools inventory supports local, hybrid, and network mode filters to match privacy requirements.",
          },
        },
        {
          "@type": "Question",
          name: "Are all listed tools available now?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The catalog includes ready, beta, new, and planned tools. Planned tools include structured specs and domain alignment before implementation.",
          },
        },
      ],
    },
  ];

  return (
    <div className="space-y-8">
      <SEO
        title="Security Tool Domains"
        description="Browse cybersecurity tools across SOC, threat intel, network, application, cloud IAM, supply chain, and privacy domains."
        canonical="/tools"
        keywords={[
          "cybersecurity tools",
          "soc tools",
          "threat intel tools",
          "cloud iam tools",
          "supply chain security",
          "privacy engineering tools",
        ]}
        breadcrumbItems={[
          { name: "Home", url: "/" },
          { name: "Tools", url: "/tools" },
        ]}
        structuredData={inventoryStructuredData}
      />
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/55 backdrop-blur-xl p-6 sm:p-8"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(16,185,129,0.24),transparent_42%),radial-gradient(circle_at_78%_18%,rgba(6,182,212,0.2),transparent_40%)] pointer-events-none" />

        <div className="relative space-y-5">
          <div className="inline-flex items-center rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Operations Domain Index
          </div>

          <div className="max-w-3xl space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
              Tool Navigation by Security Domain
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg">
              Domain landing pages provide focus, privacy mode guidance, and direct access to tool packs aligned to real security team pain points.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {TOOL_DOMAINS.map((domain) => {
              const count = counts[domain.id];
              return (
                <Link
                  key={domain.id}
                  to={getDomainCanonicalPath(domain.id)}
                  className="rounded-xl border border-border/60 bg-background/45 px-4 py-3 backdrop-blur-sm hover:border-primary/45 transition-colors"
                >
                  <div className="flex flex-col items-start gap-2">
                    <span className="inline-flex rounded-md border border-primary/30 bg-primary/10 p-2 text-primary">
                      <domain.icon className="h-4 w-4 shrink-0" />
                    </span>
                    <span className="text-sm font-semibold leading-tight">{domain.name}</span>
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{count}</div>
                  <div className="text-xs text-muted-foreground">tool{count === 1 ? "" : "s"}</div>
                </Link>
              );
            })}
          </div>
        </div>
      </motion.section>

      <ToolsList />
    </div>
  );
}
