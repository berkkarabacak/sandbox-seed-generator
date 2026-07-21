import type {
  Dataset,
  GenComment,
  GenEpic,
  GenIssue,
  GenProject,
  GenSprint,
  IssuePriority,
  IssueStatus,
  IssueType,
  Persona,
  SeedConfig,
} from "@/types";
import { bell, chance, createRng, hashSeed, int, pick, pickWeighted, sample, shuffle, type Rng } from "./rng";
import { DOMAINS, type DomainPack } from "./domains";
import { makePersonas } from "./personas";

const STATUS_ORDER: IssueStatus[] = ["To Do", "In Progress", "In Review", "Blocked", "Done"];

// ─── Summary builders ─────────────────────────────────────────────────────────

function storySummary(rng: Rng, d: DomainPack): string {
  const cap = pick(rng, d.storyCaps);
  return cap[0].toUpperCase() + cap.slice(1);
}

function storyDescription(rng: Rng, d: DomainPack, detail: SeedConfig["detail"]): string {
  const role = pick(rng, d.userRoles);
  const cap = pick(rng, d.storyCaps);
  const benefit = pick(rng, d.storyBenefits);
  const ac = sample(rng, [
    `Given a ${role}, when they ${pick(rng, d.storyCaps)}, then the change is reflected within one session`,
    `Edge case: behaves sanely when ${pick(rng, d.bugConditions)}`,
    `Telemetry event emitted for the happy path`,
    `Feature-flagged behind \`${pick(rng, d.labels)}_rollout\``,
    `Copy reviewed by the content owner`,
  ], detail === "verbose" ? 4 : detail === "balanced" ? 3 : 2);

  if (detail === "terse") {
    return `As a ${role}, I want to ${cap} so that ${benefit}.\n\nAC:\n- ${ac[0]}`;
  }
  return (
    `As a **${role}**, I want to ${cap} so that ${benefit}.\n\n` +
    `Acceptance criteria:\n${ac.map((a) => `- ${a}`).join("\n")}` +
    (detail === "verbose"
      ? `\n\nNotes:\n- Coordinate with the ${pick(rng, d.labels)} stream before merging.\n- Keep the change behind a flag until the rollout review.`
      : "")
  );
}

function bugSummary(rng: Rng, d: DomainPack): string {
  return `${pick(rng, d.bugSymptoms)} ${pick(rng, d.bugSurfaces)} when ${pick(rng, d.bugConditions)}`;
}

function bugDescription(rng: Rng, d: DomainPack, detail: SeedConfig["detail"]): string {
  const env = pick(rng, ["staging", "production", "sandbox tenant", "perf env"]);
  const sev = pick(rng, ["S2", "S3", "S3", "S4"]);
  const steps = sample(rng, [
    `Trigger ${pick(rng, d.areas)} with a fresh session`,
    `Wait until ${pick(rng, d.bugConditions)}`,
    `Observe ${pick(rng, d.bugSurfaces)}`,
    `Retry with the same idempotency context`,
  ], detail === "verbose" ? 4 : 3);

  return (
    `Severity: ${sev} · Environment: ${env}\n\n` +
    `Steps to reproduce:\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n` +
    `Expected: no error, consistent state.\n` +
    `Actual: ${pick(rng, d.bugSymptoms).toLowerCase()} ${pick(rng, d.bugSurfaces)}.` +
    (detail === "verbose"
      ? `\n\nAdditional context:\n- First seen ~${int(rng, 2, 21)} days ago.\n- Rough repro rate: 1 in ${int(rng, 5, 60)} attempts.`
      : "")
  );
}

function taskSummary(rng: Rng, d: DomainPack): string {
  return `${pick(rng, d.taskVerbs)} ${pick(rng, d.taskObjects)}`;
}

function subtaskSummary(rng: Rng, parentSummary: string): string {
  const angle = pick(rng, [
    "write tests for",
    "update docs for",
    "add telemetry to",
    "review copy for",
    "handle edge cases in",
    "prepare rollout plan for",
  ]);
  return `${angle[0].toUpperCase() + angle.slice(1)} "${truncate(parentSummary, 42)}"`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// ─── Status / priority shaping ────────────────────────────────────────────────

function statusWeights(scenario: SeedConfig["scenario"], chaos: number): [IssueStatus, number][] {
  const c = chaos / 100;
  switch (scenario) {
    case "bugbash":
      return [["To Do", 30], ["In Progress", 25], ["In Review", 12], ["Blocked", 8 + c * 14], ["Done", 25 - c * 10]];
    case "kanban":
      return [["To Do", 26], ["In Progress", 34], ["In Review", 10], ["Blocked", 4 + c * 12], ["Done", 26 - c * 8]];
    case "servicedesk":
      return [["To Do", 34], ["In Progress", 22], ["In Review", 4], ["Blocked", 6 + c * 12], ["Done", 34 - c * 8]];
    case "launch":
      return [["To Do", 38], ["In Progress", 24], ["In Review", 8], ["Blocked", 5 + c * 10], ["Done", 25 - c * 6]];
    default:
      return [["To Do", 30], ["In Progress", 24], ["In Review", 10], ["Blocked", 3 + c * 12], ["Done", 33 - c * 10]];
  }
}

function pickPriority(rng: Rng, type: IssueType, scenario: SeedConfig["scenario"]): IssuePriority {
  if (type === "bug" || scenario === "servicedesk" || scenario === "bugbash") {
    return pickWeighted(rng, [["Highest", 8], ["High", 28], ["Medium", 40], ["Low", 18], ["Lowest", 6]]);
  }
  return pickWeighted(rng, [["Highest", 3], ["High", 16], ["Medium", 46], ["Low", 26], ["Lowest", 9]]);
}

// ─── Comments ─────────────────────────────────────────────────────────────────

function makeComments(
  rng: Rng,
  d: DomainPack,
  people: Persona[],
  density: number,
  createdAt: Date,
  resolvedAt: Date | null,
): GenComment[] {
  if (density <= 0) return [];
  const maxN = Math.round((density / 100) * 6);
  if (maxN === 0) return [];
  const n = pickWeighted(rng, [
    [0, 30], [1, 30], [2, 20], [3, 12], [Math.max(4, maxN), 8],
  ]);
  if (n === 0) return [];

  const extras: string[] = [
    ...d.commentSnippets,
    "LGTM — merging after the build goes green.",
    "Flagging: this might conflict with the work in the adjacent ticket.",
    "Updated the description with the latest findings.",
    "Moving back to To Do until we get clarity from the stakeholders.",
    "Verified the fix on staging, resolving.",
    "Adding the regression-test case so this stays fixed.",
  ];

  const end = resolvedAt ?? new Date();
  const span = Math.max(1, end.getTime() - createdAt.getTime());
  const comments: GenComment[] = [];
  for (let i = 0; i < n; i++) {
    const at = new Date(createdAt.getTime() + span * (0.15 + 0.85 * rng()));
    comments.push({
      id: `c${i}`,
      author: pick(rng, people),
      body: pick(rng, extras),
      createdAt: at,
    });
  }
  return comments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

// ─── Project generation ───────────────────────────────────────────────────────

function typeWeights(scenario: SeedConfig["scenario"]): [IssueType, number][] {
  switch (scenario) {
    case "bugbash":
      return [["story", 8], ["task", 14], ["bug", 72], ["subtask", 6]];
    case "servicedesk":
      return [["story", 18], ["task", 34], ["bug", 40], ["subtask", 8]];
    case "launch":
      return [["story", 26], ["task", 48], ["bug", 16], ["subtask", 10]];
    case "kanban":
      return [["story", 30], ["task", 38], ["bug", 24], ["subtask", 8]];
    default:
      return [["story", 40], ["task", 26], ["bug", 24], ["subtask", 10]];
  }
}

function genProject(
  rng: Rng,
  cfg: SeedConfig,
  d: DomainPack,
  people: Persona[],
  projectIdx: number,
): GenProject {
  const key = d.projectKeys[projectIdx % d.projectKeys.length];
  const name = d.projectNames[projectIdx % d.projectNames.length];
  const lead = people[projectIdx % people.length];
  const now = Date.now();
  const spreadMs = cfg.spreadWeeks * 7 * 24 * 3600 * 1000;

  // Sprints
  const sprints: GenSprint[] = [];
  if (cfg.withSprints && (cfg.scenario === "scrum" || cfg.scenario === "launch")) {
    const n = int(rng, 3, 4);
    for (let i = 1; i <= n; i++) {
      sprints.push({
        name: `${key} Sprint ${i}`,
        state: i < n - 1 ? "closed" : i === n - 1 ? "active" : "future",
        goal: pick(rng, d.sprintGoals),
      });
    }
  }

  // Epics
  const epicTitles = sample(rng, d.epicTitles, int(rng, 3, Math.min(6, d.epicTitles.length)));
  const epicColors = ["#8b5cf6", "#0ea5e9", "#f59e0b", "#10b981", "#f43f5e", "#eab308"];
  const epics: GenEpic[] = epicTitles.map((title, i) => ({
    key: `${key}-${i + 1}`,
    title,
    status: pickWeighted(rng, [["To Do", 25], ["In Progress", 45], ["Done", 25], ["In Review", 3], ["Blocked", 2]]),
    color: epicColors[i % epicColors.length],
    issueCount: 0,
    doneCount: 0,
  }));

  // Issues
  const issues: GenIssue[] = [];
  const used = new Set<string>();
  let counter = epics.length + 1;
  const nextKey = () => {
    let k: string;
    do {
      k = `${key}-${counter++}`;
    } while (used.has(k));
    used.add(k);
    return k;
  };

  const parents: GenIssue[] = [];
  const count = cfg.issuesPerProject;
  const weights = typeWeights(cfg.scenario);
  const statusW = statusWeights(cfg.scenario, cfg.chaos);

  for (let i = 0; i < count; i++) {
    let type = pickWeighted(rng, weights);
    if (type === "subtask" && parents.length === 0) type = "task";

    const createdAt = new Date(now - rng() * spreadMs);
    const status = pickWeighted(rng, statusW);
    const done = status === "Done";
    const resolvedAt = done
      ? new Date(Math.min(now, createdAt.getTime() + rng() * spreadMs * 0.6 + 86400000))
      : null;

    const assignee = chance(rng, cfg.scenario === "launch" ? 0.85 : 0.92) ? pick(rng, people) : null;
    const reporter = pick(rng, people);
    const epic = cfg.scenario === "kanban" ? (chance(rng, 0.3) ? pick(rng, epics) : null) : chance(rng, 0.75) ? pick(rng, epics) : null;

    let summary: string;
    let description: string;
    let parentKey: string | null = null;
    if (type === "bug") {
      summary = bugSummary(rng, d);
      description = bugDescription(rng, d, cfg.detail);
    } else if (type === "story") {
      summary = storySummary(rng, d);
      description = storyDescription(rng, d, cfg.detail);
    } else if (type === "subtask") {
      const parent = pick(rng, parents);
      parentKey = parent.key;
      summary = subtaskSummary(rng, parent.summary);
      description = `Breakdown of ${parent.key}.`;
    } else {
      summary = taskSummary(rng, d);
      description = `${pick(rng, ["Routine", "Requested by ops.", "Follow-up from retro.", "Spotted during on-call."])} Owned by the ${pick(rng, d.labels)} stream.`;
    }

    const issue: GenIssue = {
      key: nextKey(),
      type,
      summary,
      description,
      status,
      priority: pickPriority(rng, type, cfg.scenario),
      assignee,
      reporter,
      points: cfg.withStoryPoints && (type === "story" || type === "task") ? pick(rng, [1, 2, 3, 5, 8, 13]) : null,
      labels: cfg.withLabels ? sample(rng, d.labels, bell(rng, 0, 3)) : [],
      epicKey: epic?.key ?? null,
      epicTitle: epic?.title ?? null,
      parentKey,
      sprint:
        sprints.length > 0 && chance(rng, status === "Done" ? 0.8 : 0.6)
          ? pickWeighted(rng, sprints.map((s) => [s.name, s.state === "closed" ? 30 : s.state === "active" ? 55 : 15] as [string, number]))
          : null,
      comments: [],
      linkedKeys: [],
      createdAt,
      resolvedAt,
    };

    issue.comments = makeComments(rng, d, people, cfg.commentDensity, createdAt, resolvedAt);

    if (epic) {
      const e = epics.find((x) => x.key === epic.key)!;
      e.issueCount++;
      if (done) e.doneCount++;
    }
    if (type !== "subtask") parents.push(issue);
    issues.push(issue);
  }

  // Issue links
  if (cfg.withLinks && issues.length > 6) {
    const linkN = Math.floor(issues.length * 0.25);
    for (let i = 0; i < linkN; i++) {
      const a = pick(rng, issues);
      const b = pick(rng, issues);
      if (a.key !== b.key && a.linkedKeys.length < 3 && !a.linkedKeys.includes(b.key)) {
        a.linkedKeys.push(b.key);
      }
    }
  }

  return {
    key,
    name,
    lead,
    description: `${name} — ${d.blurb}. Generated for sandbox/UAT use.`,
    epics,
    sprints,
    issues: issues.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
  };
}

export function generateDataset(cfg: SeedConfig): Dataset {
  const rng = createRng(hashSeed(`${cfg.seed}:${cfg.domain}:${cfg.scenario}`));
  const d = DOMAINS[cfg.domain];
  const people = makePersonas(rng, cfg.teamSize);
  const projectIdx = shuffle(rng, [0, 1, 2, 3]);
  const projects: GenProject[] = [];
  for (let i = 0; i < cfg.projectCount; i++) {
    projects.push(genProject(rng, cfg, d, people, projectIdx[i]));
  }
  return {
    projects,
    people,
    generatedAt: new Date(),
    domain: cfg.domain,
    scenario: cfg.scenario,
  };
}

export const DEFAULT_CONFIG: SeedConfig = {
  scenario: "scrum",
  domain: "devtools",
  projectCount: 2,
  issuesPerProject: 48,
  teamSize: 7,
  commentDensity: 55,
  spreadWeeks: 8,
  chaos: 35,
  withSprints: true,
  withStoryPoints: true,
  withLabels: true,
  withLinks: true,
  detail: "balanced",
  seed: 7,
};

export function datasetStats(ds: Dataset) {
  let issues = 0;
  let comments = 0;
  const byType: Record<IssueType, number> = { epic: 0, story: 0, task: 0, bug: 0, subtask: 0 };
  const byStatus: Record<IssueStatus, number> = { "To Do": 0, "In Progress": 0, "In Review": 0, Blocked: 0, Done: 0 };
  const byDay: { date: string; created: number; resolved: number }[] = [];
  const dayMap = new Map<string, { created: number; resolved: number }>();
  const workload = new Map<string, { name: string; color: string; open: number; done: number; points: number }>();

  const day = (dt: Date) => dt.toISOString().slice(0, 10);
  for (const p of ds.projects) {
    issues += p.issues.length;
    for (const is of p.issues) {
      byType[is.type]++;
      byStatus[is.status]++;
      comments += is.comments.length;
      const k = day(is.createdAt);
      if (!dayMap.has(k)) dayMap.set(k, { created: 0, resolved: 0 });
      dayMap.get(k)!.created++;
      if (is.resolvedAt) {
        const rk = day(is.resolvedAt);
        if (!dayMap.has(rk)) dayMap.set(rk, { created: 0, resolved: 0 });
        dayMap.get(rk)!.resolved++;
      }
      if (is.assignee) {
        const w = workload.get(is.assignee.id) ?? { name: is.assignee.name, color: is.assignee.color, open: 0, done: 0, points: 0 };
        if (is.status === "Done") w.done++;
        else w.open++;
        w.points += is.points ?? 0;
        workload.set(is.assignee.id, w);
      }
    }
  }
  const sortedDays = [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [date, v] of sortedDays) byDay.push({ date: date.slice(5), ...v });

  return {
    issues,
    comments,
    byType,
    byStatus,
    byDay,
    workload: [...workload.values()].sort((a, b) => b.open + b.done - (a.open + a.done)),
    epics: ds.projects.reduce((s, p) => s + p.epics.length, 0),
    statusOrder: STATUS_ORDER,
  };
}
