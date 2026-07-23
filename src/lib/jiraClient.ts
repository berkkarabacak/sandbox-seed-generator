import type { Dataset, GenIssue, JiraConnection } from "@/types";
import { toAdfDoc } from "./adf";
import {
  buildIssueFields,
  detectProjectStyle,
  discoverFieldMap,
  type FieldMap,
  type IssuePayloadCtx,
  type JiraFieldDef,
  type JiraProjectMeta,
} from "./jiraFields";

export { toAdfDoc };

/**
 * Live Jira Cloud client.
 * All calls go to `/jira/*`, which the vite dev server proxies to the local
 * relay (server/jira-proxy.mjs). The relay injects Basic auth server-side.
 */

export interface JiraResp<T = unknown> {
  ok: boolean;
  status: number;
  json: T;
  latencyMs: number;
}

async function jiraFetch<T = unknown>(
  conn: JiraConnection,
  method: string,
  path: string,
  body?: unknown,
): Promise<JiraResp<T>> {
  const t0 = performance.now();
  const resp = await fetch(`/jira${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-jira-site": conn.site.trim().toLowerCase(),
      "x-jira-email": conn.email.trim(),
      "x-jira-token": conn.token.trim(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await resp.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text.slice(0, 400) };
  }
  return { ok: resp.ok, status: resp.status, json: json as T, latencyMs: Math.round(performance.now() - t0) };
}

export async function probeProxy(): Promise<boolean> {
  try {
    const r = await fetch("/jira/health", { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

export interface Myself {
  accountId: string;
  displayName: string;
  emailAddress?: string;
}

export function getMyself(conn: JiraConnection) {
  return jiraFetch<Myself>(conn, "GET", "/rest/api/3/myself");
}

// ─── Live push orchestration ──────────────────────────────────────────────────

export type LiveLog = (level: "info" | "ok" | "warn" | "err", text: string) => void;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface LiveResult {
  projectKeys: string[];
  issueKeys: string[];
  issuesCreated: number;
  commentsCreated: number;
  linksCreated: number;
  aborted: boolean;
}

const COMMENT_CAP_PER_ISSUE = 2;
const COMMENT_CAP_TOTAL = 120;

export async function livePush(
  conn: JiraConnection,
  dataset: Dataset,
  log: LiveLog,
  shouldStop: () => boolean,
  onStep: (i: number) => void = () => {},
): Promise<LiveResult> {
  const result: LiveResult = { projectKeys: [], issueKeys: [], issuesCreated: 0, commentsCreated: 0, linksCreated: 0, aborted: false };

  // 1 ── auth
  onStep(0);
  log("info", `GET /rest/api/3/myself → https://${conn.site}`);
  const me = await getMyself(conn);
  if (!me.ok) {
    log("err", `  ✗ auth failed (${me.status}) — check email + API token`);
    result.aborted = true;
    return result;
  }
  log("ok", `  ✓ authenticated as ${me.json.displayName} (${me.latencyMs}ms)`);
  const leadAccountId = me.json.accountId;

  for (const project of dataset.projects) {
    if (shouldStop()) break;

    // 2 ── project
    onStep(1);
    log("info", `POST /rest/api/3/project { key: "${project.key}" }`);
    const projResp = await jiraFetch<{ id: string; key: string }>(conn, "POST", "/rest/api/3/project", {
      key: project.key,
      name: project.name,
      description: project.description,
      projectTypeKey: "software",
      projectTemplateKey: "com.pyxis.greenhopper.jira:gh-simplified-agility-scrum",
      leadAccountId,
      assigneeType: "UNASSIGNED",
    });
    if (!projResp.ok) {
      const msg = (projResp.json as { errorMessages?: string[] }).errorMessages?.join("; ") || `HTTP ${projResp.status}`;
      log("err", `  ✗ project ${project.key} failed: ${msg}`);
      log("warn", "  ↳ needs Jira admin permission to create projects — aborting");
      result.aborted = true;
      return result;
    }
    result.projectKeys.push(project.key);
    log("ok", `  ✓ project ${project.key} "${project.name}" created`);

    // 2b ── style & field discovery (team-managed vs company-managed)
    const metaResp = await jiraFetch<JiraProjectMeta>(conn, "GET", `/rest/api/3/project/${project.key}`);
    const style = metaResp.ok ? detectProjectStyle(metaResp.json) : "team-managed";
    const fieldsResp = await jiraFetch<JiraFieldDef[]>(conn, "GET", "/rest/api/3/field");
    const fieldMap: FieldMap = fieldsResp.ok ? discoverFieldMap(fieldsResp.json) : {};
    log(
      "info",
      `  ↳ style: ${style} · fields: epic-link=${fieldMap.epicLink ?? "—"}, points=${fieldMap.storyPoints ?? "—"}, sprint=${fieldMap.sprint ?? "—"}`,
    );

    // 3 ── sprints (best effort: needs a board)
    onStep(2);
    const sprintIds = new Map<string, number>();
    let boardId: number | null = null;
    const boards = await jiraFetch<{ values: { id: number }[] }>(
      conn, "GET", `/rest/agile/1.0/board?projectKeyOrId=${project.key}`,
    );
    if (boards.ok && boards.json.values?.length) {
      boardId = boards.json.values[0].id;
      for (const s of project.sprints) {
        const sr = await jiraFetch<{ id?: number }>(conn, "POST", "/rest/agile/1.0/sprint", {
          name: s.name,
          originBoardId: boardId,
          goal: s.goal,
        });
        if (sr.ok) {
          if (typeof sr.json.id === "number") sprintIds.set(s.name, sr.json.id);
          log("ok", `  ✓ sprint "${s.name}"`);
        } else {
          log("warn", `  ! sprint "${s.name}" skipped (${sr.status})`);
        }
      }
    } else if (project.sprints.length) {
      log("warn", "  ! no agile board found — sprints recorded in seed metadata only");
    }

    // 3b ── components & versions (best effort)
    for (const c of project.components) {
      const r = await jiraFetch(conn, "POST", "/rest/api/3/component", { name: c, project: project.key });
      if (!r.ok && r.status !== 400) log("warn", `  ! component "${c}" skipped (${r.status})`);
      await sleep(40);
    }
    for (const v of project.versions) {
      const r = await jiraFetch(conn, "POST", "/rest/api/3/version", { name: v.name, project: project.key, released: v.released });
      log(r.ok ? "ok" : "warn", r.ok ? `  ✓ version ${v.name}${v.released ? " (released)" : ""}` : `  ! version ${v.name} skipped (${r.status})`);
      await sleep(40);
    }
    if (project.components.length) log("ok", `  ✓ ${project.components.length} components created`);

    // 4 ── assignable users (round-robin real users when the sandbox has them)
    const assignables = await jiraFetch<{ accountId: string; displayName: string }[]>(
      conn, "GET", `/rest/api/3/user/assignable/search?project=${project.key}&maxResults=50`,
    );
    const realUsers = assignables.ok ? assignables.json.filter((u) => u.accountId) : [];
    if (realUsers.length) {
      log("info", `  ↳ distributing issues across ${realUsers.length} real sandbox user(s)`);
    } else {
      log("warn", "  ! no assignable users — issues left unassigned (personas kept in seed metadata)");
    }

    // 5 ── epics first (real key map)
    const keyMap = new Map<string, string>(); // generated key → real key
    for (const epic of project.epics) {
      if (shouldStop()) break;
      const r = await jiraFetch<{ key: string }>(conn, "POST", "/rest/api/3/issue", {
        fields: {
          project: { key: project.key },
          issuetype: { name: "Epic" },
          summary: epic.title,
          description: toAdfDoc(`Epic: ${epic.title}`),
        },
      });
      if (r.ok) {
        keyMap.set(epic.key, (r.json as { key: string }).key);
        log("ok", `  ✓ epic ${(r.json as { key: string }).key} "${epic.title}"`);
      } else {
        log("warn", `  ! epic "${epic.title}" failed (${r.status}) — children will go in without a parent`);
      }
      await sleep(60);
    }

    // 6 ── issues in bulk chunks (parents first, sub-tasks last)
    onStep(3);
    const parents = project.issues.filter((i) => i.type !== "subtask");
    const subs = project.issues.filter((i) => i.type === "subtask");

    const toPayload = (i: GenIssue, idx: number) => {
      const ctx: IssuePayloadCtx = {
        projectKey: project.key,
        style,
        fieldMap,
        epicRealKey: i.epicKey ? keyMap.get(i.epicKey) ?? null : null,
        parentRealKey: i.parentKey ? keyMap.get(i.parentKey) ?? null : null,
        sprintId: i.sprint ? sprintIds.get(i.sprint) ?? null : null,
        assigneeAccountId: realUsers.length && i.assignee ? realUsers[idx % realUsers.length].accountId : null,
      };
      return { fields: buildIssueFields(i, ctx) };
    };

    let userIdx = 0;
    const pushChunk = async (chunk: GenIssue[], tag: string) => {
      const r = await jiraFetch<{ issues: { key: string }[]; errors: unknown[] }>(
        conn, "POST", "/rest/api/3/issue/bulk",
        { issueUpdates: chunk.map((i) => toPayload(i, userIdx++)) },
      );
      if (r.ok && r.json.issues) {
        r.json.issues.forEach((created, k) => keyMap.set(chunk[k].key, created.key));
        result.issuesCreated += r.json.issues.length;
        log("ok", `  ✓ bulk ${tag}: ${r.json.issues.length} issues → ${r.json.issues[0].key}…`);
      } else {
        log("err", `  ✗ bulk ${tag} failed (${r.status}) — retrying issue-by-issue`);
        for (const issue of chunk) {
          const single = await jiraFetch<{ key: string }>(conn, "POST", "/rest/api/3/issue", toPayload(issue, userIdx++));
          if (single.ok) {
            keyMap.set(issue.key, (single.json as { key: string }).key);
            result.issuesCreated++;
          } else {
            log("warn", `    ! skipped "${issue.summary.slice(0, 48)}…" (${single.status})`);
          }
          await sleep(80);
        }
      }
    };

    for (let c = 0; c < parents.length; c += 50) {
      if (shouldStop()) break;
      await pushChunk(parents.slice(c, c + 50), `${project.key} batch ${c / 50 + 1}`);
      await sleep(150);
    }
    for (let c = 0; c < subs.length; c += 50) {
      if (shouldStop()) break;
      await pushChunk(subs.slice(c, c + 50), `${project.key} sub-tasks ${c / 50 + 1}`);
      await sleep(150);
    }

    // 7 ── comments (capped to stay friendly with rate limits)
    onStep(4);
    let commentBudget = COMMENT_CAP_TOTAL;
    for (const issue of project.issues) {
      if (shouldStop() || commentBudget <= 0) break;
      const realKey = keyMap.get(issue.key);
      if (!realKey) continue;
      for (const c of issue.comments.slice(0, COMMENT_CAP_PER_ISSUE)) {
        if (commentBudget-- <= 0) break;
        const r = await jiraFetch(conn, "POST", `/rest/api/3/issue/${realKey}/comment`, {
          body: toAdfDoc(`${c.body}\n\n— ${c.author.name} (seed persona)`),
        });
        if (r.ok) result.commentsCreated++;
        await sleep(50);
      }
    }
    if (commentBudget <= 0) {
      log("warn", `  ! comment budget reached (${COMMENT_CAP_TOTAL}/project) — remaining comments kept in export only`);
    }
    log("ok", `  ✓ ${result.commentsCreated} comments posted in ${project.key}`);

    // 8 ── typed issue links (skip reciprocal halves; the forward link creates both sides)
    const LINK_DEF: Record<string, { name: string }> = {
      "relates to": { name: "Relates" },
      blocks: { name: "Blocks" },
      duplicates: { name: "Duplicate" },
      clones: { name: "Cloners" },
    };
    for (const issue of project.issues) {
      const from = keyMap.get(issue.key);
      if (!from) continue;
      for (const link of issue.links.slice(0, 3)) {
        const def = LINK_DEF[link.type];
        const to = keyMap.get(link.key);
        if (!def || !to) continue; // reciprocal halves ("is blocked by"…) are implicit
        const r = await jiraFetch(conn, "POST", "/rest/api/3/issueLink", {
          type: { name: def.name },
          outwardIssue: { key: from },
          inwardIssue: { key: to },
        });
        if (r.ok || r.status === 201) result.linksCreated++;
        await sleep(40);
      }
    }
    if (result.linksCreated) log("ok", `  ✓ ${result.linksCreated} issue links created`);

    result.issueKeys.push(...keyMap.values());
  }

  onStep(5);
  return result;
}
