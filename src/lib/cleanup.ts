import type { JiraConnection } from "@/types";
import type { LiveLog } from "./jiraClient";
import type { PushRecord } from "./recipes";

// Deletion goes through the same local proxy as live push.
export type DelFn = (conn: JiraConnection, path: string) => Promise<number>;

async function del(conn: JiraConnection, path: string): Promise<number> {
  const resp = await fetch(`/jira${path}`, {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      "x-jira-site": conn.site.trim().toLowerCase(),
      "x-jira-email": conn.email.trim(),
      "x-jira-token": conn.token.trim(),
    },
  });
  return resp.status;
}

export interface GetResp<T = unknown> {
  ok: boolean;
  status: number;
  json: T;
}

export async function jiraGet<T = unknown>(conn: JiraConnection, path: string): Promise<GetResp<T>> {
  const resp = await fetch(`/jira${path}`, {
    headers: {
      "content-type": "application/json",
      "x-jira-site": conn.site.trim().toLowerCase(),
      "x-jira-email": conn.email.trim(),
      "x-jira-token": conn.token.trim(),
    },
  });
  const text = await resp.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { ok: resp.ok, status: resp.status, json: json as T };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface CleanupResult {
  issuesDeleted: number;
  projectsDeleted: number;
  failed: number;
}

/**
 * Remove everything a previous live push created.
 * Strategy: delete whole projects when permitted (1 call each);
 * otherwise fall back to deleting issues one by one.
 */
export async function cleanupPush(
  conn: JiraConnection,
  record: PushRecord,
  log: LiveLog,
  shouldStop: () => boolean,
  delFn: DelFn = del,
): Promise<CleanupResult> {
  const res: CleanupResult = { issuesDeleted: 0, projectsDeleted: 0, failed: 0 };

  log("info", `$ seedling cleanup --site ${record.site} --push ${record.id}`);
  log("warn", `This will permanently delete ${record.projectKeys.length} project(s) or ${record.issueKeys.length} issue(s).`);

  const fallbackProjects: string[] = [];
  for (const key of record.projectKeys) {
    if (shouldStop()) break;
    log("info", `DELETE /rest/api/3/project/${key}`);
    const status = await delFn(conn, `/rest/api/3/project/${key}`);
    if (status === 204 || status === 202 || status === 200) {
      res.projectsDeleted++;
      log("ok", `  ✓ project ${key} deleted`);
    } else if (status === 404) {
      log("warn", `  ! project ${key} already gone (404)`);
    } else {
      log("warn", `  ! project ${key}: HTTP ${status} — falling back to per-issue deletion`);
      fallbackProjects.push(key);
    }
    await sleep(120);
  }

  // Per-project fallback: only delete issues belonging to projects whose
  // project-level delete failed (or all issues when no projects were pushed).
  const fallbackKeys =
    record.projectKeys.length === 0
      ? record.issueKeys
      : record.issueKeys.filter((k) => fallbackProjects.some((p) => k.startsWith(`${p}-`)));
  if (fallbackKeys.length > 0) {
    for (const key of fallbackKeys) {
      if (shouldStop()) break;
      const status = await delFn(conn, `/rest/api/3/issue/${key}?deleteSubtasks=true`);
      if (status === 204 || status === 200) {
        res.issuesDeleted++;
        if (res.issuesDeleted % 25 === 0) log("info", `  … ${res.issuesDeleted} issues deleted`);
      } else if (status !== 404) {
        res.failed++;
        log("warn", `  ! ${key}: HTTP ${status}`);
      }
      await sleep(60);
    }
    log("ok", `  ✓ ${res.issuesDeleted} issues deleted${res.failed ? ` · ${res.failed} failed` : ""}`);
  }

  log(res.failed ? "warn" : "ok", res.failed ? `Cleanup finished with ${res.failed} failure(s).` : "✔ Sandbox is clean.");
  return res;
}
