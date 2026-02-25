import { motion } from "framer-motion";
import { ShieldCheck, Network, AppWindow, Wrench } from "lucide-react";
import { ToolsList } from "@/components/tools/ToolsList";
import { getDomainCounts } from "@/lib/constants/tool-domains";

const DOMAIN_ICON = {
  soc: ShieldCheck,
  network: Network,
  application: AppWindow,
  utility: Wrench,
} as const;

export default function ToolsPage() {
  const counts = getDomainCounts();

  return (
    <div className="space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/55 backdrop-blur-xl p-6 sm:p-8"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(16,185,129,0.24),transparent_42%),radial-gradient(circle_at_78%_18%,rgba(6,182,212,0.2),transparent_40%)] pointer-events-none" />

        <div className="relative space-y-5">
          <div className="inline-flex items-center rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Security Operations Shell
          </div>

          <div className="max-w-3xl space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
              Tool Navigation by Operational Domain
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg">
              Browse SOC, network, application, and utility stacks from one app shell. Each domain groups relevant tools for faster execution in live workflows.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(Object.keys(counts) as (keyof typeof counts)[]).map((domainId) => {
              const Icon = DOMAIN_ICON[domainId];
              return (
                <div key={domainId} className="rounded-xl border border-border/60 bg-background/45 px-4 py-3 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold capitalize">{domainId}</span>
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{counts[domainId]}</div>
                  <div className="text-xs text-muted-foreground">tool{counts[domainId] === 1 ? "" : "s"}</div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.section>

      <ToolsList />
    </div>
  );
}
