# Seedling · Sandbox Seed-Data Generator

[![CI](https://github.com/berkkarabacak/sandbox-seed-generator/actions/workflows/ci.yml/badge.svg)](https://github.com/berkkarabacak/sandbox-seed-generator/actions/workflows/ci.yml)

Generate realistic fake projects & issues for Jira Cloud sandboxes, demos and UAT —
then rehearse the push (dry-run) or write it for real (live push via local proxy).

## Run

```bash
npm install
npm run dev        # UI on http://localhost:3000 (vite)
npm run proxy      # Jira relay on http://localhost:8787 (required for live push)
```

The vite dev server forwards `/jira/*` to the proxy (`vite.config.ts → server.proxy`),
so the browser only ever talks to localhost.

## Modes

| Mode | What happens |
|---|---|
| **Dry-run** | Simulates the whole REST pipeline in a console — zero writes, no token needed. |
| **Live push** | Creates real projects, epics, stories/tasks/bugs/sub-tasks, comments and issue links in your sandbox. |

## Live push notes

- Auth: Basic auth with your Atlassian account email + API token
  (create one at https://id.atlassian.com/manage-profile/security/api-tokens).
  The token is relayed per-request by the local proxy and never stored.
- Creating projects requires Jira **admin** permission in the target site.
- Fake personas can't be Jira users: issues are assigned round-robin to real
  assignable users found in the sandbox; persona/reporter/points/sprint are
  preserved in each description's *seed metadata* footer.
- Comments are capped (2 per issue, 120 per project) to stay rate-limit friendly;
  the full dataset is always available via **Export JSON**.
- Sprints are created best-effort when an agile board exists on the new project.

## Stack

React 19 · TypeScript · Vite · Tailwind · shadcn/ui · recharts · zero-dependency Node proxy (`server/jira-proxy.mjs`)
