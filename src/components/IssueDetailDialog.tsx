import { Calendar, Eye, FileText, Link2, MessageSquare, Paperclip, ThumbsUp, Timer, User } from "lucide-react";
import type { GenIssue } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IssueTypeIcon, LabelChip, PersonaAvatar, PriorityIcon, StatusChip, TYPE_LABEL } from "./jira";

function DescriptionBlock({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-[12.5px] leading-relaxed text-foreground/85">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("- ")) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-lime-400">•</span>
              <span>{renderInline(line.slice(2))}</span>
            </div>
          );
        }
        if (/^\d+\./.test(line)) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="font-mono2 text-lime-400/80">{line.match(/^\d+\./)![0]}</span>
              <span>{renderInline(line.replace(/^\d+\.\s*/, ""))}</span>
            </div>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string) {
  // lightweight **bold** and `code` rendering
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {p.slice(2, -2)}
        </strong>
      );
    }
    if (p.startsWith("`") && p.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-secondary px-1 py-0.5 font-mono2 text-[11px] text-lime-200">
          {p.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function fmt(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtMin(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function IssueDetailDialog({
  issue,
  onClose,
}: {
  issue: GenIssue | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={issue != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl border-border bg-card p-0">
        {issue && (
          <div className="grid max-h-[80vh] grid-cols-[1fr_220px]">
            {/* main */}
            <div className="scrollbar-thin overflow-y-auto p-5">
              <DialogHeader className="mb-3">
                <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <IssueTypeIcon type={issue.type} />
                  <span className="font-mono2 font-medium text-sky-300">{issue.key}</span>
                  <span>·</span>
                  <span>{TYPE_LABEL[issue.type]}</span>
                  {issue.epicKey && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
                        {issue.epicTitle}
                      </span>
                    </>
                  )}
                </div>
                <DialogTitle className="text-balance text-lg font-bold leading-snug">
                  {issue.summary}
                </DialogTitle>
              </DialogHeader>

              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                Description
              </div>
              <DescriptionBlock text={issue.description} />

              {issue.links.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                    <Link2 className="h-3 w-3" /> Linked issues
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {issue.links.map((l) => (
                      <span key={l.key + l.type} className="rounded border border-border bg-secondary px-1.5 py-0.5 text-[10.5px]">
                        <span className="text-muted-foreground">{l.type}</span>{" "}
                        <span className="font-mono2 font-medium text-sky-300">{l.key}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {issue.attachments.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                    <Paperclip className="h-3 w-3" /> Attachments ({issue.attachments.length})
                  </div>
                  <div className="space-y-1">
                    {issue.attachments.map((a) => (
                      <div key={a.filename} className="flex items-center gap-2 rounded border border-border/60 bg-background/50 px-2.5 py-1.5">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate font-mono2 text-[11px] text-sky-300">{a.filename}</span>
                        <span className="ml-auto shrink-0 font-mono2 text-[10px] text-muted-foreground">
                          {a.sizeKb > 1024 ? `${(a.sizeKb / 1024).toFixed(1)} MB` : `${a.sizeKb} KB`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                  <MessageSquare className="h-3 w-3" /> Comments ({issue.comments.length})
                </div>
                <div className="space-y-3">
                  {issue.comments.length === 0 && (
                    <p className="text-[11.5px] italic text-muted-foreground/70">No comments yet.</p>
                  )}
                  {issue.comments.map((c) => (
                    <div key={c.id} className="flex gap-2.5">
                      <PersonaAvatar person={c.author} size="md" className="mt-0.5" />
                      <div className="min-w-0 flex-1 rounded-lg border border-border/60 bg-background/50 px-3 py-2">
                        <div className="mb-0.5 flex items-baseline gap-2">
                          <span className="text-[11.5px] font-semibold">{c.author.name}</span>
                          <span className="font-mono2 text-[9.5px] text-muted-foreground/70">
                            {fmt(c.createdAt)}
                          </span>
                        </div>
                        <p className="text-[12px] leading-relaxed text-foreground/85">{c.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* sidebar */}
            <div className="space-y-4 border-l border-border/70 bg-secondary/30 p-4">
              <div>
                <div className="mb-1 text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground/70">Status</div>
                <StatusChip status={issue.status} />
              </div>
              <div>
                <div className="mb-1 text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground/70">Priority</div>
                <span className="flex items-center gap-1.5 text-[12px]">
                  <PriorityIcon priority={issue.priority} />
                  {issue.priority}
                </span>
              </div>
              <div>
                <div className="mb-1 flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground/70">
                  <User className="h-3 w-3" /> Assignee
                </div>
                <span className="flex items-center gap-2">
                  <PersonaAvatar person={issue.assignee} size="sm" />
                  <span className="text-[11.5px]">{issue.assignee?.name ?? "Unassigned"}</span>
                </span>
                {issue.assignee && (
                  <span className="mt-0.5 block pl-7 text-[10px] text-muted-foreground">{issue.assignee.role}</span>
                )}
              </div>
              <div>
                <div className="mb-1 text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground/70">Reporter</div>
                <span className="flex items-center gap-2">
                  <PersonaAvatar person={issue.reporter} size="sm" />
                  <span className="text-[11.5px]">{issue.reporter.name}</span>
                </span>
              </div>
              {issue.points != null && (
                <div>
                  <div className="mb-1 text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground/70">Story points</div>
                  <span className="rounded-full bg-secondary px-2 py-0.5 font-mono2 text-[11px] font-semibold">{issue.points}</span>
                </div>
              )}
              {issue.sprint && (
                <div>
                  <div className="mb-1 text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground/70">Sprint</div>
                  <span className="text-[11.5px]">{issue.sprint}</span>
                </div>
              )}
              {issue.labels.length > 0 && (
                <div>
                  <div className="mb-1 text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground/70">Labels</div>
                  <div className="flex flex-wrap gap-1">
                    {issue.labels.map((l) => (
                      <LabelChip key={l} label={l} />
                    ))}
                  </div>
                </div>
              )}
              {issue.fixVersions.length > 0 && (
                <div>
                  <div className="mb-1 text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground/70">Fix version/s</div>
                  <div className="flex flex-wrap gap-1">
                    {issue.fixVersions.map((v) => (
                      <span key={v} className="rounded border border-violet-400/30 bg-violet-400/10 px-1.5 py-0.5 font-mono2 text-[10px] font-medium text-violet-300">{v}</span>
                    ))}
                  </div>
                </div>
              )}
              {issue.components.length > 0 && (
                <div>
                  <div className="mb-1 text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground/70">Components</div>
                  <div className="flex flex-wrap gap-1">
                    {issue.components.map((c) => (
                      <span key={c} className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{c}</span>
                    ))}
                  </div>
                </div>
              )}
              {issue.estimateMin != null && (
                <div>
                  <div className="mb-1 flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground/70">
                    <Timer className="h-3 w-3" /> Time tracking
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-sky-400"
                        style={{ width: `${Math.min(100, Math.round(((issue.spentMin ?? 0) / issue.estimateMin) * 100))}%` }}
                      />
                    </div>
                    <div className="font-mono2 text-[10px] text-muted-foreground">
                      {fmtMin(issue.spentMin ?? 0)} logged · {fmtMin(issue.estimateMin)} estimated
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-4">
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Eye className="h-3.5 w-3.5" /> {issue.watchers}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <ThumbsUp className="h-3.5 w-3.5" /> {issue.votes}
                </span>
              </div>
              <div>
                <div className="mb-1 flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground/70">
                  <Calendar className="h-3 w-3" /> Dates
                </div>
                <div className="space-y-0.5 text-[11px] text-muted-foreground">
                  <div>Created {fmt(issue.createdAt)}</div>
                  {issue.dueDate && <div className="text-amber-300/90">Due {fmt(issue.dueDate)}</div>}
                  {issue.resolvedAt && <div>Resolved {fmt(issue.resolvedAt)}</div>}
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
