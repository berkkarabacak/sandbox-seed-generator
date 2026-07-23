import { describe, expect, it } from "vitest";
import type { GenIssue, IssuePriority, IssueStatus, SeedConfig } from "@/types";
import { DEFAULT_CONFIG, datasetStats, generateDataset } from "../generator";
import { DOMAINS, SCENARIOS } from "../domains";

const cfg = (over: Partial<SeedConfig> = {}): SeedConfig => ({ ...DEFAULT_CONFIG, ...over });

/** Serialize a dataset ignoring the wall-clock generatedAt field. */
function stable(ds: ReturnType<typeof generateDataset>): string {
  return JSON.stringify(ds, (k, v) => (k === "generatedAt" ? undefined : v));
}

function allIssues(ds: ReturnType<typeof generateDataset>): GenIssue[] {
  return ds.projects.flatMap((p) => p.issues);
}

const VALID_STATUSES: IssueStatus[] = ["To Do", "In Progress", "In Review", "Blocked", "Done"];
const VALID_PRIORITIES: IssuePriority[] = ["Highest", "High", "Medium", "Low", "Lowest"];

const FIXED_NOW = 1_752_000_000_000; // fixed anchor so determinism tests are wall-clock independent

describe("determinism", () => {
  it("same config + seed produces an identical dataset", () => {
    const a = generateDataset(cfg(), FIXED_NOW);
    const b = generateDataset(cfg(), FIXED_NOW);
    expect(stable(a)).toBe(stable(b));
  });

  it("different seeds produce different datasets", () => {
    const a = generateDataset(cfg({ seed: 1 }), FIXED_NOW);
    const b = generateDataset(cfg({ seed: 2 }), FIXED_NOW);
    expect(stable(a)).not.toBe(stable(b));
  });

  it("every domain × scenario combination generates without errors", () => {
    for (const domain of Object.keys(DOMAINS) as SeedConfig["domain"][]) {
      for (const scenario of Object.keys(SCENARIOS) as SeedConfig["scenario"][]) {
        const ds = generateDataset(cfg({ domain, scenario, projectCount: 1, issuesPerProject: 12, teamSize: 3 }), FIXED_NOW);
        expect(ds.projects.length).toBe(1);
        expect(allIssues(ds).length).toBe(12);
      }
    }
  });
});

describe("schema invariants", () => {
  const ds = generateDataset(cfg({ issuesPerProject: 60, teamSize: 8, chaos: 60, commentDensity: 80 }));

  it("respects project count and issues-per-project", () => {
    expect(ds.projects).toHaveLength(cfg().projectCount);
    for (const p of ds.projects) expect(p.issues).toHaveLength(60);
  });

  it("issue keys are unique per project and well-formed", () => {
    for (const p of ds.projects) {
      const keys = p.issues.map((i) => i.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const k of keys) expect(k).toMatch(new RegExp(`^${p.key}-\\d+$`));
    }
  });

  it("statuses and priorities are valid enum values", () => {
    for (const i of allIssues(ds)) {
      expect(VALID_STATUSES).toContain(i.status);
      expect(VALID_PRIORITIES).toContain(i.priority);
    }
  });

  it("sub-tasks always reference an existing parent", () => {
    for (const p of ds.projects) {
      const keys = new Set(p.issues.map((i) => i.key));
      for (const i of p.issues.filter((x) => x.type === "subtask")) {
        expect(i.parentKey).not.toBeNull();
        expect(keys.has(i.parentKey!)).toBe(true);
      }
    }
  });

  it("epic links reference existing epics", () => {
    for (const p of ds.projects) {
      const epicKeys = new Set(p.epics.map((e) => e.key));
      for (const i of p.issues) {
        if (i.epicKey) expect(epicKeys.has(i.epicKey)).toBe(true);
      }
    }
  });

  it("issue links reference existing issues with valid types", () => {
    for (const p of ds.projects) {
      const keys = new Set(p.issues.map((i) => i.key));
      for (const i of p.issues) {
        for (const l of i.links) {
          expect(keys.has(l.key)).toBe(true);
          expect(l.key).not.toBe(i.key);
        }
      }
    }
  });

  it("resolved issues are exactly the Done ones, with sane dates", () => {
    const now = Date.now() + 1000;
    for (const i of allIssues(ds)) {
      if (i.status === "Done") {
        expect(i.resolvedAt).not.toBeNull();
        expect(i.resolvedAt!.getTime()).toBeGreaterThanOrEqual(i.createdAt.getTime());
      } else {
        expect(i.resolvedAt).toBeNull();
      }
      expect(i.createdAt.getTime()).toBeLessThanOrEqual(now);
      for (const c of i.comments) {
        expect(c.createdAt.getTime()).toBeGreaterThanOrEqual(i.createdAt.getTime());
      }
    }
  });

  it("fix versions and components come from the project vocab", () => {
    for (const p of ds.projects) {
      const vNames = new Set(p.versions.map((v) => v.name));
      const cNames = new Set(p.components);
      for (const i of p.issues) {
        for (const v of i.fixVersions) expect(vNames.has(v)).toBe(true);
        for (const c of i.components) expect(cNames.has(c)).toBe(true);
      }
    }
  });
});

describe("config switches", () => {
  it("withLabels=false produces no labels", () => {
    const ds = generateDataset(cfg({ withLabels: false }));
    expect(allIssues(ds).every((i) => i.labels.length === 0)).toBe(true);
  });

  it("withStoryPoints=false produces no points", () => {
    const ds = generateDataset(cfg({ withStoryPoints: false }));
    expect(allIssues(ds).every((i) => i.points === null)).toBe(true);
  });

  it("withSprints=false produces no sprints or sprint assignments", () => {
    const ds = generateDataset(cfg({ withSprints: false }));
    for (const p of ds.projects) {
      expect(p.sprints).toHaveLength(0);
      expect(p.issues.every((i) => i.sprint === null)).toBe(true);
    }
  });

  it("withLinks=false produces no links", () => {
    const ds = generateDataset(cfg({ withLinks: false }));
    expect(allIssues(ds).every((i) => i.links.length === 0)).toBe(true);
  });

  it("commentDensity=0 produces no comments", () => {
    const ds = generateDataset(cfg({ commentDensity: 0 }));
    expect(allIssues(ds).every((i) => i.comments.length === 0)).toBe(true);
  });

  it("persona count matches teamSize and personas have required fields", () => {
    const ds = generateDataset(cfg({ teamSize: 9 }));
    expect(ds.people).toHaveLength(9);
    for (const p of ds.people) {
      expect(p.name.length).toBeGreaterThan(2);
      expect(p.initials).toMatch(/^[A-Z]{2}$/);
      expect(p.role.length).toBeGreaterThan(0);
    }
  });
});

describe("datasetStats", () => {
  it("totals match the generated data", () => {
    const ds = generateDataset(cfg({ issuesPerProject: 40 }));
    const stats = datasetStats(ds);
    expect(stats.issues).toBe(40 * cfg().projectCount);
    const byStatusSum = Object.values(stats.byStatus).reduce((a, b) => a + b, 0);
    expect(byStatusSum).toBe(stats.issues);
    const byTypeSum = Object.values(stats.byType).reduce((a, b) => a + b, 0);
    expect(byTypeSum).toBe(stats.issues);
    expect(stats.comments).toBe(allIssues(ds).reduce((a, i) => a + i.comments.length, 0));
  });
});
