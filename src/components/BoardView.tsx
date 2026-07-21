import type { GenIssue, GenProject, IssueStatus } from "@/types";
import { IssueTypeIcon, PersonaAvatar, PriorityIcon } from "./jira";
import { cn } from "@/lib/utils";

const COLUMNS: { status: IssueStatus; dot: string }[] = [
  { status: "To Do", dot: "bg-slate-400" },
  { status: "In Progress", dot: "bg-sky-400" },
  { status: "In Review", dot: "bg-violet-400" },
  { status: "Blocked", dot: "bg-rose-400" },
  { status: "Done", dot: "bg-emerald-400" },
];

const MAX_CARDS = 7;

function BoardCard({ issue, onClick, idx }: { issue: GenIssue; onClick: () => void; idx: number }) {
  return (
    <button
      onClick={onClick}
      className="rise group w-full rounded-md border border-border/80 bg-card p-2.5 text-left shadow-sm transition-all hover:border-lime-400/40 hover:bg-secondary/60"
      style={{ animationDelay: `${Math.min(idx, 10) * 25}ms` }}
    >
      <span className="mb-1.5 line-clamp-2 block text-[12px] font-medium leading-snug text-foreground/90 group-hover:text-foreground">
        {issue.summary}
      </span>
      <span className="flex items-center gap-1.5">
        <IssueTypeIcon type={issue.type} />
        <span className="font-mono2 text-[10px] font-medium text-muted-foreground">{issue.key}</span>
        {issue.points != null && (
          <span className="rounded-full bg-secondary px-1.5 font-mono2 text-[9.5px] font-semibold text-muted-foreground">
            {issue.points}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          <PriorityIcon priority={issue.priority} />
          <PersonaAvatar person={issue.assignee} size="sm" />
        </span>
      </span>
    </button>
  );
}

export function BoardView({
  project,
  onOpenIssue,
}: {
  project: GenProject;
  onOpenIssue: (i: GenIssue) => void;
}) {
  return (
    <div className="grid h-full grid-cols-5 gap-2.5 overflow-x-auto p-1">
      {COLUMNS.map(({ status, dot }) => {
        const items = project.issues.filter((i) => i.status === status);
        return (
          <div key={status} className="flex min-w-[190px] flex-col rounded-lg bg-secondary/40 p-2">
            <div className="mb-2 flex items-center gap-1.5 px-1">
              <span className={cn("h-2 w-2 rounded-full", dot)} />
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                {status}
              </span>
              <span className="ml-auto rounded bg-background/60 px-1.5 font-mono2 text-[10px] text-muted-foreground">
                {items.length}
              </span>
            </div>
            <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto pr-0.5">
              {items.slice(0, MAX_CARDS).map((issue, idx) => (
                <BoardCard key={issue.key} issue={issue} idx={idx} onClick={() => onOpenIssue(issue)} />
              ))}
              {items.length > MAX_CARDS && (
                <div className="rounded-md border border-dashed border-border px-2 py-1.5 text-center text-[10.5px] text-muted-foreground">
                  + {items.length - MAX_CARDS} more in this column
                </div>
              )}
              {items.length === 0 && (
                <div className="rounded-md border border-dashed border-border px-2 py-4 text-center text-[10.5px] text-muted-foreground/60">
                  empty
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
