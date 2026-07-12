# Agentic System — Build Plan

A multi-agent "crew" for developing the expense-tracker repo: a master **coordinator** agent
delegates subtasks to specialized subagents (planner, developer, tester, fixbug), built on
**Claude Managed Agents (CMA)**.

## Runtime decision
- **Managed Agents (CMA)** — Anthropic hosts the agent loop and a per-session sandbox container,
  and provides a built-in coordinator→subagents feature. Least infra.
- **Scope** — a coding crew that plans, implements, tests, and fixes bugs on *this* repo.

## Architecture

CMA's built-in **coordinator** pattern maps directly to a master→subagents design. You create 5
persistent *agent* objects; the master lists the other 4 in its `multiagent` roster and delegates.
Each subagent runs in its own **thread** (isolated context) but they **share one container +
filesystem** (the mounted repo), so the developer's edits are visible to the tester.

```
                 ┌──────────────────────────┐
   You ─ task ──▶│  MASTER (coordinator)     │  opus-4-8, high effort
                 │  plans, delegates, merges │
                 └───────────┬──────────────┘
          ┌──────────┬───────┴───────┬─────────────┐
          ▼          ▼               ▼             ▼
      planner    developer         tester        fixbug
    (breakdown) (writes code)  (yarn lint/build) (diagnose+patch)
          └────────── shared container: /workspace/expense-tracker ──────────┘
```

Key constraint: **delegation is one level deep** — subagents cannot spawn their own subagents.

## What you need

| Need | Detail |
|---|---|
| Anthropic API key | `ANTHROPIC_API_KEY` |
| `ant` CLI | Version-controlled agent/environment YAML (control plane) |
| Node + `@anthropic-ai/sdk` | Drives sessions + event streaming (data plane) |
| GitHub PAT | Mount this repo (`github_repository` resource); fine-grained, `Contents: R/W` |
| GitHub MCP server + a vault | Only if agents should open PRs (repo mount is filesystem/git only) |
| Repo on GitHub | CMA mounts repos by URL; local-only won't mount |

## Roles

| Agent | Model / effort | Tools | Job |
|---|---|---|---|
| **master** (coordinator) | opus-4-8 / high | agent_toolset | Read task, get a breakdown from planner, delegate to dev/tester/fixbug, integrate, report |
| **planner** | opus-4-8 / high | read, grep, web | Turn a feature request into an ordered task list + acceptance criteria |
| **developer** | opus-4-8 / xhigh | full toolset (bash/read/write/edit/grep) | Implement React/TS changes in the mounted repo |
| **tester** | sonnet-4-6 / medium | bash, read, grep | Run `yarn lint` + `yarn build`, report failures (use an Outcome + rubric) |
| **fixbug** | opus-4-8 / high | full toolset | Take a failure report, diagnose, patch, hand back to tester |

Lower effort/cheaper model on tester keeps cost down (use low effort for subagents/simple tasks).

## Phased plan

### Phase 1 — Foundation
1. `ant auth login`; install the SDK in a small `agents/` orchestrator project (subfolder or sibling repo).
2. Create one **environment** (`config: {type: "cloud"}`, unrestricted networking) — reused across all agents.

### Phase 2 — Define the crew as YAML (control plane)
3. Write `planner.agent.yaml`, `developer.agent.yaml`, `tester.agent.yaml`, `fixbug.agent.yaml` —
   each flat: `name`, `model`, `system`, `tools`. Give each a sharp system prompt (the tester's says
   "only run `yarn lint`/`yarn build`, never edit code").
4. `ant beta:agents create < *.agent.yaml`, capturing each returned **agent ID**.
5. Write `master.agent.yaml` with the top-level
   `multiagent: {type: coordinator, agents: [<planner id>, <developer id>, <tester id>, <fixbug id>]}`.
   Create it, capture its ID. **Store all 5 IDs** (env/config) — create once, reuse.

### Phase 3 — Runtime driver (data plane, SDK)
6. Node script: load `MASTER_ID` + `ENV_ID`, then
   `sessions.create({ agent: MASTER_ID, environment_id: ENV_ID, resources: [{type:"github_repository", url, authorization_token: PAT, checkout:{type:"branch", name:"main"}}] })`.
7. **Open the event stream before sending** the kickoff `user.message`
   (e.g. "Add the Supabase auth login page from the plan").
8. Drain the stream: handle `session.thread_created` / `agent.thread_message_*` to watch delegation;
   break on `session.status_idle` with a terminal `stop_reason` (not `requires_action`).

### Phase 4 — Verify loop & outputs
9. Give the tester an **Outcome** (`user.define_outcome` + rubric) so the crew iterates until
   lint+build pass, capped by `max_iterations`.
10. Collect artifacts written to `/mnt/session/outputs/` via `files.list({scope_id: session.id})`,
    or have the developer push a branch and (with GitHub MCP) open a PR.

### Phase 5 — Harden
11. Add `permission_policy: always_ask` on `bash` if you want to approve shell commands.
12. Iterate agent prompts via `ant beta:agents update` (new version each time; sessions pin
    versions — safe rollout).

## Gotchas
- **Agent once, session per run** — never call `agents.create()` in the hot path.
- **`multiagent` is a top-level agent field** — not a session field, not a `tools` entry.
- **Repo mount ≠ PR ability** — pushing needs the mount; opening a PR needs the GitHub MCP server + a vault credential.
- **MCP auth lives in vaults**, never in the agent YAML.
- **Delegation is one level deep** — subagents can't delegate further.
- **Archive is permanent** for agents/environments — don't archive as routine cleanup.

## Proposed structure
```
agents/
  environments/dev.environment.yaml
  planner.agent.yaml
  developer.agent.yaml
  tester.agent.yaml
  fixbug.agent.yaml
  master.agent.yaml
  src/run.ts            # SDK runtime driver (create session, stream events)
  .env                  # ANTHROPIC_API_KEY, GITHUB_TOKEN, MASTER_ID, ENV_ID
```
