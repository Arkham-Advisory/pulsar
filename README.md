# Pulsar

A lightweight GitHub pull request monitor built for engineering teams. Pulsar keeps a pulse on open PRs across your repositories — surfacing what needs attention, what's ready to merge, and where reviews are stalling.

## Features

- **PR triage** — sections for Needs Attention, Review Requested, Your PRs, Drafts, and All Open PRs
- **Approval badges** — instant visual signal for approved (Ready) and changes-requested PRs
- **CI status** — pass/fail/pending indicators pulled directly from GitHub commit statuses
- **Dashboard** — cycle time, review workload, and merge trend charts
- **API Limits** — live view of your PAT's rate-limit buckets across core, search, and GraphQL
- **Multi-repo filtering** — filter by org, specific repos, or a hand-picked selection
- **Dark/light mode**

## Getting Started

```bash
npm install
npm run dev
```

On first launch, go to **Settings** and paste a GitHub Personal Access Token with `repo` scope. Pulsar stores it locally in your browser — nothing is sent to any server.

## Stack

- Vite 7 + React 18 + TypeScript
- Tailwind CSS v3
- TanStack Query v5
- Zustand (persisted settings)
- Octokit REST
- Recharts
