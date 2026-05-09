# AIDevFlow POC

Proof-of-concept for [AIDevFlow](https://github.com/fraygit/ai-development-workflow). Demonstrates the core concept — Jira ticket assignment triggering an automated code change via Claude Code CLI — with zero platform infrastructure.

## What this is

A GitHub Actions workflow + Claude Code skill file + a thin Jira webhook bridge. No Coordination API, no Compiler, no Prisma, no Redis. Just the essential loop:

```
Jira ticket assigned → GitHub Actions → Claude Code CLI → feature branch → PR
```

## Repos

| Repo | Role |
|---|---|
| This repo (`ai-development-workflow-poc`) | Workflows + skills |
| [`ai-development-workflow-sample-nodejs`](https://github.com/fraygit/ai-development-workflow-sample-nodejs) | Target app Claude modifies |

## Workflows

| Workflow | Trigger | What it does |
|---|---|---|
| `jira-implement.yml` | `repository_dispatch` / `workflow_dispatch` | Reads Jira ticket → implements code changes → opens PR |
| `jira-analyse.yml` | `repository_dispatch` / `workflow_dispatch` | Reads Jira ticket → posts implementation plan as Jira comment |

## Secrets required

Configure in this repo's `Settings → Secrets → Actions`:

| Secret | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key |
| `JIRA_BASE_URL` | e.g. `https://yourorg.atlassian.net` |
| `JIRA_API_TOKEN` | Jira API token |
| `JIRA_USER_EMAIL` | Email paired with the Jira token |
| `SAMPLE_NODEJS_PAT` | Fine-grained PAT for `ai-development-workflow-sample-nodejs` |

## Testing without Jira

Trigger `jira-implement.yml` manually via GitHub Actions → Run workflow, entering a ticket ID. The workflow will fetch the ticket from Jira, so Jira secrets must be set.
