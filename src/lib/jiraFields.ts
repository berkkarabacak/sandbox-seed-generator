import type { GenIssue } from "@/types";
import { toAdfDoc } from "./adf";

/**
 * Company-managed (classic) vs team-managed (next-gen) Jira support.
 * Team-managed links epics via `parent`; classic needs the "Epic Link"
 * custom field, and story points / sprint live on instance-specific
 * customfield ids — so we discover them by name from GET /rest/api/3/field.
 */

export type ProjectStyle = "team-managed" | "company-managed";

export interface FieldMap {
  epicLink?: string;
  storyPoints?: string;
  sprint?: string;
}

export interface JiraFieldDef {
  id: string;
  name: string;
}

export interface JiraProjectMeta {
  style?: string;
  simplified?: boolean;
}

export function detectProjectStyle(meta: JiraProjectMeta): ProjectStyle {
  if (meta.simplified === true) return "team-managed";
  if (meta.style === "next-gen") return "team-managed";
  return "company-managed";
}

export function discoverFieldMap(fields: JiraFieldDef[]): FieldMap {
  const map: FieldMap = {};
  const norm = (s: string) => s.trim().toLowerCase();
  for (const f of fields) {
    const n = norm(f.name);
    if (!map.epicLink && n === "epic link") map.epicLink = f.id;
    if (!map.storyPoints && (n === "story points" || n === "story point estimate")) map.storyPoints = f.id;
    if (!map.sprint && n === "sprint") map.sprint = f.id;
  }
  return map;
}

export interface IssuePayloadCtx {
  projectKey: string;
  style: ProjectStyle;
  fieldMap: FieldMap;
  epicRealKey: string | null;
  parentRealKey: string | null;
  sprintId: number | null;
  assigneeAccountId: string | null;
}

const ISSUETYPE_NAME: Record<string, string> = {
  story: "Story",
  task: "Task",
  bug: "Bug",
  subtask: "Sub-task",
};

export function seedFooter(issue: GenIssue): string {
  const bits: string[] = [];
  if (issue.assignee) bits.push(`assignee: ${issue.assignee.name}`);
  bits.push(`reporter: ${issue.reporter.name}`);
  if (issue.points != null) bits.push(`points: ${issue.points}`);
  if (issue.sprint) bits.push(`sprint: ${issue.sprint}`);
  if (issue.epicTitle) bits.push(`epic: ${issue.epicTitle}`);
  return `\n\n— seed metadata (${bits.join(" · ")})`;
}

/** Build the `fields` object for POST /issue (and /issue/bulk) for either project style. */
export function buildIssueFields(issue: GenIssue, ctx: IssuePayloadCtx): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    project: { key: ctx.projectKey },
    issuetype: { name: ISSUETYPE_NAME[issue.type] },
    summary: issue.summary.slice(0, 254),
    description: toAdfDoc(issue.description + seedFooter(issue)),
    labels: issue.labels.slice(0, 8),
  };

  // Hierarchy
  if (issue.type === "subtask") {
    if (ctx.parentRealKey) fields.parent = { key: ctx.parentRealKey };
  } else if (ctx.epicRealKey) {
    if (ctx.style === "team-managed") {
      fields.parent = { key: ctx.epicRealKey };
    } else if (ctx.fieldMap.epicLink) {
      fields[ctx.fieldMap.epicLink] = ctx.epicRealKey;
    }
  }

  // Story points / sprint via discovered custom fields (both styles)
  if (issue.points != null && ctx.fieldMap.storyPoints) {
    fields[ctx.fieldMap.storyPoints] = issue.points;
  }
  if (ctx.sprintId != null && ctx.fieldMap.sprint) {
    fields[ctx.fieldMap.sprint] = ctx.sprintId;
  }

  if (issue.fixVersions.length) fields.fixVersions = issue.fixVersions.map((name) => ({ name }));
  if (issue.components.length) fields.components = issue.components.map((name) => ({ name }));
  if (ctx.assigneeAccountId) fields.assignee = { accountId: ctx.assigneeAccountId };

  return fields;
}
