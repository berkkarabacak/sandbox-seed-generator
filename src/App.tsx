import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Braces,
  Bug,
  Columns3,
  Download,
  FileSpreadsheet,
  FolderKanban,
  History,
  MessageSquare,
  Rocket,
  Sprout,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import type { GenIssue, JiraConnection, JobRecord } from "@/types";
import { DEFAULT_CONFIG, datasetStats, generateDataset } from "@/lib/generator";
import { exportJiraCsv, exportJson } from "@/lib/exporters";
import { addPushRecord, configFromHash, loadPushRecords, removePushRecord, type PushRecord } from "@/lib/recipes";
import { ConnectionCard } from "@/components/ConnectionCard";
import { RecipePanel } from "@/components/RecipePanel";
import { BoardView } from "@/components/BoardView";
import { IssueTable } from "@/components/IssueTable";
import { InsightsView } from "@/components/InsightsView";
import { TeamView } from "@/components/TeamView";
import { ActivityView } from "@/components/ActivityView";
import { IssueDetailDialog } from "@/components/IssueDetailDialog";
import { PushDialog } from "@/components/PushDialog";
import { CleanupDialog } from "@/components/CleanupDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function StatPill({ icon: Icon, label, value, tone }: { icon: typeof Zap; label: string; value: number | string; tone: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-card/70 px-3.5 py-2">
      <span className={cn("flex h-7 w-7 items-center justify-center rounded-md", tone)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span>
        <span className="block font-mono2 text-sm font-bold leading-none">{value}</span>
        <span className="block text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

export default function App() {
  const [cfg, setCfg] = useState(() => configFromHash() ?? DEFAULT_CONFIG);
  const [conn, setConn] = useState<JiraConnection>({
    site: "acme-sandbox.atlassian.net",
    email: "demo@acme.dev",
    token: "",
  });
  const deferredCfg = useDeferredValue(cfg);
  const dataset = useMemo(() => generateDataset(deferredCfg), [deferredCfg]);
  const stats = useMemo(() => datasetStats(dataset), [dataset]);

  const [openIssue, setOpenIssue] = useState<GenIssue | null>(null);
  const [pushOpen, setPushOpen] = useState(false);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [projectTab, setProjectTab] = useState(0);
  const [pushes, setPushes] = useState<PushRecord[]>(loadPushRecords);
  const [cleanupTarget, setCleanupTarget] = useState<PushRecord | null>(null);

  // clear the share hash after applying it so later edits aren't confusing
  useEffect(() => {
    if (window.location.hash.startsWith("#r=")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const project = dataset.projects[Math.min(projectTab, dataset.projects.length - 1)];

  return (
    <div className="bg-grid flex h-screen flex-col overflow-hidden bg-background">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 border-b border-border/80 bg-card/60 px-5 py-3 backdrop-blur">
        <span className="glow-primary flex h-9 w-9 items-center justify-center rounded-lg bg-lime-400">
          <Sprout className="h-5 w-5 text-black" />
        </span>
        <div>
          <h1 className="text-[15px] font-extrabold leading-tight tracking-tight">
            Seedling
            <span className="ml-2 font-mono2 text-[10px] font-medium text-lime-300/80">v1.0</span>
          </h1>
          <p className="text-[11px] text-muted-foreground">
            Sandbox seed-data generator · realistic fake projects & issues for Jira Cloud demos and UAT
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Whole dataset
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => exportJson(dataset)} className="gap-2 text-xs">
                <Braces className="h-3.5 w-3.5 text-lime-300" />
                JSON — all {dataset.projects.length} projects
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Jira CSV import format
              </DropdownMenuLabel>
              {dataset.projects.map((p) => (
                <DropdownMenuItem key={p.key} onClick={() => exportJiraCsv(p)} className="gap-2 text-xs">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-sky-300" />
                  CSV — {p.key} ({p.issues.length + p.epics.length} rows)
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            className="glow-primary h-8 gap-1.5 bg-lime-400 text-xs font-bold text-black hover:bg-lime-300"
            onClick={() => setPushOpen(true)}
          >
            <Rocket className="h-3.5 w-3.5" />
            Generate & push to Jira
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ── Left rail ────────────────────────────────────────── */}
        <aside className="scrollbar-thin w-[380px] shrink-0 space-y-3 overflow-y-auto border-r border-border/80 p-3">
          <ConnectionCard conn={conn} onChange={setConn} />
          <RecipePanel cfg={cfg} onChange={setCfg} />

          {/* job history */}
          <div className="rounded-lg border border-border/80 bg-card/80 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              Recent runs
            </div>
            {jobs.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/70">
                Nothing pushed yet — dry-runs and live pushes land here.
              </p>
            ) : (
              <div className="space-y-1.5">
                {jobs.slice(0, 5).map((j) => (
                  <div key={j.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5 text-[11px]">
                    <span className="font-mono2 text-lime-300">{j.projects} proj</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="font-mono2 text-sky-300">{j.issues} issues</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="font-mono2 text-violet-300">{j.comments} cmt</span>
                    <span
                      className={cn(
                        "ml-auto rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                        j.mode === "live" ? "bg-rose-400/10 text-rose-300" : "bg-amber-400/10 text-amber-300",
                      )}
                    >
                      {j.mode}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* sandbox cleanup */}
          {pushes.length > 0 && (
            <div className="rounded-lg border border-rose-400/25 bg-card/80 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                Jira cleanup
                <span className="ml-auto font-mono2 text-[9.5px] font-normal text-muted-foreground">
                  {pushes.length} live push{pushes.length > 1 ? "es" : ""} on record
                </span>
              </div>
              <div className="space-y-1.5">
                {pushes.slice(0, 4).map((r) => (
                  <div key={r.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5 text-[11px]">
                    <span className="font-mono2 text-rose-300">{r.projectKeys.join(",")}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="font-mono2 text-sky-300">{r.issueCount} issues</span>
                    <span className="ml-auto text-[9.5px] text-muted-foreground/70">
                      {new Date(r.at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => setCleanupTarget(r)}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-rose-400/10 hover:text-rose-300"
                      title="Delete this seed data from Jira"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[9.5px] leading-snug text-muted-foreground/70">
                Records persist locally so you can clean the sandbox even days later.
              </p>
            </div>
          )}
        </aside>

        {/* ── Main ─────────────────────────────────────────────── */}
        <main className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          {/* stats strip */}
          <div className="flex flex-wrap items-center gap-2.5">
            <StatPill icon={FolderKanban} label="Projects" value={dataset.projects.length} tone="bg-violet-500/15 text-violet-300" />
            <StatPill icon={Zap} label="Issues" value={stats.issues} tone="bg-lime-400/15 text-lime-300" />
            <StatPill icon={Bug} label="Bugs" value={stats.byType.bug} tone="bg-rose-500/15 text-rose-300" />
            <StatPill icon={MessageSquare} label="Comments" value={stats.comments} tone="bg-sky-500/15 text-sky-300" />
            <StatPill icon={Users} label="Personas" value={dataset.people.length} tone="bg-amber-500/15 text-amber-300" />
            <span className="ml-auto hidden items-center gap-1.5 font-mono2 text-[10px] text-muted-foreground lg:flex">
              <Columns3 className="h-3 w-3" />
              seed #{deferredCfg.seed} · {deferredCfg.scenario} · {deferredCfg.domain}
            </span>
          </div>

          {/* project tabs */}
          {dataset.projects.length > 1 && (
            <div className="flex gap-1.5">
              {dataset.projects.map((p, i) => (
                <button
                  key={p.key}
                  onClick={() => setProjectTab(i)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                    i === projectTab || (projectTab >= dataset.projects.length && i === 0)
                      ? "border-lime-400/50 bg-lime-400/10 text-lime-200"
                      : "border-border bg-card/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="font-mono2 mr-1.5 text-[10px] opacity-70">{p.key}</span>
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {/* views */}
          <Tabs defaultValue="board" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="w-fit bg-card/80">
              <TabsTrigger value="board" className="text-xs data-[state=active]:bg-lime-400/15 data-[state=active]:text-lime-200">Board</TabsTrigger>
              <TabsTrigger value="issues" className="text-xs data-[state=active]:bg-lime-400/15 data-[state=active]:text-lime-200">All issues</TabsTrigger>
              <TabsTrigger value="insights" className="text-xs data-[state=active]:bg-lime-400/15 data-[state=active]:text-lime-200">Insights</TabsTrigger>
              <TabsTrigger value="team" className="text-xs data-[state=active]:bg-lime-400/15 data-[state=active]:text-lime-200">
                <Users className="mr-1 h-3 w-3" />Team
              </TabsTrigger>
              <TabsTrigger value="activity" className="text-xs data-[state=active]:bg-lime-400/15 data-[state=active]:text-lime-200">
                <Activity className="mr-1 h-3 w-3" />Activity
              </TabsTrigger>
            </TabsList>
            <div className="mt-2.5 min-h-0 flex-1 rounded-xl border border-border/80 bg-background/50 p-2.5">
              <TabsContent value="board" className="m-0 h-full data-[state=inactive]:hidden">
                <BoardView project={project} onOpenIssue={setOpenIssue} />
              </TabsContent>
              <TabsContent value="issues" className="m-0 h-full data-[state=inactive]:hidden">
                <IssueTable project={project} onOpenIssue={setOpenIssue} />
              </TabsContent>
              <TabsContent value="insights" className="m-0 h-full data-[state=inactive]:hidden">
                <InsightsView dataset={dataset} />
              </TabsContent>
              <TabsContent value="team" className="m-0 h-full data-[state=inactive]:hidden">
                <TeamView dataset={dataset} />
              </TabsContent>
              <TabsContent value="activity" className="m-0 h-full data-[state=inactive]:hidden">
                <ActivityView dataset={dataset} />
              </TabsContent>
            </div>
          </Tabs>
        </main>
      </div>

      <IssueDetailDialog issue={openIssue} onClose={() => setOpenIssue(null)} />
      <PushDialog
        open={pushOpen}
        onOpenChange={setPushOpen}
        dataset={dataset}
        conn={conn}
        onComplete={(durationMs, mode, result) => {
          const totalComments = dataset.projects.reduce((s, p) => s + p.issues.reduce((a, i) => a + i.comments.length, 0), 0);
          setJobs((js) => [
            {
              id: `job-${Date.now()}`,
              at: new Date(),
              site: conn.site,
              projects: dataset.projects.length,
              issues: stats.issues,
              comments: totalComments,
              mode,
              durationMs,
            },
            ...js,
          ]);
          if (mode === "live" && result && !result.aborted && result.projectKeys.length > 0) {
            setPushes(
              addPushRecord({
                id: `push-${Date.now()}`,
                at: Date.now(),
                site: conn.site.trim().toLowerCase(),
                projectKeys: result.projectKeys,
                issueKeys: result.issueKeys,
                issueCount: result.issuesCreated,
                commentCount: result.commentsCreated,
              }),
            );
          }
        }}
      />
      <CleanupDialog
        record={cleanupTarget}
        conn={conn}
        onClose={() => setCleanupTarget(null)}
        onRemoved={(id) => setPushes(removePushRecord(id))}
      />
    </div>
  );
}
