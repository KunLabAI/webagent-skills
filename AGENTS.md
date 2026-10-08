# AGENTS.md

This repository ships an **Agent Skill** (Agent Skills open standard — [agentskills.io](https://agentskills.io)):

- **`web-agent`** — audit and harden any website for AI-agent readiness,
  SEO discoverability, and security. Skill root: [`web-agent/SKILL.md`](web-agent/SKILL.md).

## Install into your coding agent

The skill is distributed as an npm package with a CLI installer:

```bash
# One-shot (no global install)
npx web-agent@latest install

# Or install globally, then run `war`
npm install -g web-agent
war install                          # all agents, current repo (project scope)
war install --scope user             # global for this machine
war install --agents claude,cursor   # only specific agents
```

The installer copies `SKILL.md` + `references/` into each agent's skills dir:

| Agent | Project scope | User scope |
|-------|---------------|------------|
| Claude Code | `.claude/skills/web-agent/` | `~/.claude/skills/…` |
| Cursor | `.cursor/skills/…` or `.agents/skills/…` | `~/.cursor/skills/…` |
| Codex | `.codex/skills/…` | `~/.codex/skills/…` |
| Qoder | `.qoder/skills/…` | — |

Reload the agent if it caches skills (Claude Code: `/reload-skills`).

## Use it

Once installed, the agent auto-loads the skill when you ask things like *"make this site
agent-ready"*, *"fix the failing agent-readiness checks"*, or *"harden SEO and security
headers"*. You can also run the audit directly:

```bash
npx web-agent audit https://example.com --json
```

See [`web-agent/README.md`](web-agent/README.md) for full docs.
