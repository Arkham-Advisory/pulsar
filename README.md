# Pulsar

A lightweight GitHub pull request monitor built for engineering teams. Pulsar keeps a pulse on open PRs across your repositories — surfacing what needs attention, what's ready to merge, and where reviews are stalling.

## Use it now

**[pulsar.arkham-advisory.com](https://pulsar.arkham-advisory.com)**

Open the app, go to **Settings**, and paste a GitHub Personal Access Token with `repo` scope. Pulsar runs entirely in your browser — your token never leaves your machine.

## Features

- **PR triage** — sections for Needs Attention, Review Requested, Your PRs, Drafts, and All Open PRs
- **Approval badges** — instant visual signal for approved (Ready) and changes-requested PRs
- **CI status** — pass/fail/pending indicators pulled directly from GitHub commit statuses
- **Dashboard** — cycle time, review workload, and merge trend charts
- **API Limits** — live view of your PAT's rate-limit buckets across core, search, and GraphQL
- **Multi-repo filtering** — filter by org, specific repos, or a hand-picked selection
- **Dark/light mode**

## For developers

```bash
npm install
npm run dev
```
