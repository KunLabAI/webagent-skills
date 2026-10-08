# web-agent

English | [简体中文](./README.zh-CN.md)

[![npm version](https://img.shields.io/npm/v/web-agent.svg)](https://www.npmjs.com/package/web-agent)
[![license](https://img.shields.io/npm/l/web-agent.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/web-agent.svg)](https://nodejs.org)
[![Agent Skills](https://img.shields.io/badge/Agent%20Skills-agentskills.io-blue)](https://agentskills.io)

Audit and harden **any** website for **AI-agent readiness, SEO discoverability, and
security** — as an installable [Agent Skill](https://agentskills.io), a zero-dependency
CLI, and a programmatic API. One install works in **Claude Code, Cursor, Codex, and Qoder**.

It turns the "make my site agent-ready" checklist — robots.txt, sitemap, llms.txt,
Markdown-for-Agents, `.well-known` discovery, OAuth metadata, security headers, agent
cards, Web Bot Auth, commerce protocols, DNS-AID, WebMCP — into something an AI coding
agent can execute end-to-end on **any stack**.

## Why it's stack-agnostic

Every check separates two things:

- **The canonical artifact** — an RFC-defined file, header, or endpoint. Identical everywhere.
- **The delivery adapter** — how that artifact is served on your platform. Swappable.

The agent detects your stack, generates the canonical artifact, and wires it through the
matching adapter ([`references/adapters.md`](references/adapters.md)). Cloudflare is just
one adapter, never a requirement.

## Install

```bash
# Global CLI (provides `web-agent` and the short alias `war`)
npm install -g web-agent

# Or run without installing
npx web-agent@latest --help
```

Then install the **skill** into your coding agent(s):

```bash
war install                         # all agents, current repo (project scope)
war install --scope user            # global for this machine
war install --agents claude,cursor  # only specific agents
```

| Agent | Project scope | User scope |
|-------|---------------|------------|
| Claude Code | `.claude/skills/web-agent/` | `~/.claude/skills/…` |
| Cursor | `.cursor/skills/…` or `.agents/skills/…` | `~/.cursor/skills/…` |
| Codex | `.codex/skills/…` | `~/.codex/skills/…` |
| Qoder | `.qoder/skills/…` | — |

**Manual install**: copy `SKILL.md` + `references/` into `<agent-skills-dir>/web-agent/`.

## Use

### As a CLI

```bash
war audit https://example.com                 # score + grade + per-check report
war audit https://example.com --json          # machine-readable
war audit https://example.com --category seo,security
war audit https://example.com --timeout 15 --user-agent "MyBot/1.0"
```

Sample output:

```
Agent-readiness audit — https://example.com
===========================================
Score: 89/100 (grade B)   failing checks: 0

[WARN]    ai           Markdown-for-Agents
            - artifact not served (HTTP 500)
[PASS]    seo          robots.txt (RFC 9309)
[PASS]    security     Security response headers
...
Summary: 6 pass  0 fail  2 warn  3 manual  13 skip
```

Exit code is `0` when no check fails, else `1` — drop it into CI.

### As a library

```ts
import { auditSite } from "web-agent";

const report = await auditSite("https://example.com", { timeout: 12 });
// report: { target, score, grade, failed, counts, results[] }
```

`auditSite` is the same engine the CLI uses — import it to build a scoring API, a
dashboard, or a scheduled monitor.

### Through your coding agent

Once installed, the agent auto-loads the skill when you say things like:

> "Audit kunartai.com for agent readiness and fix the failing checks."
> "Add robots.txt Content-Signal and an api-catalog to this Next.js app."
> "Harden the security headers and publish OAuth discovery metadata."

## The agent's workflow

1. **Audit** — run `war audit` against the live URL.
2. **Detect stack** — inspect the repo to choose the delivery adapter.
3. **Plan** — map each failing check to its reference doc, ordered by priority.
4. **Generate & deploy** — emit the canonical artifact via the adapter.
5. **Validate** — re-run the audit until green (optionally cross-check a third-party scanner).

## Coverage (21 checks)

| Category | Checks |
|----------|--------|
| SEO / AI-consumability | robots.txt (RFC 9309), Content-Signal, AI crawler rules, sitemap.xml, llms.txt, Markdown-for-Agents |
| Discovery / APIs | Link headers (RFC 8288), API Catalog (RFC 9727) |
| Security / Auth | security headers (CSP/HSTS/XFO…), OAuth AS (RFC 8414), OIDC Discovery, OAuth PRM (RFC 9728), auth.md, Web Bot Auth (RFC 9421) |
| Agent discovery | A2A Agent Card, Agent Skills Discovery Index (v0.2.0), MCP Server Card |
| Commerce | ACP, AP2, MPP, UCP, x402 |
| Experimental | DNS-AID, WebMCP |

Each check has a severity (`core` / `recommended` / `optional`) that drives both its
pass/fail scoring and the weighted 0–100 site score. Full table:
[`references/checklist.md`](references/checklist.md).

## Project layout

```
web-agent/
├── package.json / tsconfig.json
├── LICENSE (Apache-2.0) / NOTICE
├── SKILL.md                     # the skill (lean orchestrator; details in references/)
├── AGENTS.md                    # universal pointer for agents reading the repo
├── bin/war.js                   # npm bin entry
├── src/                         # TypeScript source
│   ├── cli.ts                   # `audit` + `install` commands
│   ├── audit.ts                 # auditSite() engine + scoring (public API)
│   ├── checks.ts                # 21-check registry + evaluators + custom probes
│   ├── http.ts                  # zero-dep fetch layer (Node 18+)
│   ├── report.ts                # human-readable formatting
│   └── install.ts               # cross-agent skill installer
└── references/                  # 10 progressive-disclosure docs (shipped with the skill)
    ├── checklist.md · seo-discoverability.md · markdown-negotiation.md
    ├── security-headers.md · discovery-oauth.md · agent-cards.md
    └── web-bot-auth.md · commerce.md · experimental.md · adapters.md
```

## Development

```bash
npm install         # installs typescript + @types/node
npm run build       # tsc → dist/
npm run typecheck   # tsc --noEmit
node bin/war.js audit https://example.com
```

Requires Node ≥ 18.17 (global `fetch`, `AbortSignal.timeout`). Zero runtime dependencies.

## Safety guarantees

- **Passive audits only** — never `POST /agent/auth`, register accounts, or trigger payments.
- **No secrets in artifacts** — only public keys/URLs are published; private keys stay in your KMS.
- **Never weakens security** — discovery endpoints don't relax CSP/CORS or expose private paths.
- **Policy is the owner's call** — the agent asks before setting permissive `Content-Signal`/AI-crawl values.
- **TLS on by default** — `--insecure` is opt-in, warns loudly, staging-only.
- **SSRF note** — `auditSite` fetches whatever URL you pass. If you build a tool that scans
  arbitrary user-supplied URLs, add egress protection yourself (scheme/port allow-list, DNS
  resolve + reject private/loopback/link-local/reserved IPs incl. `169.254.169.254`, per-hop
  redirect re-validation, size caps) and rate limiting.

## Read-only auditor

`web-agent` is a read-only auditor: it fetches public URLs, reports what it
finds, and never modifies the sites it scans. The commerce category
(`references/commerce.md`) only *detects* whether a scanned site implements agent-payment
standards (ACP/AP2/MPP/UCP/x402); it is detection, not payment functionality.

## Standards & sources

RFC 9309 (robots), RFC 8288 (Link), RFC 9727 (api-catalog), RFC 8414 (OAuth AS),
RFC 9728 (OAuth PRM), RFC 9421 (HTTP Message Signatures), OIDC Discovery 1.0, Sitemaps
protocol, contentsignals.org, llmstxt.org, A2A Protocol, Agent Skills Discovery RFC v0.2.0,
MCP SEP-1649, IETF WebBotAuth, ACP/AP2/MPP/UCP/x402, DNS-AID, WebMCP. Check taxonomy
inspired by Cloudflare's agent-readiness guidance and isitagentready.com.

## Contributing

Issues and PRs welcome. Please keep checks declarative in `src/checks.ts`, add the
assertion to `references/checklist.md`, and run `npm run build` before submitting.

## License

[Apache-2.0](./LICENSE) © web-agent contributors. See [NOTICE](./NOTICE).
