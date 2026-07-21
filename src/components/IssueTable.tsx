import { useMemo, useState } from "react";
import { MessageSquare, Search } from "lucide-react";
import type { GenIssue, GenProject, IssueType } from "@/types";
import { IssueTypeIcon, LabelChip, PersonaAvatar, PriorityIcon, StatusChip } from "./jira";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const TYPE_FILTERS: (IssueType | "all")[] = ["all", "story", "task", "bug", "subtask"];

export function IssueTable({
  project,
  onOpenIssue,
}: {
  project: GenProject;
  onOpenIssue: (i: GenIssue) => void;
}) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<IssueType | "all">("all");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return project.issues.filter((i) => {
      if (type !== "all" && i.type !== type) return false;
      if (!needle) return true;
      return (
        i.summary.toLowerCase().includes(needle) ||
        i.key.toLowerCase().includes(needle) ||
        i.labels.some((l) => l.includes(needle)) ||
        (i.assignee?.name.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [project, q, type]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-1 pb-2.5">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter summary, key, label, assignee…"
            className="h-8 bg-background/60 pl-8 text-xs"
            spellCheck={false}
          />
        </div>
        <div className="flex gap-1">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                "rounded-md border px-2 py-1 text-[10.5px] font-medium capitalize transition-colors",
                type === t
                  ? "border-lime-400/50 bg-lime-400/10 text-lime-200"
                  : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono2 text-[10.5px] text-muted-foreground">
          {rows.length} / {project.issues.length} issues
        </span>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto rounded-lg border border-border/70">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-secondary/90 backdrop-blur">
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 font-semibold">Key</th>
              <th className="px-3 py-2 font-semibold">Summary</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">P</th>
              <th className="px-3 py-2 font-semibold">Assignee</th>
              <th className="px-3 py-2 font-semibold">Labels</th>
              <th className="px-3 py-2 text-right font-semibold">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr
                key={i.key}
                onClick={() => onOpenIssue(i)}
                className="cursor-pointer border-t border-border/50 transition-colors hover:bg-secondary/50"
              >
                <td className="whitespace-nowrap px-3 py-2">
                  <span className="flex items-center gap-1.5">
                    <IssueTypeIcon type={i.type} />
                    <span className="font-mono2 text-[11px] font-medium text-sky-300">{i.key}</span>
                  </span>
                </td>
                <td className="max-w-[380px] px-3 py-2">
                  <span className="line-clamp-1 text-[12px] text-foreground/90">{i.summary}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <StatusChip status={i.status} />
                </td>
                <td className="px-3 py-2">
                  <PriorityIcon priority={i.priority} />
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span className="flex items-center gap-1.5">
                    <PersonaAvatar person={i.assignee} size="sm" />
                    <span className="text-[11px] text-muted-foreground">
                      {i.assignee ? i.assignee.name.split(" ")[0] : "—"}
                    </span>
                  </span>
                </td>
                <td className="max-w-[180px] px-3 py-2">
                  <span className="flex flex-wrap items-center gap-1">
                    {i.labels.slice(0, 2).map((l) => (
                      <LabelChip key={l} label={l} />
                    ))}
                    {i.comments.length > 0 && (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <MessageSquare className="h-3 w-3" />
                        {i.comments.length}
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono2 text-[11px] text-muted-foreground">
                  {i.points ?? "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-xs text-muted-foreground">
                  No issues match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
