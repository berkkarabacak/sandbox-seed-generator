import { Bug, Columns3, Dices, Headset, KanbanSquare, Rocket, SlidersHorizontal } from "lucide-react";
import type { DetailLevel, DomainId, ScenarioId, SeedConfig } from "@/types";
import { DOMAINS, SCENARIOS } from "@/lib/domains";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const SCENARIO_ICONS: Record<ScenarioId, typeof Bug> = {
  scrum: KanbanSquare,
  kanban: Columns3,
  bugbash: Bug,
  servicedesk: Headset,
  launch: Rocket,
};

function Row({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="font-mono2 text-[11px] font-semibold text-lime-300">{value}</span>
      </div>
      {children}
    </div>
  );
}

export function RecipePanel({
  cfg,
  onChange,
}: {
  cfg: SeedConfig;
  onChange: (c: SeedConfig) => void;
}) {
  const set = <K extends keyof SeedConfig>(k: K, v: SeedConfig[K]) => onChange({ ...cfg, [k]: v });

  return (
    <Card className="border-border/80 bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="h-4 w-4 text-lime-400" />
          Seed recipe
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-7 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-lime-300"
            onClick={() => set("seed", Math.floor(Math.random() * 99999))}
            title="Re-roll the random seed"
          >
            <Dices className="h-3.5 w-3.5" />
            Shuffle
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Scenario */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Scenario template</Label>
          <div className="grid grid-cols-1 gap-1.5">
            {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => {
              const meta = SCENARIOS[id];
              const Icon = SCENARIO_ICONS[id];
              const active = cfg.scenario === id;
              return (
                <button
                  key={id}
                  onClick={() => set("scenario", id)}
                  className={cn(
                    "group flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-all",
                    active
                      ? "border-lime-400/50 bg-lime-400/[0.07] glow-primary"
                      : "border-border bg-background/40 hover:border-muted-foreground/40",
                  )}
                >
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-lime-300" : "text-muted-foreground")} />
                  <span>
                    <span className={cn("block text-xs font-semibold", active && "text-lime-200")}>{meta.label}</span>
                    <span className="block text-[10.5px] leading-snug text-muted-foreground">{meta.blurb}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Domain */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Content domain (AI theme)</Label>
          <Select value={cfg.domain} onValueChange={(v) => set("domain", v as DomainId)}>
            <SelectTrigger className="h-8 bg-background/60 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(DOMAINS) as DomainId[]).map((id) => (
                <SelectItem key={id} value={id} className="text-xs">
                  <span className="font-medium">{DOMAINS[id].label}</span>
                  <span className="ml-2 text-muted-foreground">{DOMAINS[id].blurb}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Scale */}
        <div className="space-y-4 rounded-lg border border-border/70 bg-background/40 p-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Scale</span>
          <Row label="Projects" value={String(cfg.projectCount)}>
            <Slider value={[cfg.projectCount]} min={1} max={4} step={1} onValueChange={([v]) => set("projectCount", v)} />
          </Row>
          <Row label="Issues per project" value={String(cfg.issuesPerProject)}>
            <Slider value={[cfg.issuesPerProject]} min={10} max={160} step={2} onValueChange={([v]) => set("issuesPerProject", v)} />
          </Row>
          <Row label="Team personas" value={String(cfg.teamSize)}>
            <Slider value={[cfg.teamSize]} min={3} max={12} step={1} onValueChange={([v]) => set("teamSize", v)} />
          </Row>
        </div>

        {/* Realism */}
        <div className="space-y-4 rounded-lg border border-border/70 bg-background/40 p-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Realism</span>
          <Row label="Comment density" value={`${cfg.commentDensity}%`}>
            <Slider value={[cfg.commentDensity]} min={0} max={100} step={5} onValueChange={([v]) => set("commentDensity", v)} />
          </Row>
          <Row label="History spread" value={`${cfg.spreadWeeks} wks`}>
            <Slider value={[cfg.spreadWeeks]} min={1} max={16} step={1} onValueChange={([v]) => set("spreadWeeks", v)} />
          </Row>
          <Row label="Chaos (blockers, stale work)" value={`${cfg.chaos}%`}>
            <Slider value={[cfg.chaos]} min={0} max={100} step={5} onValueChange={([v]) => set("chaos", v)} />
          </Row>
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs text-muted-foreground">Narrative depth</Label>
            <ToggleGroup
              type="single"
              value={cfg.detail}
              onValueChange={(v) => v && set("detail", v as DetailLevel)}
              className="justify-start"
            >
              {(["terse", "balanced", "verbose"] as DetailLevel[]).map((d) => (
                <ToggleGroupItem
                  key={d}
                  value={d}
                  className="h-7 px-3 text-[11px] capitalize data-[state=on]:bg-lime-400/15 data-[state=on]:text-lime-200"
                >
                  {d}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        {/* Toggles */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
          {(
            [
              ["withSprints", "Sprints"],
              ["withStoryPoints", "Story points"],
              ["withLabels", "Labels"],
              ["withLinks", "Issue links"],
            ] as const
          ).map(([k, label]) => (
            <div key={k} className="flex items-center justify-between rounded-md border border-border/70 bg-background/40 px-2.5 py-2">
              <Label htmlFor={k} className="text-[11px] text-muted-foreground">{label}</Label>
              <Switch id={k} checked={cfg[k]} onCheckedChange={(v) => set(k, v)} className="scale-90" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
