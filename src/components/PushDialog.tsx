import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Circle,
  FlaskConical,
  Loader2,
  Rocket,
  Satellite,
  ServerCrash,
  TerminalSquare,
} from "lucide-react";
import type { Dataset, JiraConnection, PushLogLine } from "@/types";
import { livePush, probeProxy } from "@/lib/jiraClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type Mode = "dry-run" | "live";
type Phase = "ready" | "running" | "done";

const STEP_LABELS = ["Authenticate", "Create projects", "Epics & sprints", "Bulk issues", "Comments & links", "Verify"];

const LEVEL_COLOR: Record<PushLogLine["level"], string> = {
  info: "text-slate-300",
  ok: "text-emerald-300",
  warn: "text-amber-300",
  err: "text-rose-300",
};

// ─── Dry-run simulation ───────────────────────────────────────────────────────

function simulateRun(
  dataset: Dataset,
  site: string,
  push: (level: PushLogLine["level"], text: string) => void,
  setStepIdx: (i: number) => void,
  setProgress: (p: number) => void,
  finish: (ms: number) => void,
  pace = 1,
): () => void {
  const t0 = performance.now();
  const timers: ReturnType<typeof setTimeout>[] = [];
  let cancelled = false;
  const guard = <A extends unknown[]>(fn: (...a: A) => void) => (...a: A) => !cancelled && fn(...a);
  const p = guard(push);
  const ss = guard(setStepIdx);
  const sp = guard(setProgress);
  const fin = guard(finish);

  p("info", `$ seedling push --site ${site} --mode dry-run`);
  p("warn", "DRY-RUN: no writes reach Atlassian. Simulating REST calls.");

  const weights = [1, 2, 2, 5, 3, 1];
  const total = weights.reduce((a, b) => a + b, 0);
  let delay = 250 * pace;
  let acc = 0;

  const stepLines: string[][] = [
    [`GET https://${site}/rest/api/3/myself → 200 OK`, "Authenticated as seed-bot · accountId 712020:demo"],
    dataset.projects.flatMap((pr) => [`POST /project { key: "${pr.key}" } → 201`]),
    dataset.projects.flatMap((pr) => [
      ...pr.epics.map((e) => `POST /issue { Epic "${e.title}" } → 201`),
      ...pr.sprints.map((s) => `POST /sprint { "${s.name}" } → 201`),
    ]),
    dataset.projects.flatMap((pr) => {
      const chunks = Math.ceil(pr.issues.length / 50);
      return Array.from({ length: chunks }, (_, i) => `POST /issue/bulk (batch ${i + 1}/${chunks}) → ${Math.min(50, pr.issues.length - i * 50)} issues in ${pr.key}`);
    }),
    (() => {
      const c = dataset.projects.reduce((s, pr) => s + pr.issues.reduce((a, i) => a + i.comments.length, 0), 0);
      const l = dataset.projects.reduce((s, pr) => s + pr.issues.reduce((a, i) => a + i.linkedKeys.length, 0), 0);
      return [`POST /issue/{key}/comment × ${c} → all 201`, `POST /issueLink × ${l} → all 201`];
    })(),
    [`GET /search?jql=project in (${dataset.projects.map((pr) => pr.key).join(",")}) → ${dataset.projects.reduce((s, pr) => s + pr.issues.length, 0)} issues visible`, "Seed data verified ✓"],
  ];

  stepLines.forEach((lines, si) => {
    timers.push(setTimeout(() => { ss(si); p("info", `▸ ${STEP_LABELS[si]}…`); }, delay));
    for (const line of lines) {
      delay += (80 + Math.random() * 150) * pace;
      const l = line;
      timers.push(setTimeout(() => p(/✓|201|OK/.test(l) ? "ok" : "info", `  ${l}`), delay));
    }
    acc += weights[si];
    const target = Math.round((acc / total) * 100);
    timers.push(setTimeout(() => sp(target), delay));
    delay += 180 * pace;
  });

  timers.push(
    setTimeout(() => {
      const totalIssues = dataset.projects.reduce((s, pr) => s + pr.issues.length, 0);
      p("ok", `✔ Seeded ${dataset.projects.length} projects · ${totalIssues} issues (simulated).`);
      fin(Math.round(performance.now() - t0));
    }, delay + 300 * pace),
  );

  return () => {
    cancelled = true;
    timers.forEach(clearTimeout);
  };
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

export function PushDialog({
  open,
  onOpenChange,
  dataset,
  conn,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dataset: Dataset;
  conn: JiraConnection;
  onComplete: (durationMs: number, mode: Mode) => void;
}) {
  const [mode, setMode] = useState<Mode>("dry-run");
  const [phase, setPhase] = useState<Phase>("ready");
  const [proxyUp, setProxyUp] = useState<boolean | null>(null);
  const [log, setLog] = useState<PushLogLine[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stopRef = useRef(false);
  const t0 = useRef(0);

  const site = useMemo(() => conn.site.trim().toLowerCase() || "your-team.atlassian.net", [conn.site]);
  const totalIssues = dataset.projects.reduce((s, p) => s + p.issues.length, 0);

  // reset + probe proxy whenever the dialog opens
  useEffect(() => {
    if (!open) return;
    setPhase("ready");
    setLog([]);
    setStepIdx(0);
    setProgress(0);
    stopRef.current = false;
    setProxyUp(null);
    probeProxy().then(setProxyUp);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [log]);

  const pushLine = (level: PushLogLine["level"], text: string) =>
    setLog((l) => [...l, { t: performance.now() - t0.current, level, text }]);

  const start = async () => {
    setPhase("running");
    setLog([]);
    setStepIdx(0);
    setProgress(2);
    t0.current = performance.now();
    stopRef.current = false;

    if (mode === "dry-run") {
      // ?pace=slow stretches the simulation out — handy for demos and recordings
      const pace = new URLSearchParams(window.location.search).get("pace") === "slow" ? 2.8 : 1;
      simulateRun(dataset, site, pushLine, setStepIdx, setProgress, (ms) => {
        setPhase("done");
        setStepIdx(STEP_LABELS.length);
        onComplete(ms, "dry-run");
      }, pace);
      return;
    }

    // live mode
    pushLine("info", `$ seedling push --site ${site} --mode live`);
    pushLine("warn", "LIVE: real objects will be created in your Jira sandbox.");
    try {
      const res = await livePush(
        { ...conn, site },
        dataset,
        pushLine,
        () => stopRef.current,
        (i) => {
          setStepIdx(i);
          setProgress(Math.min(96, Math.round(((i + 1) / (STEP_LABELS.length + 1)) * 100)));
        },
      );
      if (res.aborted) {
        pushLine("err", "✖ Push aborted — see errors above.");
      } else {
        pushLine("ok", `✔ Done: ${res.projectKeys.length} projects · ${res.issuesCreated} issues · ${res.commentsCreated} comments · ${res.linksCreated} links.`);
        pushLine("info", `  → https://${site}/jira/software/projects/${res.projectKeys[0] ?? ""}/boards`);
      }
      setProgress(100);
      setStepIdx(STEP_LABELS.length);
      setPhase("done");
      onComplete(Math.round(performance.now() - t0.current), "live");
    } catch (err) {
      pushLine("err", `✖ Unexpected failure: ${String(err)}`);
      pushLine("warn", "Is the proxy running? Start it with: npm run proxy");
      setPhase("done");
      setProgress(100);
    }
  };

  const modeBadge =
    phase === "ready" ? null : mode === "dry-run" ? (
      <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
        <FlaskConical className="h-3 w-3" /> dry-run simulation
      </span>
    ) : (
      <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-rose-400/40 bg-rose-400/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
        <Satellite className="h-3 w-3" /> live push
      </span>
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Rocket className="h-4 w-4 text-lime-400" />
            Push seed data to Jira
            {modeBadge}
          </DialogTitle>
        </DialogHeader>

        {phase === "ready" && (
          <div className="space-y-4">
            {/* mode cards */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setMode("dry-run")}
                className={cn(
                  "rounded-lg border p-3.5 text-left transition-all",
                  mode === "dry-run" ? "border-amber-400/50 bg-amber-400/[0.07]" : "border-border bg-background/40 hover:border-muted-foreground/40",
                )}
              >
                <FlaskConical className={cn("mb-2 h-4 w-4", mode === "dry-run" ? "text-amber-300" : "text-muted-foreground")} />
                <div className="text-xs font-bold">Dry-run simulation</div>
                <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">
                  Rehearse the whole pipeline with zero writes. Safe to demo the flow.
                </p>
              </button>
              <button
                onClick={() => setMode("live")}
                className={cn(
                  "rounded-lg border p-3.5 text-left transition-all",
                  mode === "live" ? "border-rose-400/50 bg-rose-400/[0.07]" : "border-border bg-background/40 hover:border-muted-foreground/40",
                )}
              >
                <Satellite className={cn("mb-2 h-4 w-4", mode === "live" ? "text-rose-300" : "text-muted-foreground")} />
                <div className="text-xs font-bold">Live push</div>
                <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">
                  Create real projects, issues and comments in your sandbox via the local proxy.
                </p>
              </button>
            </div>

            {/* live prerequisites */}
            {mode === "live" && (
              <div className="space-y-1.5 rounded-lg border border-border/70 bg-background/40 p-3 text-[11px]">
                <div className="flex items-center gap-2">
                  {proxyUp === null ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : proxyUp ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <ServerCrash className="h-3.5 w-3.5 text-rose-400" />
                  )}
                  <span className={proxyUp ? "text-emerald-300" : "text-rose-300"}>
                    {proxyUp === null
                      ? "Checking local proxy…"
                      : proxyUp
                        ? "Proxy online at localhost:8787"
                        : "Proxy offline — run `npm run proxy` in the project folder first"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {conn.token.trim().length > 8 ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <ServerCrash className="h-3.5 w-3.5 text-rose-400" />
                  )}
                  <span className={conn.token.trim().length > 8 ? "text-emerald-300" : "text-rose-300"}>
                    {conn.token.trim().length > 8 ? "API token present" : "API token missing — paste it in the Jira Cloud target card"}
                  </span>
                </div>
                <p className="pt-1 text-[10px] leading-relaxed text-muted-foreground/80">
                  Live push creates real Epics/Stories/Tasks/Bugs/Sub-tasks. Personas, points and sprints are
                  preserved in each description's seed metadata; issues are assigned round-robin to real sandbox
                  users when found.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="font-mono2 text-[10.5px] text-muted-foreground">
                {dataset.projects.length} projects · {totalIssues} issues → https://{site}
              </span>
              <Button
                size="sm"
                onClick={start}
                disabled={mode === "live" && (proxyUp !== true || conn.token.trim().length <= 8)}
                className={cn(
                  "gap-1.5 font-bold",
                  mode === "live" ? "bg-rose-400 text-black hover:bg-rose-300" : "bg-lime-400 text-black hover:bg-lime-300",
                )}
              >
                <Rocket className="h-3.5 w-3.5" />
                {mode === "live" ? "Start live push" : "Start dry-run"}
              </Button>
            </div>
          </div>
        )}

        {phase !== "ready" && (
          <>
            {/* steps */}
            <div className="flex items-center gap-1">
              {STEP_LABELS.map((label, i) => (
                <div key={label} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full items-center gap-1">
                    {i > 0 && <div className={cn("h-px flex-1", i <= stepIdx ? "bg-lime-400/60" : "bg-border")} />}
                    {i < stepIdx || phase === "done" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-lime-400" />
                    ) : i === stepIdx && phase === "running" ? (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-lime-300" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                    )}
                    {i < STEP_LABELS.length - 1 && <div className={cn("h-px flex-1", i < stepIdx ? "bg-lime-400/60" : "bg-border")} />}
                  </div>
                  <span className={cn("text-center text-[9px] font-medium leading-tight", i <= stepIdx ? "text-lime-200" : "text-muted-foreground/60")}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <Progress value={progress} className="h-1.5 bg-secondary [&>div]:bg-lime-400" />

            {/* console */}
            <div className="rounded-lg border border-border bg-[hsl(150,10%,3%)]">
              <div className="flex items-center gap-2 border-b border-border/70 px-3 py-1.5">
                <TerminalSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono2 text-[10px] text-muted-foreground">seedling · push log</span>
              </div>
              <div ref={scrollRef} className="scrollbar-thin h-56 overflow-y-auto px-3 py-2 font-mono2 text-[11px] leading-relaxed">
                {log.map((l, i) => (
                  <div key={i} className={cn("whitespace-pre-wrap", LEVEL_COLOR[l.level])}>
                    {l.text}
                  </div>
                ))}
                {phase === "running" && <span className="inline-block h-3.5 w-2 animate-pulse bg-lime-400/70" />}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-mono2 text-[10px] text-muted-foreground">target: https://{site}</span>
              {phase === "done" ? (
                <Button size="sm" onClick={() => onOpenChange(false)} className="gap-1.5 bg-lime-400 text-black hover:bg-lime-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Done — close
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => { stopRef.current = true; }} className="text-xs text-muted-foreground">
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
