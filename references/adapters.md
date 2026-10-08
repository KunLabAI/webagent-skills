# Delivery Adapters (per platform)

The **artifact** (file/header/endpoint) is defined by the RFC and is identical everywhere.
Only the **delivery** differs. Pick the section matching the detected stack, then emit the
canonical artifact from the relevant reference doc. Keep snippets declarative — prefer
config/lookup over `if` chains, matching the host project's style.

Detection: `next.config.*` + `app/`/`pages/` → Next.js; `nginx.conf`/`sites-available` →
nginx; `wrangler.toml`/`_worker.js` → Cloudflare Workers; `express`/`fastify` in deps →
Node server; only `public/`/`dist/`/`_site` → static.

---

## Next.js (App Router)

**robots.txt** — `app/robots.ts`:
```ts
import type { MetadataRoute } from 'next';
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: ['/'], disallow: ['/api/', '/settings', '/login'] },
      { userAgent: ['GPTBot', 'ClaudeBot', 'Google-Extended', 'PerplexityBot', 'CCBot'],
        allow: ['/'], disallow: ['/api/'] },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
```
> Content-Signal is not part of the `MetadataRoute.Robots` type — append it via a
> `app/robots.txt/route.ts` returning raw `text/plain`, or set the `Content-Signal`
> response header globally (see headers below).

**sitemap.xml** — `app/sitemap.ts` returns `MetadataRoute.Sitemap` (array of `{url,lastmod,changeFrequency,priority}`).

**llms.txt** — `app/llms.txt/route.ts`:
```ts
export const runtime = 'edge';
export async function GET() {
  return new Response(LLMS_TEXT, { headers: { 'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=3600, s-maxage=86400' } });
}
```

**`.well-known` JSON** (api-catalog, OAuth, agent cards, JWKS) — `app/.well-known/<name>/route.ts`:
```ts
export async function GET() {
  return Response.json(DOC, { headers: {
    'Content-Type': 'application/linkset+json',   // api-catalog; use application/json elsewhere
    'Cache-Control': 'public, max-age=3600' } });
}
```

**Security + Link headers** — `next.config.js`:
```js
async headers() {
  return [
    { source: '/', headers: [{ key: 'Link',
      value: '</.well-known/api-catalog>; rel="api-catalog", </llms.txt>; rel="describedby"; type="text/plain"' }] },
    { source: '/(.*)', headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
      { key: 'Content-Security-Policy', value: CSP },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'Content-Signal', value: 'ai-train=yes, search=yes, ai-input=yes' },
      { key: 'Vary', value: 'Accept' },
    ] },
  ];
}
```

**Content negotiation (Markdown-for-Agents)** — in `middleware.ts`, detect `Accept: text/markdown`
(respect q-values) and `NextResponse.rewrite` to a conversion route **outside** `/api/`
(so the API proxy rewrite doesn't intercept it). The route re-fetches its own HTML with an
internal marker header (avoids a conversion loop + rate-limit double-count), converts with
an HTML→Markdown lib, and returns `text/markdown` with the headers from
`markdown-negotiation.md`. Exclude `/robots.txt`, `/sitemap.xml`, `/llms.txt`, static assets.

---

## nginx

```nginx
# Static artifacts from a directory
location = /robots.txt   { alias /var/www/meta/robots.txt;   default_type text/plain; }
location = /sitemap.xml  { alias /var/www/meta/sitemap.xml;  default_type application/xml; }
location = /llms.txt     { alias /var/www/meta/llms.txt;     default_type "text/plain; charset=utf-8"; }

# .well-known discovery documents
location /.well-known/ {
    alias /var/www/meta/.well-known/;
    types { application/json json; application/linkset+json api-catalog; }
    add_header Cache-Control "public, max-age=3600";
}

# Security + Link + Content-Signal headers (server or location scope)
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
add_header Content-Security-Policy "default-src 'self'; frame-ancestors 'none'" always;
add_header Content-Signal "ai-train=yes, search=yes, ai-input=yes" always;
add_header Link '</.well-known/api-catalog>; rel="api-catalog"' always;
```
> `add_header` does not inherit into a block that declares its own `add_header` — repeat the
> set, or use a shared `include headers.conf;`. Markdown negotiation needs `ngx_http_lua`
> or an upstream converter; simplest is to proxy `Accept: text/markdown` requests to a
> converter service via `map $http_accept $want_md { ... }`.

---

## Cloudflare (platform-specific, optional)

Cloudflare is one delivery option among many — nothing here is required if you self-host.

- **Markdown for Agents**: enable per zone (Pro/Business/Enterprise) in AI Crawl Control, or via API:
  ```bash
  curl -X PATCH "https://api.cloudflare.com/client/v4/zones/{zone_tag}/settings/content_converter" \
    -H "Authorization: Bearer {token}" -H "Content-Type: application/json" --data-raw '{"value":"on"}'
  ```
  Scope to subdomains/paths with a Configuration Rule (`http.host eq "docs.example.com"` →
  `set_config` `content_converter: true`). Token needs Zone Settings edit.
- **robots.txt / AI crawl rules**: AI Crawl Control can manage them from the dashboard.
- **Link / security headers**: Transform Rules (modify response header) — no origin change.
- **`.well-known` endpoints**: a Worker returning the JSON, or Bulk Redirects/Rules for static docs.
- **OAuth/IdP**: Cloudflare Access can act as the authorization server.
- **A2A/MCP**: the Agents SDK builds compatible agents on Workers.
- **Web Bot Auth**: Cloudflare can verify inbound bot request signatures.

---

## Express / Node

```js
import helmet from "helmet";
import express from "express";
const app = express();

app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], frameAncestors: ["'none'"] } } }));
app.use((req, res, next) => {
  res.setHeader("Content-Signal", "ai-train=yes, search=yes, ai-input=yes");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.get("/robots.txt", (_, res) => res.type("text/plain").send(ROBOTS));
app.get("/llms.txt",   (_, res) => res.type("text/plain").send(LLMS));
app.get("/.well-known/api-catalog", (_, res) =>
  res.type("application/linkset+json").json(API_CATALOG));
app.get("/.well-known/oauth-authorization-server", (_, res) => res.json(OAUTH_AS));
app.get("/", (_, res) => {
  res.append("Link", '</.well-known/api-catalog>; rel="api-catalog"');
  // content negotiation:
  res.format({ "text/markdown": () => res.type("text/markdown").send(toMd(pageHtml)),
               "text/html": () => res.send(pageHtml), default: () => res.send(pageHtml) });
});
```

---

## Static hosting (S3, GitHub Pages, Netlify, plain web root)

Drop literal files at the right paths — no server logic needed:
```
/robots.txt
/sitemap.xml
/llms.txt
/auth.md
/.well-known/api-catalog
/.well-known/oauth-authorization-server
/.well-known/oauth-protected-resource
/.well-known/agent-card.json
/.well-known/agent-skills/index.json
/.well-known/mcp/server-card.json
/.well-known/http-message-signatures-directory
/.well-known/acp.json
/.well-known/ucp
```
Set Content-Types via the host's config (e.g. Netlify `_headers`, S3 `ContentType`,
GitHub Pages `.nojekyll` + a `_config`/`web.config`). Security/Link/Content-Signal headers
go in the host's headers file:
```
# Netlify _headers
/*
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Content-Signal: ai-train=yes, search=yes, ai-input=yes
  Link: </.well-known/api-catalog>; rel="api-catalog"
```
> Markdown-for-Agents needs server logic — on pure static hosting, pre-render `.md`
> variants at build time and rewrite via the host's edge rules, or front it with a Worker.

---

## CI wiring

Add the validator to the pipeline so regressions fail the build:
```yaml
- run: npx webagent-skills audit ${{ env.PREVIEW_URL }} --json --category seo,security
```
Exit code is non-zero when any `core` check fails.
