---
name: webagent-skills
description: >-
  Audit and harden any website for AI-agent readiness, SEO discoverability, and
  security. Publishes and validates robots.txt (RFC 9309) + Content-Signal,
  sitemap.xml, llms.txt, Markdown-for-Agents content negotiation, RFC 8288 Link
  headers, security response headers (CSP/HSTS/XFO), .well-known discovery
  (api-catalog RFC 9727, OAuth AS RFC 8414, OAuth PRM RFC 9728, OIDC, auth.md),
  agent cards (A2A, MCP, Agent Skills index), Web Bot Auth (RFC 9421 JWKS),
  commerce protocols (ACP/AP2/MPP/UCP/x402), DNS-AID, and WebMCP. Use when making
  a site crawlable/consumable by AI agents, fixing an agent-readiness scan, or
  hardening web SEO and security on any stack (Next.js, nginx, Cloudflare,
  Express, static).
license: Apache-2.0
metadata:
  version: "1.0.0"
  category: "web/seo/security/agent-readiness"
  standard: "agentskills.io"
  compatible-agents: "claude-code,cursor,codex,qoder"
---

# Web Agent Readiness

Make any website discoverable, consumable, and safe for AI agents and crawlers —
and prove it with an offline validator. This skill is **stack-agnostic**: it
separates the *canonical artifact* (an RFC-defined file, header, or endpoint) from
the *delivery adapter* (Next.js route, nginx location, Cloudflare Worker, Express
middleware, or a static file).

## When to Use

- The user wants a site to be "agent-ready", AI-crawlable, or LLM-friendly.
- An agent-readiness scan (e.g. isitagentready.com) reports failing checks.
- The user asks to add/fix robots.txt, sitemap.xml, llms.txt, Markdown-for-Agents,
  `.well-known/*` discovery, OAuth metadata, security headers, Web Bot Auth, A2A/MCP
  cards, or agent commerce endpoints.
- The user asks to harden a site's SEO discoverability or security posture.

## Core Workflow

Always run the five phases in order. Never skip **Audit** (you must know the real
gap before writing code) and never skip **Validate** (prove the artifact is live).

1. **Audit** — Run the offline validator against the live URL:
   ```bash
   npx --yes webagent-skills audit https://example.com --json
   ```
   It classifies every check as `pass` / `fail` / `warn` / `skip` / `manual` and computes
   a 0–100 score, with no external dependency (Node 18+ global `fetch`). Read
   `references/checklist.md` for the full assertion table.
2. **Detect stack** — Inspect the repo to pick the right delivery adapter:
   `next.config.*`/`app/` → Next.js; `nginx.conf` → nginx; `wrangler.*`/Workers →
   Cloudflare; `express`/`server.js` → Express; plain `public/`/`_site` → static.
   Load the matching section of `references/adapters.md`.
3. **Plan** — Map each failing check to its reference doc (table below) and produce a
   concrete fix list ordered by priority (SEO/security first, experimental last).
4. **Generate & deploy** — Emit the canonical artifact via the chosen adapter. Keep
   the artifact byte-identical to the RFC/standard; only the delivery mechanism varies.
5. **Validate** — Re-run `war audit`. Optionally cross-check with a third-party
   scanner (see `references/checklist.md` → "Third-party scanner"). Iterate until green.

## Check Catalog (21 checks)

Load the reference doc for the category you are fixing — do **not** load all of them
up front (progressive disclosure keeps context small).

| # | Check | Category | Reference (load on demand) |
|---|-------|----------|----------------------------|
| 1 | robots.txt (RFC 9309) | SEO | `references/seo-discoverability.md` |
| 2 | Content-Signal directive | SEO/AI-policy | `references/seo-discoverability.md` |
| 3 | AI crawler User-agent rules | SEO/access | `references/seo-discoverability.md` |
| 4 | sitemap.xml | SEO | `references/seo-discoverability.md` |
| 5 | llms.txt | SEO/AI | `references/seo-discoverability.md` |
| 6 | Link headers (RFC 8288 / 9727 §3) | Discovery | `references/seo-discoverability.md` |
| 7 | Markdown-for-Agents negotiation | AI-consumability | `references/markdown-negotiation.md` |
| 8 | Security response headers | Security | `references/security-headers.md` |
| 9 | API Catalog (RFC 9727) | Discovery | `references/discovery-oauth.md` |
| 10 | OAuth AS metadata (RFC 8414) | Security/Auth | `references/discovery-oauth.md` |
| 11 | OAuth Protected Resource (RFC 9728) | Security/Auth | `references/discovery-oauth.md` |
| 12 | OIDC Discovery | Security/Auth | `references/discovery-oauth.md` |
| 13 | Auth.md registration discovery | Security/Auth | `references/discovery-oauth.md` |
| 14 | A2A Agent Card | Agent discovery | `references/agent-cards.md` |
| 15 | Agent Skills Discovery Index | Agent discovery | `references/agent-cards.md` |
| 16 | MCP Server Card | Agent discovery | `references/agent-cards.md` |
| 17 | Web Bot Auth (RFC 9421 JWKS) | Security/Bot ID | `references/web-bot-auth.md` |
| 18 | ACP / AP2 discovery | Commerce | `references/commerce.md` |
| 19 | MPP payment discovery | Commerce | `references/commerce.md` |
| 20 | UCP / x402 | Commerce | `references/commerce.md` |
| 21 | DNS-AID / WebMCP | Experimental | `references/experimental.md` |

## Delivery Adapters

The artifact is universal; the delivery is swappable. `references/adapters.md` gives
copy-paste snippets per platform for every artifact type:

- **Next.js** — `app/robots.ts`, `app/sitemap.ts`, `app/<path>/route.ts`, `next.config.js` headers, middleware content negotiation.
- **nginx** — `location = /robots.txt`, `add_header`, `try_files`, `alias` for `.well-known`.
- **Cloudflare** — Workers, Transform Rules, AI Crawl Control, `content_converter` setting (platform-specific, optional).
- **Express / Node** — route handlers, `helmet`, content-negotiation middleware.
- **Static** — plain files under the web root (`/robots.txt`, `/.well-known/...`).

## Safety Rules

- **Passive discovery only during audits.** Do **not** `POST /agent/auth`, register
  accounts, or hit payment endpoints while scanning — registration can create accounts,
  send email, or issue credentials. Public discovery documents are the source of truth.
- **Never exfiltrate or hard-code secrets.** OAuth `jwks_uri` publishes *public* keys
  only. Web Bot Auth publishes a *public* JWKS; keep private keys in the secret store.
- **Do not weaken existing security.** Adding discovery endpoints must not open CORS,
  relax CSP, or expose private paths. Preserve origin security headers through any
  content conversion (see `references/markdown-negotiation.md`).
- **Respect the site's policy.** `Content-Signal` and AI crawler rules express the
  owner's intent — ask before flipping `ai-train`/`ai-input` to permissive values.
- **Mark non-auto-detectable checks as `manual`.** x402 (needs a 402 route), WebMCP
  (needs a real browser), and AP2 (A2A extension) require manual verification; the
  validator reports them as `manual` with guidance rather than guessing.
- **Reduce branching in generated code.** Prefer lookup tables, `&&`/`||` short-circuit,
  and declarative config over long `if` chains — match the host project's style.

## Validator Usage

The validator ships as an npm CLI (`webagent-skills`, alias `war`). Run it with
`npx` (no install) or globally (`npm i -g webagent-skills`):

```bash
# Full audit, human-readable (score + grade + per-check detail)
npx --yes webagent-skills audit https://example.com

# Machine-readable, filter by category, custom timeout / UA
npx --yes webagent-skills audit https://example.com --json --category seo,security
npx --yes webagent-skills audit https://example.com --timeout 15 --user-agent "MyBot/1.0"

# Allow a self-signed cert in staging only
npx --yes webagent-skills audit https://staging.local --insecure
```

Exit code is `0` when no `fail` remains (warnings/skip/manual allowed), else `1` — usable
in CI. The CLI is pure Node 18+ (global `fetch`), zero runtime dependencies. It is also a
library: `import { auditSite } from "webagent-skills"` returns the same report object
(reusable programmatically by any consumer).

## Reference Index

- `references/checklist.md` — master table: every check → standard, path, content-type, required fields, assertion, priority.
- `references/seo-discoverability.md` — robots.txt, Content-Signal, AI rules, sitemap, llms.txt, Link headers.
- `references/markdown-negotiation.md` — `Accept: text/markdown` conversion, output format, header preservation.
- `references/security-headers.md` — CSP, HSTS, XFO, XCTO, Referrer-Policy, Permissions-Policy.
- `references/discovery-oauth.md` — api-catalog, OAuth AS, OAuth PRM, OIDC, auth.md.
- `references/agent-cards.md` — A2A Agent Card, Agent Skills index, MCP Server Card.
- `references/web-bot-auth.md` — HTTP Message Signatures (RFC 9421) + JWKS directory.
- `references/commerce.md` — ACP, AP2, MPP, UCP, x402.
- `references/experimental.md` — DNS-AID (SVCB/HTTPS + DNSSEC), WebMCP.
- `references/adapters.md` — per-platform delivery snippets (Next.js / nginx / Cloudflare / Express / static).
