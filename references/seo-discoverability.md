# SEO & Discoverability

Covers: `robotsTxt`, `contentSignals`, `aiRules`, `sitemap`, `llmsTxt`, `linkHeaders`.
Artifacts are universal; delivery snippets live in `adapters.md`.

## robots.txt — RFC 9309

Serve `/robots.txt` as `text/plain`, HTTP 200. Rules are grouped per `User-agent`;
`Allow`/`Disallow` are path prefixes. Reference the sitemap so crawlers find it.

```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /settings
Disallow: /login

Sitemap: https://example.com/sitemap.xml
Host: https://example.com
```

Rules of thumb:
- Disallow private/authenticated/admin paths and internal APIs; allow marketing/content.
- A missing robots.txt means "everything allowed" — publish one to be explicit.
- `Sitemap:` may appear multiple times; keep it absolute.

## Content-Signal — contentsignals.org

Declare how the content may be used *after* access. Two valid placements:

1. **robots.txt directive** (site-wide preference):
   ```
   Content-Signal: ai-train=no, search=yes, ai-input=no
   ```
2. **HTTP response header** (per-response, authoritative over the robots default):
   ```
   Content-Signal: ai-train=yes, search=yes, ai-input=yes
   ```

Tokens: `ai-train` (model training), `search` (search results), `ai-input`
(agentic/LLM use). Values `yes`/`no`. **Ask the owner before choosing permissive
values** — this is a policy statement, not a technical default. If a Markdown
conversion layer runs, an origin-set `Content-Signal` header must be preserved;
when absent, a converter may apply `ai-train=yes, search=yes, ai-input=yes`.

## AI crawler rules

Name AI bots explicitly so policy is unambiguous (matching `*` is not enough for
clear intent). Common agents:

| Bot | Operator |
|-----|----------|
| `GPTBot`, `OAI-SearchBot` | OpenAI |
| `ClaudeBot`, `Claude-Web`, `anthropic-ai` | Anthropic |
| `Google-Extended` | Google (AI training opt-out) |
| `PerplexityBot` | Perplexity |
| `CCBot` | Common Crawl |
| `Bytespider` | ByteDance |

```
User-agent: GPTBot
Allow: /blog/
Disallow: /

User-agent: Google-Extended
Allow: /
```

## sitemap.xml — Sitemaps protocol

Serve `/sitemap.xml` as valid XML, HTTP 200. List canonical public URLs; refresh on
publish/remove; reference it from robots.txt.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2026-10-08T00:00:00.000Z</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

Large sites: use a `<sitemapindex>` splitting into ≤50k-URL child sitemaps. Prefer
generating URLs dynamically from the data source over a hand-maintained list.

## llms.txt — machine-readable site summary

A concise Markdown brief at `/llms.txt` so an LLM can understand the site without
crawling. Structure: H1 name, `>` one-paragraph summary, then curated sections and
links. Keep it factual and short; it is not a sitemap replacement.

```markdown
# Example Inc.

> Example Inc. builds developer tools for XYZ, with a focus on ABC.

## Product
- [Overview](https://example.com/): what it does
- [Docs](https://example.com/docs): integration guides

## Optional
- [Changelog](https://example.com/changelog)
```

## Link headers — RFC 8288 / RFC 9727 §3

Advertise machine-readable resources from the homepage so agents discover them
without guessing `.well-known` paths. Use registered relation types.

```
Link: </.well-known/api-catalog>; rel="api-catalog"
Link: </llms.txt>; rel="describedby"; type="text/plain"
Link: </openapi.yaml>; rel="service-desc"; type="application/vnd.oai.openapi"
Link: </docs>; rel="service-doc"; type="text/html"
```

Multiple `Link` headers or one comma-separated header are both valid. Edge platforms
can inject these without touching the origin (Transform Rules / reverse proxy).
