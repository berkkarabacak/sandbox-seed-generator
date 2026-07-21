// ─── Configuration ────────────────────────────────────────────────────────────

export type ScenarioId = "scrum" | "kanban" | "bugbash" | "servicedesk" | "launch";
export type DomainId = "fintech" | "ecommerce" | "healthcare" | "devtools" | "gaming" | "logistics";
export type DetailLevel = "terse" | "balanced" | "verbose";

export interface JiraConnection {
  site: string;
  email: string;
  token: string;
}

export interface SeedConfig {
  scenario: ScenarioId;
  domain: DomainId;
  projectCount: number;
  issuesPerProject: number;
  teamSize: number;
  commentDensity: number; // 0–100
  spreadWeeks: number; // how far back created dates reach
  chaos: number; // 0–100: blockers, stale tickets, mid-sprint mess
  withSprints: boolean;
  withStoryPoints: boolean;
  withLabels: boolean;
  withLinks: boolean;
  detail: DetailLevel;
  seed: number;
}

// ─── Generated dataset ────────────────────────────────────────────────────────

export type IssueType = "epic" | "story" | "task" | "bug" | "subtask";
export type IssueStatus = "To Do" | "In Progress" | "In Review" | "Blocked" | "Done";
export type IssuePriority = "Highest" | "High" | "Medium" | "Low" | "Lowest";

export interface Persona {
  id: string;
  name: string;
  initials: string;
  role: string;
  color: string; // hsl string for avatar
  timezone: string;
}

export interface GenComment {
  id: string;
  author: Persona;
  body: string;
  createdAt: Date;
}

export interface GenIssue {
  key: string;
  type: IssueType;
  summary: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  assignee: Persona | null;
  reporter: Persona;
  points: number | null;
  labels: string[];
  epicKey: string | null;
  epicTitle: string | null;
  parentKey: string | null; // set for sub-tasks
  sprint: string | null;
  comments: GenComment[];
  linkedKeys: string[];
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface GenEpic {
  key: string;
  title: string;
  status: IssueStatus;
  color: string;
  issueCount: number;
  doneCount: number;
}

export interface GenSprint {
  name: string;
  state: "closed" | "active" | "future";
  goal: string;
}

export interface GenProject {
  key: string;
  name: string;
  lead: Persona;
  description: string;
  epics: GenEpic[];
  sprints: GenSprint[];
  issues: GenIssue[];
}

export interface Dataset {
  projects: GenProject[];
  people: Persona[];
  generatedAt: Date;
  domain: DomainId;
  scenario: ScenarioId;
}

// ─── Push job ─────────────────────────────────────────────────────────────────

export interface PushLogLine {
  t: number; // ms offset
  level: "info" | "ok" | "warn" | "err";
  text: string;
}

export interface JobRecord {
  id: string;
  at: Date;
  site: string;
  projects: number;
  issues: number;
  comments: number;
  mode: "dry-run" | "live";
  durationMs: number;
}
