# Project Parking Notes — 2026-07-23

Project parked (owner moving abroad). This file captures current state, known issues, and recommended next steps so work can resume cleanly.

## Current state

- **Repo:** https://github.com/berkkarabacak/sandbox-seed-generator (public, `main` @ `bb9cc8f`)
- **Live demo:** deployed to GitHub Pages via Actions (green on last push).
- **Stack:** React 19 + TypeScript + Vite + shadcn/ui + Tailwind. Vitest (39 tests), ESLint, GitHub Actions CI (lint → test → build) + Pages deploy.
- **Jira connectivity:** local dev proxy `server/jira-proxy.mjs` (port 8787) forwards to Jira Cloud with site/email/token headers. Live push + cleanup verified end-to-end against sandbox site `berk-claude.atlassian.net`.
- **Work tracking:** Julia worktracker at https://berkkarabacak.com/worktracker, project SEED (`8bbb2c25-cd6a-4e27-b234-77e4ca99644f`). All tickets at `done`/`review`.

## What works (verified)

- Recipe-based seed data generation (epics/stories/subtasks, comments, labels, estimates) with live push to Jira Cloud.
- Team-managed **and** company-managed project support (style detection, Epic Link / Story Points / Sprint field discovery, sprint assignment).
- Cleanup tool: live-state preview per project (exists? issue count?) before deletion; project-level delete with per-project per-issue fallback; verified e2e (created + deleted project `E2E` on the sandbox).
- 39/39 unit tests, lint clean, bundle split (largest chunk ~338 kB).

## Known issues / limitations

1. **Jira search indexing lag** — immediately after creating issues, `/search/jql` can undercount (observed 1 of 3 right after creation). The cleanup preview count may briefly be stale. Mitigation if resumed: retry-with-backoff or read issues via the board/sprint API.
2. **New `/search/jql` endpoint has no `total` field** — preview counts are capped at "100+". Fine for sandboxes; not exact for large projects.
3. **Jira proxy is local-only** (`server/jira-proxy.mjs`) — the deployed Pages build cannot push live without a user-run proxy or a hosted relay. CORS prevents direct browser→Jira calls.
4. **Credentials are client-side** (site/email/token entered in the UI / sent via headers). Acceptable for a sandbox tool; never for multi-user production.
5. **Cleanup issue-fallback matches issues by key prefix** (`PROJ-`); issues moved out of a project before cleanup would be missed by the fallback (project-level delete still catches everything when permitted).
6. **Rate limiting** — pushes/cleanups use fixed small sleeps (60–120 ms); very large pushes may hit Jira rate limits. No 429-retry logic yet.
7. **Sprint assignment** uses the agile API and only handles scrum boards; team-managed next-gen backlogs (no sprints enabled) skip sprint assignment by design.

## Recommended next steps (priority order)

1. **Custom domain builder** — user-defined object schemas/fields for seed data (top remaining item from the last review). Biggest feature gap vs. "best mock-data creators".
2. **429-aware retry with jitter** for all Jira calls (shared helper, replace fixed sleeps).
3. **Hosted proxy option** (e.g. tiny Cloudflare Worker) so the deployed app works without a local server.
4. **Preview staleness handling** — poll `/search/jql` until count stabilizes, or show "counts may be stale" hint after recent pushes.
5. **More recipes** — ITSM/JSM, Kanban with WIP history, and a "realistic dates" mode (spread created/resolved over a timeline).
6. **Import/export of push records** so cleanups can run on another machine.

## Resume checklist

- `git pull`, `npm install`
- Dev: `npm run dev` + `node server/jira-proxy.mjs` for live Jira work
- Gates before any commit: `npm test && npm run lint && npm run build`
- Julia: pick up ticket for "custom domain builder" (create if absent), follow report format (comment + outputs + artifact, complete at status `review`).
