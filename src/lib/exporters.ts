import type { Dataset, GenProject } from "@/types";

// ─── Download helper ──────────────────────────────────────────────────────────

export function download(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob(["﻿" + content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportJson(dataset: Dataset) {
  const payload = {
    meta: {
      generator: "seedling · sandbox seed-data generator",
      generatedAt: dataset.generatedAt.toISOString(),
      scenario: dataset.scenario,
      domain: dataset.domain,
    },
    people: dataset.people,
    projects: dataset.projects,
  };
  download(`seed-data-${dataset.scenario}-${dataset.domain}.json`, JSON.stringify(payload, null, 2), "application/json");
}

// ─── Jira CSV importer format ─────────────────────────────────────────────────
// Matches the columns Jira's external-system CSV import understands, incl.
// repeated columns for multi-value fields (Labels / Fix Version/s / Component/s).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function jiraDate(d: Date): string {
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? "AM" : "PM";
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()}/${MONTHS[d.getMonth()]}/${String(d.getFullYear()).slice(2)} ${h12}:${mm} ${ampm}`;
}

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportJiraCsv(project: GenProject) {
  const maxLabels = Math.max(1, ...project.issues.map((i) => i.labels.length));
  const maxVersions = Math.max(1, ...project.issues.map((i) => i.fixVersions.length));
  const maxComponents = Math.max(1, ...project.issues.map((i) => i.components.length));
  const maxAttachments = Math.max(1, ...project.issues.map((i) => i.attachments.length));

  const header = [
    "Issue Id", "Summary", "Issue Type", "Status", "Priority",
    "Assignee", "Reporter", "Created", "Resolved", "Due Date",
    "Description", "Story Points", "Original Estimate", "Time Spent",
    "Sprint", "Epic Name", "Epic Link", "Parent Id",
    "Watchers", "Votes",
    ...Array(maxLabels).fill("Labels"),
    ...Array(maxVersions).fill("Fix Version/s"),
    ...Array(maxComponents).fill("Component/s"),
    ...Array(maxAttachments).fill("Attachment"),
  ];

  const rows: string[][] = [];
  const keyNum = (key: string) => key.split("-")[1] ?? key;

  // Epics first (so Epic Name / Epic Link resolve inside one import file)
  for (const epic of project.epics) {
    rows.push([
      keyNum(epic.key), epic.title, "Epic", epic.status, "Medium",
      project.lead.name, project.lead.name, jiraDate(project.issues[0]?.createdAt ?? new Date()), "", "",
      `Epic: ${epic.title}`, "", "", "",
      "", epic.title, "", "",
      "", "",
      ...Array(maxLabels).fill(""),
      ...Array(maxVersions).fill(""),
      ...Array(maxComponents).fill(""),
      ...Array(maxAttachments).fill(""),
    ]);
  }

  for (const i of project.issues) {
    const desc = i.description + (i.links.length ? `\n\nLinks: ${i.links.map((l) => `${l.type} ${l.key}`).join("; ")}` : "");
    rows.push([
      keyNum(i.key), i.summary, i.type === "subtask" ? "Sub-task" : i.type[0].toUpperCase() + i.type.slice(1),
      i.status, i.priority,
      i.assignee?.name ?? "", i.reporter.name, jiraDate(i.createdAt),
      i.resolvedAt ? jiraDate(i.resolvedAt) : "",
      i.dueDate ? jiraDate(i.dueDate) : "",
      desc, i.points ?? "", i.estimateMin != null ? i.estimateMin * 60 : "", i.spentMin != null ? i.spentMin * 60 : "",
      i.sprint ?? "", "", i.epicTitle ?? "", i.parentKey ? keyNum(i.parentKey) : "",
      i.watchers, i.votes,
      ...[...i.labels, ...Array(maxLabels).fill("")].slice(0, maxLabels),
      ...[...i.fixVersions, ...Array(maxVersions).fill("")].slice(0, maxVersions),
      ...[...i.components, ...Array(maxComponents).fill("")].slice(0, maxComponents),
      ...[...i.attachments.map((a) => a.filename), ...Array(maxAttachments).fill("")].slice(0, maxAttachments),
    ]);
  }

  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  download(`jira-import-${project.key}.csv`, csv, "text/csv");
}
