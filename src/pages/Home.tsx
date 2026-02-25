import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Eye,
  Lock,
  Network,
  Search,
  Shield,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/features/SEO";
import { TOOLS } from "@/lib/constants/tools";
import {
  TOOL_DOMAINS,
  getDomainCanonicalPath,
  getToolsForDomain,
} from "@/lib/constants/tool-domains";

const MARQUEE_TOOL_IDS = [
  "cve-prioritizer",
  "secrets-scanner",
  "jwt-verify",
  "domain-spoof",
  "dns-toolkit",
  "ioc",
  "stix-taxii",
  "firewall-acl-analyzer",
  "openapi-authz-gap",
  "iam-policy-analyzer",
];

const PRIVACY_CHECKPOINTS = [
  "Open Browser DevTools and switch to the Network tab.",
  "Run a local-mode tool such as JSON Formatter, Hash Generator, or IOC Extractor.",
  "Confirm no outbound requests appear while processing local-only inputs.",
  "Use a network or hybrid tool and confirm outbound calls only occur with explicit action.",
];

export default function Home() {
  const marqueeTools = MARQUEE_TOOL_IDS
    .map((toolId) => TOOLS.find((tool) => tool.id === toolId))
    .filter((tool): tool is (typeof TOOLS)[number] => tool !== undefined);

  return (
    <div className="space-y-16 md:space-y-20">
      <SEO
        title="Cybersecurity SaaS Platform"
        description="Production-grade, local-first cybersecurity SaaS utilities with explicit network controls, domain-based workflows, and analyst-focused operations tooling."
        canonical="/"
        keywords={[
          "cybersecurity saas",
          "local first security tools",
          "soc workflow tools",
          "privacy first cybersecurity platform",
          "threat intel utility platform",
          "application security utilities",
          "cloud iam security tooling",
        ]}
        breadcrumbItems={[{ name: "Home", url: "/" }]}
        structuredData={[
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Secutil",
            url: "/",
            potentialAction: {
              "@type": "SearchAction",
              target: "/tools?q={search_term_string}",
              "query-input": "required name=search_term_string",
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Secutil",
            description:
              "Local-first cybersecurity tools for SOC, threat intel, network, application, cloud IAM, supply chain, and privacy workflows.",
            applicationCategory: "SecurityApplication",
            operatingSystem: "Any",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Secutil",
            url: "/",
            sameAs: [
              "https://github.com/akmalmuhammed/cybertools.hub",
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Popular Secutil Tools",
            itemListElement: marqueeTools.map((tool, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: tool.name,
              url: `/tools?q=${encodeURIComponent(tool.name)}`,
            })),
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "Do Secutil tools run locally?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Most tools run fully in-browser. Network and hybrid tools are labeled before any outbound call.",
                },
              },
              {
                "@type": "Question",
                name: "Can I browse tools by security domain?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Yes. Tools are grouped across SOC, threat intel, network, application, cloud IAM, supply chain, and data privacy domains.",
                },
              },
            ],
          },
        ]}
      />

      <section className="relative overflow-hidden rounded-md border border-border/60 bg-background px-6 py-16 sm:px-10 sm:py-20 lg:py-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,hsl(var(--primary)/0.28),hsl(var(--background))_42%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,hsl(var(--foreground)/0.08)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--foreground)/0.08)_1px,transparent_1px)] [background-size:56px_56px]" />
        <div className="pointer-events-none absolute inset-x-10 top-[18%] h-56 rounded-full bg-primary/20 blur-3xl" />
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="relative mx-auto flex max-w-5xl flex-col items-center text-center"
        >
          <div className="inline-flex items-center rounded-full border border-border/70 bg-background/90 px-4 py-1.5 text-sm font-semibold text-foreground backdrop-blur-sm">
            <span className="mr-2 inline-flex h-2 w-2 rounded-full bg-primary animate-pulse" />
            v1.0.0 Ready for Production
          </div>
          <h1 className="mt-8 text-[clamp(3rem,8vw,5.5rem)] font-bold tracking-tight text-foreground">
            Your Security Arsenal,
            <span className="block bg-gradient-to-r from-primary to-[hsl(var(--link))] bg-clip-text text-transparent">
              Simplified
            </span>
          </h1>
          <p className="mt-8 max-w-4xl text-[clamp(1.05rem,2.1vw,1.5rem)] leading-relaxed text-foreground/75">
            Free, privacy-first security utilities for SOC analysts, penetration testers, and developers.
            Core analysis runs locally in your browser, with clearly marked optional network lookups (RDAP, DNS,
            JWKS, and reputation proxy).
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="h-14 min-w-[210px] bg-primary px-8 text-lg font-semibold text-primary-foreground hover:bg-primary/90">
              <Link to="/tools">
                Explore Tools
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-14 min-w-[210px] border-border bg-background px-8 text-lg font-semibold text-foreground hover:bg-accent hover:text-accent-foreground">
              <Link to="/about">Learn More</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold sm:text-3xl">Popular Tools in Motion</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Live rotating tool shortcuts. Click any chip to open the tools page with instant search context.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/tools">View Full Tool Inventory</Link>
          </Button>
        </div>

        <div className="tool-marquee-mask rounded-2xl border border-border/60 bg-card/65 px-3 py-3">
          <div className="tool-marquee-track">
            {[...marqueeTools, ...marqueeTools].map((tool, index) => (
              <Link
                key={`${tool.id}-${index}`}
                to={`/tools?q=${encodeURIComponent(tool.name)}`}
                className="tool-marquee-chip"
                title={`Open tools page filtered by ${tool.name}`}
                aria-label={`Open tools page filtered by ${tool.name}`}
              >
                <tool.icon className="h-4 w-4 text-primary" />
                <span>{tool.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          className="rounded-3xl border border-border/60 bg-card/70 p-6 sm:p-8"
        >
          <div className="flex items-center gap-2 text-primary">
            <Lock className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-[0.16em]">Privacy Verification</span>
          </div>
          <h3 className="mt-3 text-2xl font-semibold">Verify local-first behavior yourself.</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            You can validate zero-data egress directly in your browser network panel for local-mode tools.
            No trust assumptions required.
          </p>
          <ol className="mt-5 space-y-2.5 text-sm text-muted-foreground">
            {PRIVACY_CHECKPOINTS.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ delay: 0.05 }}
          className="rounded-3xl border border-border/60 bg-card/70 p-6 sm:p-8"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-primary">
            <Activity className="h-3.5 w-3.5" />
            Runtime Trust Signals
          </div>
          <div className="mt-4 space-y-3">
            {[
              {
                icon: Shield,
                title: "Local Tools",
                detail: "No outbound calls during processing.",
              },
              {
                icon: Eye,
                title: "Hybrid Tools",
                detail: "Outbound calls require explicit user action.",
              },
              {
                icon: Network,
                title: "Network Tools",
                detail: "Calls are intentionally labeled and visible in UI.",
              },
              {
                icon: Search,
                title: "Auditability",
                detail: "Use DevTools Network tab to validate request behavior live.",
              },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: 10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="rounded-xl border border-border/60 bg-background/70 p-3"
              >
                <div className="flex items-start gap-3">
                  <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <div className="text-sm font-semibold">{item.title}</div>
                    <div className="text-xs text-muted-foreground">{item.detail}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      <section className="space-y-5">
        <div className="flex items-center gap-2 text-primary">
          <Zap className="h-5 w-5" />
          <h2 className="text-2xl font-semibold sm:text-3xl">Domain Operations Grid</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {TOOL_DOMAINS.map((domain, index) => {
            const count = getToolsForDomain(domain.id).length;
            return (
              <motion.div
                key={domain.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ delay: index * 0.03 }}
              >
                <Link
                  to={getDomainCanonicalPath(domain.id)}
                  className="group block h-full rounded-2xl border border-border/60 bg-card/70 p-4 transition-colors hover:border-primary/45"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex rounded-lg border border-primary/30 bg-primary/10 p-2 text-primary">
                      <domain.icon className="h-4 w-4" />
                    </span>
                    <Badge variant="secondary">{count} tools</Badge>
                  </div>
                  <h3 className="mt-3 text-base font-semibold group-hover:text-primary transition-colors">
                    {domain.name}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{domain.description}</p>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-border/60 bg-card/70 px-6 py-8 sm:px-8">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="text-2xl font-semibold sm:text-3xl">Deploy a faster, privacy-safe security workflow.</h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Consolidate SOC triage, threat intel normalization, appsec checks, cloud IAM analysis, and privacy controls into a single local-first operations workspace.
            </p>
          </div>
          <Button asChild size="lg" className="h-11 px-6">
            <Link to="/tools">
              Open Secutil
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
