import { useMemo } from "react";
import { CheckCircle2, MessageSquare, PlusCircle } from "lucide-react";
import type { Dataset, Persona } from "@/types";
import { PersonaAvatar } from "./jira";

interface Event {
  at: Date;
  icon: "created" | "comment" | "resolved";
  who: Persona;
  issueKey: string;
  issueSummary: string;
  extra?: string;
}

function rel(d: Date): string {
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function ActivityView({ dataset }: { dataset: Dataset }) {
  const events = useMemo(() => {
    const evs: Event[] = [];
    for (const p of dataset.projects) {
      for (const i of p.issues) {
        evs.push({ at: i.createdAt, icon: "created", who: i.reporter, issueKey: i.key, issueSummary: i.summary });
        for (const c of i.comments) {
          evs.push({ at: c.createdAt, icon: "comment", who: c.author, issueKey: i.key, issueSummary: i.summary, extra: c.body });
        }
        if (i.resolvedAt && i.assignee) {
          evs.push({ at: i.resolvedAt, icon: "resolved", who: i.assignee, issueKey: i.key, issueSummary: i.summary });
        }
      }
    }
    return evs.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 80);
  }, [dataset]);

  const ICON = {
    created: <PlusCircle className="h-3.5 w-3.5 text-sky-400" />,
    comment: <MessageSquare className="h-3.5 w-3.5 text-violet-400" />,
    resolved: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
  } as const;

  const VERB = { created: "created", comment: "commented on", resolved: "resolved" } as const;

  return (
    <div className="scrollbar-thin h-full overflow-y-auto p-1">
      <div className="mx-auto max-w-2xl space-y-1.5">
        {events.map((e, idx) => (
          <div key={idx} className="rise flex items-start gap-3 rounded-lg border border-border/60 bg-card/70 px-3.5 py-2.5" style={{ animationDelay: `${Math.min(idx, 20) * 20}ms` }}>
            <PersonaAvatar person={e.who} size="sm" className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 text-[12px]">
                <span className="font-semibold">{e.who.name}</span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  {ICON[e.icon]} {VERB[e.icon]}
                </span>
                <span className="font-mono2 text-[11px] font-medium text-sky-300">{e.issueKey}</span>
                <span className="ml-auto shrink-0 font-mono2 text-[10px] text-muted-foreground/70">{rel(e.at)}</span>
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {e.extra ?? e.issueSummary}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
