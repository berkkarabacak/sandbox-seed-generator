import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  Bug,
  CheckSquare,
  ChevronsDown,
  ChevronsUp,
  Equal,
  Zap,
} from "lucide-react";
import type { IssuePriority, IssueStatus, IssueType, Persona } from "@/types";
import { cn } from "@/lib/utils";

// ─── Issue type icon ──────────────────────────────────────────────────────────

export function IssueTypeIcon({ type, className }: { type: IssueType; className?: string }) {
  const cls = cn("h-3.5 w-3.5 shrink-0", className);
  switch (type) {
    case "bug":
      return <Bug className={cn(cls, "text-rose-400")} />;
    case "story":
      return <Zap className={cn(cls, "text-emerald-400")} />;
    case "task":
      return <CheckSquare className={cn(cls, "text-sky-400")} />;
    case "epic":
      return <Bookmark className={cn(cls, "text-violet-400")} />;
    case "subtask":
      return <CheckSquare className={cn(cls, "text-slate-400")} />;
  }
}

export const TYPE_LABEL: Record<IssueType, string> = {
  bug: "Bug",
  story: "Story",
  task: "Task",
  epic: "Epic",
  subtask: "Sub-task",
};

// ─── Priority icon ────────────────────────────────────────────────────────────

export function PriorityIcon({ priority, className }: { priority: IssuePriority; className?: string }) {
  const cls = cn("h-3.5 w-3.5 shrink-0", className);
  switch (priority) {
    case "Highest":
      return <ChevronsUp className={cn(cls, "text-rose-500")} />;
    case "High":
      return <ArrowUp className={cn(cls, "text-orange-400")} />;
    case "Medium":
      return <Equal className={cn(cls, "text-amber-300")} />;
    case "Low":
      return <ArrowDown className={cn(cls, "text-sky-400")} />;
    case "Lowest":
      return <ChevronsDown className={cn(cls, "text-slate-400")} />;
  }
}

// ─── Status chip ──────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<IssueStatus, string> = {
  "To Do": "bg-slate-500/15 text-slate-300 border-slate-500/30",
  "In Progress": "bg-sky-500/15 text-sky-300 border-sky-500/30",
  "In Review": "bg-violet-500/15 text-violet-300 border-violet-500/30",
  Blocked: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  Done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

export function StatusChip({ status, className }: { status: IssueStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        STATUS_STYLE[status],
        className,
      )}
    >
      {status}
    </span>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

export function PersonaAvatar({
  person,
  size = "md",
  className,
}: {
  person: Persona | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sz = size === "sm" ? "h-5 w-5 text-[9px]" : size === "lg" ? "h-10 w-10 text-sm" : "h-6 w-6 text-[10px]";
  if (!person) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground",
          sz,
          className,
        )}
        title="Unassigned"
      >
        ?
      </span>
    );
  }
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-full font-bold text-black/80", sz, className)}
      style={{ backgroundColor: person.color }}
      title={person.name}
    >
      {person.initials}
    </span>
  );
}

// ─── Label chip ───────────────────────────────────────────────────────────────

export function LabelChip({ label }: { label: string }) {
  return (
    <span className="rounded bg-secondary px-1.5 py-0.5 font-mono2 text-[10px] text-muted-foreground">
      {label}
    </span>
  );
}
