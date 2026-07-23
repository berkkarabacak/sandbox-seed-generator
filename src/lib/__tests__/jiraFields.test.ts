import { describe, expect, it } from "vitest";
import type { GenIssue } from "@/types";
import { DEFAULT_CONFIG, generateDataset } from "../generator";
import {
  buildIssueFields,
  detectProjectStyle,
  discoverFieldMap,
  type IssuePayloadCtx,
  type JiraFieldDef,
} from "../jiraFields";

const FIXED_NOW = 1_752_000_000_000;

function sampleIssue(over: Partial<GenIssue> = {}): GenIssue {
  const ds = generateDataset({ ...DEFAULT_CONFIG, projectCount: 1, issuesPerProject: 20, seed: 5 }, FIXED_NOW);
  const base = ds.projects[0].issues.find((i) => i.type !== "subtask")!;
  return { ...base, ...over };
}

function ctx(over: Partial<IssuePayloadCtx> = {}): IssuePayloadCtx {
  return {
    projectKey: "DEMO",
    style: "team-managed",
    fieldMap: {},
    epicRealKey: null,
    parentRealKey: null,
    sprintId: null,
    assigneeAccountId: null,
    ...over,
  };
}

describe("detectProjectStyle", () => {
  it("next-gen style → team-managed", () => {
    expect(detectProjectStyle({ style: "next-gen" })).toBe("team-managed");
  });
  it("simplified=true → team-managed", () => {
    expect(detectProjectStyle({ simplified: true })).toBe("team-managed");
  });
  it("classic style → company-managed", () => {
    expect(detectProjectStyle({ style: "classic", simplified: false })).toBe("company-managed");
  });
  it("missing metadata → company-managed (safe default)", () => {
    expect(detectProjectStyle({})).toBe("company-managed");
  });
});

describe("discoverFieldMap", () => {
  const fields: JiraFieldDef[] = [
    { id: "customfield_10014", name: "Epic Link" },
    { id: "customfield_10016", name: "Story Points" },
    { id: "customfield_10020", name: "Sprint" },
    { id: "customfield_10026", name: "Story point estimate" },
    { id: "summary", name: "Summary" },
  ];

  it("finds fields by name (case-insensitive)", () => {
    const map = discoverFieldMap(fields);
    expect(map.epicLink).toBe("customfield_10014");
    expect(map.storyPoints).toBe("customfield_10016");
    expect(map.sprint).toBe("customfield_10020");
  });

  it("accepts 'Story point estimate' variant", () => {
    const map = discoverFieldMap([{ id: "customfield_10026", name: "Story point estimate" }]);
    expect(map.storyPoints).toBe("customfield_10026");
  });

  it("missing fields stay undefined", () => {
    const map = discoverFieldMap([{ id: "summary", name: "Summary" }]);
    expect(map.epicLink).toBeUndefined();
    expect(map.storyPoints).toBeUndefined();
    expect(map.sprint).toBeUndefined();
  });
});

describe("buildIssueFields", () => {
  it("builds base fields with ADF description and capped labels", () => {
    const issue = sampleIssue({ labels: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"] });
    const f = buildIssueFields(issue, ctx());
    expect(f.project).toEqual({ key: "DEMO" });
    expect(f.summary).toBe(issue.summary);
    expect((f.labels as string[]).length).toBeLessThanOrEqual(8);
    expect((f.description as { type: string }).type).toBe("doc");
  });

  it("team-managed: epic links via parent", () => {
    const issue = sampleIssue({ type: "story", epicKey: "DEMO-1" });
    const f = buildIssueFields(issue, ctx({ style: "team-managed", epicRealKey: "DEMO-101" }));
    expect(f.parent).toEqual({ key: "DEMO-101" });
    expect(f.customfield_10014).toBeUndefined();
  });

  it("company-managed: epic links via Epic Link customfield", () => {
    const issue = sampleIssue({ type: "story", epicKey: "DEMO-1" });
    const f = buildIssueFields(
      issue,
      ctx({ style: "company-managed", epicRealKey: "DEMO-101", fieldMap: { epicLink: "customfield_10014" } }),
    );
    expect(f.customfield_10014).toBe("DEMO-101");
    expect(f.parent).toBeUndefined();
  });

  it("company-managed without epic-link field: skips linkage gracefully", () => {
    const issue = sampleIssue({ type: "story", epicKey: "DEMO-1" });
    const f = buildIssueFields(issue, ctx({ style: "company-managed", epicRealKey: "DEMO-101" }));
    expect(f.parent).toBeUndefined();
    expect(f.customfield_10014).toBeUndefined();
  });

  it("sub-tasks always use parent regardless of style", () => {
    const issue = sampleIssue({ type: "subtask", parentKey: "DEMO-5", epicKey: "DEMO-1" });
    for (const style of ["team-managed", "company-managed"] as const) {
      const f = buildIssueFields(issue, ctx({ style, parentRealKey: "DEMO-105", epicRealKey: "DEMO-101" }));
      expect(f.parent).toEqual({ key: "DEMO-105" });
      expect(f.issuetype).toEqual({ name: "Sub-task" });
    }
  });

  it("sets story points only when the field is discovered", () => {
    const issue = sampleIssue({ points: 5 });
    const withField = buildIssueFields(issue, ctx({ fieldMap: { storyPoints: "customfield_10016" } }));
    expect(withField.customfield_10016).toBe(5);
    const without = buildIssueFields(issue, ctx());
    expect(without.customfield_10016).toBeUndefined();
  });

  it("sets sprint only when both id and field exist", () => {
    const issue = sampleIssue({ sprint: "DEMO Sprint 2" });
    const f = buildIssueFields(issue, ctx({ sprintId: 42, fieldMap: { sprint: "customfield_10020" } }));
    expect(f.customfield_10020).toBe(42);
    const noField = buildIssueFields(issue, ctx({ sprintId: 42 }));
    expect(noField.customfield_10020).toBeUndefined();
  });

  it("maps fixVersions and components by name, assignee by accountId", () => {
    const issue = sampleIssue({ fixVersions: ["v1.2"], components: ["api"], type: "bug" });
    const f = buildIssueFields(issue, ctx({ assigneeAccountId: "acc-123" }));
    expect(f.fixVersions).toEqual([{ name: "v1.2" }]);
    expect(f.components).toEqual([{ name: "api" }]);
    expect(f.assignee).toEqual({ accountId: "acc-123" });
  });
});
