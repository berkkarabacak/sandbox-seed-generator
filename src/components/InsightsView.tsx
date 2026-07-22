import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Dataset } from "@/types";
import { datasetStats } from "@/lib/generator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TYPE_COLORS: Record<string, string> = {
  story: "#34d399",
  task: "#38bdf8",
  bug: "#fb7185",
  subtask: "#94a3b8",
  epic: "#a78bfa",
};

const STATUS_COLORS: Record<string, string> = {
  "To Do": "#94a3b8",
  "In Progress": "#38bdf8",
  "In Review": "#a78bfa",
  Blocked: "#fb7185",
  Done: "#34d399",
};

const tooltipStyle = {
  backgroundColor: "hsl(150 8% 8%)",
  border: "1px solid hsl(150 6% 18%)",
  borderRadius: 8,
  fontSize: 11,
  fontFamily: "JetBrains Mono, monospace",
};

export function InsightsView({ dataset }: { dataset: Dataset }) {
  const stats = useMemo(() => datasetStats(dataset), [dataset]);

  const typeData = (Object.keys(stats.byType) as (keyof typeof stats.byType)[])
    .filter((t) => stats.byType[t] > 0)
    .map((t) => ({ name: t, value: stats.byType[t] }));

  const statusData = stats.statusOrder.map((s) => ({ name: s, count: stats.byStatus[s] }));

  const workloadData = stats.workload.slice(0, 10).map((w) => ({
    name: w.name.split(" ")[0],
    open: w.open,
    done: w.done,
  }));

  return (
    <div className="scrollbar-thin grid h-full grid-cols-2 gap-3 overflow-y-auto p-1">
      <Card className="border-border/70 bg-card/80">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-semibold text-muted-foreground">Issues by type</CardTitle>
        </CardHeader>
        <CardContent className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={typeData} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={3} strokeWidth={0}>
                {typeData.map((d) => (
                  <Cell key={d.name} fill={TYPE_COLORS[d.name]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "#e2e8f0" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-2 pb-1">
            {typeData.map((d) => (
              <span key={d.name} className="flex items-center gap-1 text-[10px] capitalize text-muted-foreground">
                <span className="h-2 w-2 rounded-sm" style={{ background: TYPE_COLORS[d.name] }} />
                {d.name} <span className="font-mono2">{d.value}</span>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-semibold text-muted-foreground">Status distribution</CardTitle>
        </CardHeader>
        <CardContent className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statusData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid stroke="hsl(150 6% 14%)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(140 6% 55%)" }} tickLine={false} axisLine={false} interval={0} angle={-18} textAnchor="end" height={40} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(140 6% 55%)" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "#e2e8f0" }} cursor={{ fill: "hsl(150 6% 12%)" }} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {statusData.map((d) => (
                  <Cell key={d.name} fill={STATUS_COLORS[d.name]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-semibold text-muted-foreground">Created vs resolved over time</CardTitle>
        </CardHeader>
        <CardContent className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.byDay} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a3e635" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#a3e635" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gResolved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(150 6% 14%)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(140 6% 55%)" }} tickLine={false} axisLine={false} minTickGap={28} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(140 6% 55%)" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "#e2e8f0" }} />
              <Area type="monotone" dataKey="created" stroke="#a3e635" strokeWidth={1.5} fill="url(#gCreated)" />
              <Area type="monotone" dataKey="resolved" stroke="#38bdf8" strokeWidth={1.5} fill="url(#gResolved)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-semibold text-muted-foreground">Workload by persona</CardTitle>
        </CardHeader>
        <CardContent className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={workloadData} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="hsl(150 6% 14%)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 9, fill: "hsl(140 6% 55%)" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9.5, fill: "hsl(140 6% 65%)" }} tickLine={false} axisLine={false} width={52} />
              <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "#e2e8f0" }} cursor={{ fill: "hsl(150 6% 12%)" }} />
              <Bar dataKey="open" stackId="w" fill="#fbbf24" radius={[0, 0, 0, 0]} barSize={9} />
              <Bar dataKey="done" stackId="w" fill="#34d399" radius={[0, 3, 3, 0]} barSize={9} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-3 pb-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-400" /> open</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-400" /> done</span>
          </div>
        </CardContent>
      </Card>

      {stats.velocity.length > 0 && (
        <Card className="col-span-2 border-border/70 bg-card/80">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground">Sprint velocity — committed vs completed points</CardTitle>
          </CardHeader>
          <CardContent className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.velocity} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="hsl(150 6% 14%)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9.5, fill: "hsl(140 6% 55%)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "hsl(140 6% 55%)" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "#e2e8f0" }} cursor={{ fill: "hsl(150 6% 12%)" }} />
                <Bar dataKey="committed" fill="#64748b" radius={[3, 3, 0, 0]} barSize={16} />
                <Bar dataKey="completed" fill="#a3e635" radius={[3, 3, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-3 pb-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-slate-500" /> committed</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-lime-400" /> completed</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
