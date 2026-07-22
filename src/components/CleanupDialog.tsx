import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, TerminalSquare, Trash2 } from "lucide-react";
import type { JiraConnection, PushLogLine } from "@/types";
import type { PushRecord } from "@/lib/recipes";
import { cleanupPush } from "@/lib/cleanup";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Phase = "confirm" | "running" | "done";

const LEVEL_COLOR: Record<PushLogLine["level"], string> = {
  info: "text-slate-300",
  ok: "text-emerald-300",
  warn: "text-amber-300",
  err: "text-rose-300",
};

export function CleanupDialog({
  record,
  conn,
  onClose,
  onRemoved,
}: {
  record: PushRecord | null;
  conn: JiraConnection;
  onClose: () => void;
  onRemoved: (id: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>("confirm");
  const [log, setLog] = useState<PushLogLine[]>([]);
  const stopRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const t0 = useRef(0);

  useEffect(() => {
    if (record) {
      setPhase("confirm");
      setLog([]);
      stopRef.current = false;
    }
  }, [record]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [log]);

  if (!record) return null;

  const pushLine = (level: PushLogLine["level"], text: string) =>
    setLog((l) => [...l, { t: performance.now() - t0.current, level, text }]);

  const run = async () => {
    setPhase("running");
    setLog([]);
    t0.current = performance.now();
    const res = await cleanupPush({ ...conn, site: record.site }, record, pushLine, () => stopRef.current);
    setPhase("done");
    if (res.projectsDeleted > 0 || (res.issuesDeleted > 0 && res.failed === 0)) {
      onRemoved(record.id);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Trash2 className="h-4 w-4 text-rose-400" />
            Sandbox cleanup
          </DialogTitle>
        </DialogHeader>

        {phase === "confirm" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-rose-400/30 bg-rose-400/[0.06] p-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
              <div className="text-[12px] leading-relaxed text-foreground/90">
                This <strong>permanently deletes</strong> what the live push created on{" "}
                <span className="font-mono2 text-[11px] text-rose-200">{record.site}</span>:
                <div className="mt-1.5 flex gap-3 font-mono2 text-[11px] text-muted-foreground">
                  <span>{record.projectKeys.join(", ")}</span>
                  <span>·</span>
                  <span>{record.issueCount} issues</span>
                  <span>·</span>
                  <span>{record.commentCount} comments</span>
                </div>
                <p className="mt-1.5 text-[10.5px] text-muted-foreground">
                  Pushed {new Date(record.at).toLocaleString()}. Whole projects are deleted when your token has
                  admin rights; otherwise issues are removed one by one. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={onClose} className="text-xs">
                Cancel
              </Button>
              <Button size="sm" onClick={run} className="gap-1.5 bg-rose-500 text-xs font-bold text-white hover:bg-rose-400">
                <Trash2 className="h-3.5 w-3.5" />
                Delete everything
              </Button>
            </div>
          </div>
        )}

        {phase !== "confirm" && (
          <>
            <div className="rounded-lg border border-border bg-[hsl(150,10%,3%)]">
              <div className="flex items-center gap-2 border-b border-border/70 px-3 py-1.5">
                <TerminalSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono2 text-[10px] text-muted-foreground">seedling · cleanup log</span>
              </div>
              <div ref={scrollRef} className="scrollbar-thin h-52 overflow-y-auto px-3 py-2 font-mono2 text-[11px] leading-relaxed">
                {log.map((l, i) => (
                  <div key={i} className={cn("whitespace-pre-wrap", LEVEL_COLOR[l.level])}>
                    {l.text}
                  </div>
                ))}
                {phase === "running" && <Loader2 className="mt-1 h-3.5 w-3.5 animate-spin text-rose-300" />}
              </div>
            </div>
            <div className="flex justify-end">
              {phase === "done" ? (
                <Button size="sm" onClick={onClose} className="gap-1.5 bg-lime-400 text-black hover:bg-lime-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Close
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => (stopRef.current = true)} className="text-xs text-muted-foreground">
                  Request stop
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
