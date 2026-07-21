import { useEffect, useState } from "react";
import { CheckCircle2, Cloud, Loader2, PlugZap, ServerCrash, XCircle } from "lucide-react";
import type { JiraConnection } from "@/types";
import { getMyself, probeProxy } from "@/lib/jiraClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TestState = "idle" | "testing" | "ok" | "fail" | "no-proxy";

export function ConnectionCard({
  conn,
  onChange,
}: {
  conn: JiraConnection;
  onChange: (c: JiraConnection) => void;
}) {
  const [state, setState] = useState<TestState>("idle");
  const [latency, setLatency] = useState<number | null>(null);
  const [who, setWho] = useState<string | null>(null);
  const [proxyUp, setProxyUp] = useState<boolean | null>(null);

  useEffect(() => {
    probeProxy().then(setProxyUp);
  }, []);

  const test = async () => {
    setState("testing");
    setLatency(null);
    setWho(null);
    const up = await probeProxy();
    setProxyUp(up);
    if (!up) {
      setState("no-proxy");
      return;
    }
    const r = await getMyself(conn);
    setLatency(r.latencyMs);
    if (r.ok) {
      setWho(r.json.displayName);
      setState("ok");
    } else {
      setState("fail");
    }
  };

  return (
    <Card className="border-border/80 bg-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Cloud className="h-4 w-4 text-sky-400" />
          Jira Cloud target
          <span
            className={cn(
              "ml-auto inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium",
              state === "ok"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-border bg-secondary text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                state === "ok" ? "bg-emerald-400 pulse-dot" : "bg-muted-foreground/50",
              )}
            />
            {state === "ok" ? `connected · ${latency}ms` : "not connected"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="site" className="text-xs text-muted-foreground">Site</Label>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">https://</span>
            <Input
              id="site"
              value={conn.site}
              onChange={(e) => {
                onChange({ ...conn, site: e.target.value });
                setState("idle");
              }}
              placeholder="your-team.atlassian.net"
              className="h-8 flex-1 bg-background/60 font-mono2 text-xs"
              spellCheck={false}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs text-muted-foreground">Account email</Label>
            <Input
              id="email"
              value={conn.email}
              onChange={(e) => {
                onChange({ ...conn, email: e.target.value });
                setState("idle");
              }}
              placeholder="you@company.com"
              className="h-8 bg-background/60 font-mono2 text-xs"
              spellCheck={false}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="token" className="text-xs text-muted-foreground">API token</Label>
            <Input
              id="token"
              type="password"
              value={conn.token}
              onChange={(e) => {
                onChange({ ...conn, token: e.target.value });
                setState("idle");
              }}
              placeholder="ATATT3x…"
              className="h-8 bg-background/60 font-mono2 text-xs"
              spellCheck={false}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={test}
            disabled={state === "testing"}
            className="h-8 gap-1.5 text-xs"
          >
            {state === "testing" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlugZap className="h-3.5 w-3.5" />
            )}
            Test connection
          </Button>
          {state === "ok" && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> {who ?? "Authenticated"}
            </span>
          )}
          {state === "fail" && (
            <span className="flex items-center gap-1 text-[11px] text-rose-300">
              <XCircle className="h-3.5 w-3.5" /> Auth failed — check site, email & token
            </span>
          )}
          {state === "no-proxy" && (
            <span className="flex items-center gap-1 text-[11px] text-amber-300">
              <ServerCrash className="h-3.5 w-3.5" /> Proxy offline
            </span>
          )}
        </div>
        <p className="text-[10.5px] leading-relaxed text-muted-foreground/80">
          {proxyUp === false ? (
            <>
              Local proxy not detected — run <code className="rounded bg-secondary px-1 font-mono2 text-[10px] text-lime-200">npm run proxy</code> in
              the project folder, then test again. Dry-run mode works without it.
            </>
          ) : (
            <>
              Live pushes relay through your local proxy (<span className="font-mono2">localhost:8787</span>) — the
              token never leaves your machine and is never stored.
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
