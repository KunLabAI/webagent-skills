# AGENTS.md

This repository ships an **Agent Skill** (Agent Skills open standard — [agentskills.io](https://agentskills.io)):

- **`webagent-skills`** — audit and harden any website for AI-agent readiness,
  SEO discoverability, and security. Skill root: [`webagent-skills/SKILL.md`](webagent-skills/SKILL.md).

## Install into your coding agent

The skill is distributed as an npm package with a CLI installer:

```bash
# One-shot (no global install)
npx webagent-skills@latest install

# Or install globally, then run `war`
npm install -g webagent-skills
war install                          # all agents, current repo (project scope)
war install --scope user             # global for this machine
war install --agents claude,cursor   # only specific agents
```

The installer copies `SKILL.md` + `references/` into each agent's skills dir:

| Agent | Project scope | User scope |
|-------|---------------|------------|
| Claude Code | `.claude/skills/webagent-skills/` | `~/.claude/skills/…` |
| Cursor | `.cursor/skills/…` or `.agents/skills/…` | `~/.cursor/skills/…` |
| Codex | `.codex/skills/…` | `~/.codex/skills/…` |
| Qoder | `.qoder/skills/…` | — |

Reload the agent if it caches skills (Claude Code: `/reload-skills`).

## Use it

Once installed, the agent auto-loads the skill when you ask things like *"make this site
agent-ready"*, *"fix the failing agent-readiness checks"*, or *"harden SEO and security
headers"*. You can also run the audit directly:

```bash
npx webagent-skills audit https://example.com --json
```

See [`webagent-skills/README.md`](webagent-skills/README.md) for full docs.
