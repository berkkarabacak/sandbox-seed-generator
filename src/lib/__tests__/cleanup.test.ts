import { describe, expect, it } from "vitest";
import type { JiraConnection } from "@/types";
import type { PushRecord } from "../recipes";
import { cleanupPush, type DelFn } from "../cleanup";

const CONN: JiraConnection = { site: "example.atlassian.net", email: "a@b.c", token: "tok" };

function record(over: Partial<PushRecord> = {}): PushRecord {
  return {
    id: "push-1",
    at: Date.now(),
    site: "example.atlassian.net",
    projectKeys: ["DEMO"],
    issueKeys: ["DEMO-1", "DEMO-2", "DEMO-3"],
    issueCount: 3,
    commentCount: 5,
    ...over,
  };
}

const noopLog = () => {};

/** Scripted delFn: maps path → status; records every call. */
function fakeDel(script: Record<string, number>) {
  const calls: string[] = [];
  const delFn: DelFn = async (_conn, path) => {
    calls.push(path);
    const status = script[path];
    if (status === undefined) throw new Error(`unscripted DELETE ${path}`);
    return status;
  };
  return { calls, delFn };
}

const issuePath = (key: string) => `/rest/api/3/issue/${key}?deleteSubtasks=true`;
const projectPath = (key: string) => `/rest/api/3/project/${key}`;

describe("cleanupPush orchestration", () => {
  it("project delete 204 → no per-issue deletes, reports success", async () => {
    const { calls, delFn } = fakeDel({ [projectPath("DEMO")]: 204 });
    const res = await cleanupPush(CONN, record(), noopLog, () => false, delFn);
    expect(calls).toEqual([projectPath("DEMO")]);
    expect(res).toEqual({ issuesDeleted: 0, projectsDeleted: 1, failed: 0 });
  });

  it("project delete 403 → falls back to per-issue deletion with correct counts", async () => {
    const { calls, delFn } = fakeDel({
      [projectPath("DEMO")]: 403,
      [issuePath("DEMO-1")]: 204,
      [issuePath("DEMO-2")]: 500,
      [issuePath("DEMO-3")]: 404, // already gone → silently skipped
    });
    const res = await cleanupPush(CONN, record(), noopLog, () => false, delFn);
    expect(calls).toEqual([projectPath("DEMO"), issuePath("DEMO-1"), issuePath("DEMO-2"), issuePath("DEMO-3")]);
    expect(res).toEqual({ issuesDeleted: 1, projectsDeleted: 0, failed: 1 });
  });

  it("project delete 404 → treated as already gone, no issue deletes", async () => {
    const { calls, delFn } = fakeDel({ [projectPath("DEMO")]: 404 });
    const res = await cleanupPush(CONN, record(), noopLog, () => false, delFn);
    expect(calls).toEqual([projectPath("DEMO")]);
    expect(res).toEqual({ issuesDeleted: 0, projectsDeleted: 0, failed: 0 });
  });

  it("mixed projects: fallback is per-project — only the failed project's issues are deleted", async () => {
    // AAA deletes cleanly; BBB gets 403 → per-issue fallback applies to BBB's
    // issues only (AAA's issues are gone with the project).
    const rec = record({
      projectKeys: ["AAA", "BBB"],
      issueKeys: ["AAA-1", "BBB-1", "BBB-2"],
    });
    const { calls, delFn } = fakeDel({
      [projectPath("AAA")]: 204,
      [projectPath("BBB")]: 403,
      [issuePath("BBB-1")]: 204,
      [issuePath("BBB-2")]: 204,
    });
    const res = await cleanupPush(CONN, rec, noopLog, () => false, delFn);
    expect(calls).toEqual([projectPath("AAA"), projectPath("BBB"), issuePath("BBB-1"), issuePath("BBB-2")]);
    expect(res).toEqual({ issuesDeleted: 2, projectsDeleted: 1, failed: 0 });
  });

  it("shouldStop() aborts per-issue deletion", async () => {
    const { calls, delFn } = fakeDel({
      [projectPath("DEMO")]: 403,
      [issuePath("DEMO-1")]: 204,
      [issuePath("DEMO-2")]: 204,
      [issuePath("DEMO-3")]: 204,
    });
    let n = 0;
    const res = await cleanupPush(CONN, record(), noopLog, () => ++n > 2, delFn);
    // project call + first issue call happen, then stop
    expect(calls).toEqual([projectPath("DEMO"), issuePath("DEMO-1")]);
    expect(res.issuesDeleted).toBe(1);
    expect(res.projectsDeleted).toBe(0);
  });

  it("shouldStop() before anything prevents all deletes", async () => {
    const { calls, delFn } = fakeDel({ [projectPath("DEMO")]: 204 });
    const res = await cleanupPush(CONN, record(), noopLog, () => true, delFn);
    expect(calls).toEqual([]);
    expect(res).toEqual({ issuesDeleted: 0, projectsDeleted: 0, failed: 0 });
  });
});
