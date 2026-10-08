# Master Checklist — Agent-Readiness, SEO & Security

Every check the validator (`war audit`) runs, with its governing standard,
canonical artifact, required fields, and priority. The **artifact is universal**;
only the *delivery* varies by platform (see `adapters.md`).

Severity → how **absence** is scored: `core` = FAIL, `recommended` = WARN,
`optional` = SKIP (informational). A present-but-malformed artifact is always FAIL
(except `soft` features layered on an existing page, which fall back to severity).

## SEO & AI-consumability

| id | Standard | Artifact | Content-Type | Required | Sev |
|----|----------|----------|--------------|----------|-----|
| `robotsTxt` | RFC 9309 | `GET /robots.txt` | `text/plain` | `User-agent` + `Allow`/`Disallow`; `Sitemap:` if a sitemap exists | core |
| `contentSignals` | contentsignals.org | `Content-Signal` directive in robots.txt **or** response header | — | `ai-train`, `search`, `ai-input` ∈ {yes,no} | recommended |
| `aiRules` | convention | `User-agent` blocks in robots.txt | `text/plain` | explicit entries for GPTBot, OAI-SearchBot, ClaudeBot/Claude-Web, Google-Extended, PerplexityBot, CCBot, Bytespider | recommended |
| `sitemap` | Sitemaps protocol | `GET /sitemap.xml` | `application/xml`/`text/xml` | `<urlset>`/`<sitemapindex>` with `<loc>`; referenced from robots.txt | core |
| `llmsTxt` | llmstxt.org (facto) | `GET /llms.txt` | `text/plain`/`text/markdown` | H1 site name + `>` summary + curated link list | recommended |
| `markdownNegotiation` | HTTP content negotiation | `GET / …` with `Accept: text/markdown` | `text/markdown` | returns Markdown; sets `Vary: Accept`, `x-markdown-tokens`; preserves security headers | recommended (soft) |

## Discovery & APIs

| id | Standard | Artifact | Content-Type | Required | Sev |
|----|----------|----------|--------------|----------|-----|
| `linkHeaders` | RFC 8288 / RFC 9727 §3 | `Link` response header on `/` | — | rel ∈ {`api-catalog`, `service-desc`, `service-doc`, `describedby`} | recommended |
| `apiCatalog` | RFC 9727 | `GET /.well-known/api-catalog` | `application/linkset+json` | `linkset[]`, each with `anchor` + `service-desc`/`service-doc` (+ optional `status`) | optional |

## Security & Auth

| id | Standard | Artifact | Content-Type | Required | Sev |
|----|----------|----------|--------------|----------|-----|
| `securityHeaders` | CSP/HSTS/etc. | Response headers on `/(.*)` | — | HSTS, CSP, X-Frame-Options (or CSP `frame-ancestors`), X-Content-Type-Options, Referrer-Policy, Permissions-Policy | core |
| `oauthAS` | RFC 8414 | `GET /.well-known/oauth-authorization-server` | `application/json` | `issuer`, `authorization_endpoint`, `token_endpoint`, `jwks_uri`; + `grant_types_supported`, `response_types_supported` | optional |
| `oidc` | OIDC Discovery 1.0 | `GET /.well-known/openid-configuration` | `application/json` | same core fields as `oauthAS` (+ `userinfo_endpoint`, `subject_types_supported`) | optional |
| `oauthPRM` | RFC 9728 | `GET /.well-known/oauth-protected-resource` | `application/json` | `resource`, `authorization_servers[]`; optional `scopes_supported`, `bearer_methods_supported`; `WWW-Authenticate: resource_metadata=…` on 401 | optional |
| `authMd` | auth.md | `GET /auth.md` | `text/markdown` | H1 containing `auth.md`; `agent_auth` block (`skill`, `register_uri`, ≥1 method) when OAuth metadata exists; else self-contained registration doc | optional |
| `webBotAuth` | RFC 9421 + IETF WebBotAuth | `GET /.well-known/http-message-signatures-directory` | `application/json` | JWKS with ≥1 public `keys[]`; outbound requests signed with `Signature` + `Signature-Input` + `Signature-Agent` | optional |

## Agent discovery

| id | Standard | Artifact | Content-Type | Required | Sev |
|----|----------|----------|--------------|----------|-----|
| `a2aAgentCard` | A2A Protocol | `GET /.well-known/agent-card.json` | `application/json` | `name`, `version`, `description`, `supportedInterfaces`/`url`, `capabilities`, `skills[]` (`id`,`name`,`description`) | optional |
| `agentSkills` | Agent Skills Discovery RFC v0.2.0 | `GET /.well-known/agent-skills/index.json` | `application/json` | `$schema`=`https://schemas.agentskills.io/discovery/0.2.0/schema.json`; `skills[]` with `name`,`type`(`skill-md`\|`archive`),`description`,`url`,`digest`(`sha256:{hex}`) | optional |
| `mcpServerCard` | MCP SEP-1649 | `GET /.well-known/mcp/server-card.json` | `application/json` | `serverInfo` (`name`,`version`), transport `endpoint`, `capabilities` | optional |

## Commerce (skip unless the site transacts)

| id | Standard | Artifact | Content-Type | Required | Sev |
|----|----------|----------|--------------|----------|-----|
| `acp` | Agentic Commerce Protocol | `GET /.well-known/acp.json` | `application/json` | `protocol.name`=`acp`, `protocol.version`, `api_base_url`, `transports[]`, `capabilities.services[]` | optional |
| `ap2` | Agent Payments Protocol | extension entry inside A2A Agent Card | — | extension `uri` `…/AP2/tree/v0.1.0` + `params.roles` (merchant/shopper/…) | manual |
| `mpp` | Machine Payment Protocol | `GET /openapi.json` | `application/json` | `x-payment-info` on payable ops: `intent`, `method`, `amount`; optional `currency`, `x-service-info` | optional |
| `ucp` | Universal Commerce Protocol | `GET /.well-known/ucp` | `application/json` | `protocol_version`, `services`, `capabilities`, `endpoints` | optional |
| `x402` | x402 | payment middleware on API routes | — | protected routes return HTTP 402 with payment requirements | manual |

## Experimental

| id | Standard | Artifact | Required | Sev |
|----|----------|----------|----------|-----|
| `dnsAid` | DNS for AI Discovery | `_index._agents.<host>` / `_a2a._agents.<host>` SVCB/HTTPS records | `alpn` + endpoint params; numeric `keyNNNNN` SvcParamKeys for experimental params; zone signed with DNSSEC | optional |
| `webMcp` | WebMCP (W3C CG) | in-page JS | `navigator.modelContext.registerTool()` per tool (`name`,`description`,`inputSchema`,`execute`); unregister via `AbortController` | manual |

## Priority tiers (fix in this order)

1. **P0 — SEO/security core**: `robotsTxt`, `sitemap`, `securityHeaders`, `contentSignals`, `aiRules`. Cheap, universal, high impact.
2. **P1 — AI-consumability & discovery**: `markdownNegotiation`, `llmsTxt`, `linkHeaders`, `apiCatalog`. Makes content cheap for agents to consume.
3. **P2 — Auth & agent ecosystem**: `oauthAS`/`oidc`/`oauthPRM`/`authMd`, `a2aAgentCard`, `agentSkills`, `mcpServerCard`, `webBotAuth`. Only if you expose an API or agents.
4. **P3 — Situational**: commerce (`acp`/`ap2`/`mpp`/`ucp`/`x402`) for stores; `dnsAid`/`webMcp` for early adopters.

## Third-party scanner (optional cross-check)

The offline validator is authoritative for CI. For a second opinion, a
third-party scanner can be called (do this only with the site owner's consent):

```http
POST https://isitagentready.com/api/scan
Content-Type: application/json

{"url": "https://example.com"}
```

Response paths map to this checklist, e.g. `checks.discoverability.robotsTxt.status`,
`checks.discovery.apiCatalog.status`, `checks.discovery.oauthDiscovery.status`,
`checks.discovery.agentSkills.status`, `checks.botAccessControl.webBotAuth.status`,
`checks.commerce.acp.status`, `checks.discoverability.dnsAid.status`. Each should be `"pass"`.

The scanner's DNS-AID check uses DNS-over-HTTPS (default `https://cloudflare-dns.com/dns-query`,
fallback `https://dns.google/resolve`); `war audit --doh URL` mirrors this.
