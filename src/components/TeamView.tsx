import { useMemo } from "react";
import { Clock, Zap } from "lucide-react";
import type { Dataset } from "@/types";
import { datasetStats } from "@/lib/generator";
import { PersonaAvatar } from "./jira";

export function TeamView({ dataset }: { dataset: Dataset }) {
  const stats = useMemo(() => datasetStats(dataset), [dataset]);
  const workloadByName = useMemo(() => {
    const m = new Map<string, { open: number; done: number; points: number }>();
    for (const w of stats.workload) m.set(w.name, { open: w.open, done: w.done, points: w.points });
    return m;
  }, [stats]);

  const maxLoad = Math.max(1, ...stats.workload.map((w) => w.open + w.done));

  return (
    <div className="scrollbar-thin grid h-full grid-cols-3 gap-3 overflow-y-auto p-1 max-xl:grid-cols-2">
      {dataset.people.map((p, idx) => {
        const w = workloadByName.get(p.name) ?? { open: 0, done: 0, points: 0 };
        const total = w.open + w.done;
        const pct = total ? Math.round((w.done / total) * 100) : 0;
        return (
          <div
            key={p.id}
            className="rise flex flex-col rounded-xl border border-border/70 bg-card/80 p-4"
            style={{ animationDelay: `${idx * 40}ms` }}
          >
            <div className="flex items-center gap-3">
              <PersonaAvatar person={p} size="lg" />
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{p.name}</div>
                <div className="text-[11px] text-muted-foreground">{p.role}</div>
              </div>
              <span className="ml-auto flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 font-mono2 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {p.timezone}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-background/50 py-2">
                <div className="font-mono2 text-sm font-bold text-amber-300">{w.open}</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">open</div>
              </div>
              <div className="rounded-lg bg-background/50 py-2">
                <div className="font-mono2 text-sm font-bold text-emerald-300">{w.done}</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">done</div>
              </div>
              <div className="rounded-lg bg-background/50 py-2">
                <div className="flex items-center justify-center gap-0.5 font-mono2 text-sm font-bold text-sky-300">
                  <Zap className="h-3 w-3" />
                  {w.points}
                </div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">points</div>
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>workload</span>
                <span className="font-mono2">{pct}% done</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400/70 to-emerald-400"
                  style={{ width: `${Math.round((total / maxLoad) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
