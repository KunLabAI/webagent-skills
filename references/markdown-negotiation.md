# Markdown-for-Agents (content negotiation)

Check id: `markdownNegotiation` (soft/recommended). Deliver clean, formatting-stripped
Markdown to agents instead of forcing them to parse dense HTML — fewer tokens, better
comprehension.

## Principle

The underlying mechanism is **standard HTTP content negotiation** (RFC 9100 §12): the
client sends `Accept: text/markdown`; the server returns Markdown while keeping HTML as
the browser default. Cloudflare offers this as a managed zone feature (`content_converter`),
but it is **not required** — any origin or edge can implement it. Prefer a self-hosted
implementation for portability; treat the Cloudflare toggle as one adapter among many
(see `adapters.md`).

```bash
curl https://example.com/about -H "Accept: text/markdown"
```

Negotiation rule (respect q-values): serve Markdown only when `text/markdown` has
`q>0` **and** is not lower than `text/html`. This keeps browsers (which send
`text/html` first) on HTML, and honors explicit agent requests.

## Output format (predictable, three parts)

1. **YAML frontmatter** from `<meta>` tags — emitted only if ≥1 supported tag exists:
   | Field | Source `<meta>` (standard form wins over `og:` fallback) |
   |-------|------|
   | `title` | `<meta name="title">` → `<meta property="og:title">` |
   | `description` | `<meta name="description">` → `<meta property="og:description">` |
   | `image` | `<meta property="og:image">` |
2. **Body Markdown** — converted from the document body. Strip non-content elements:
   `script`, `style`, `noscript`, `template`, `nav`, `header`, `footer`, `aside`,
   `iframe`, `svg`, `canvas`, `[aria-hidden="true"]`, `[hidden]`.
3. **JSON-LD** — preserve every `<script type="application/ld+json">` as one fenced
   ` ```json ` block at the end (each script on its own line). JSON-LD is the *only*
   script content retained.

## Response headers

Set on the converted response:
- `Content-Type: text/markdown; charset=utf-8`
- `Vary: Accept` (append to any origin `Vary`) so caches store HTML and Markdown separately
- `Content-Length` recomputed for the Markdown byte length
- `x-markdown-tokens` and `x-original-tokens` (estimates for context budgeting / savings)
- `Content-Signal` — **preserve the origin's value**; if absent, a converter may default to
  `ai-train=yes, search=yes, ai-input=yes`

**Preserve** origin security/cache headers on the converted body: `Strict-Transport-Security`,
`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`, `Set-Cookie`, CORS (`Access-Control-Allow-*`), `Cache-Control`,
`Expires`, `Age`.

**Remove** headers that described the original body and no longer match:
`Content-Encoding`, `Content-Range`, `Transfer-Encoding`, `ETag`, `Last-Modified`
(conditional requests can't be honored for converted responses).

## Implementation notes

- Self-hosted pattern: a middleware detects the `Accept` preference and internally
  rewrites to a conversion route (kept **outside** `/api/` so backend proxy rules don't
  swallow it). The route re-fetches the page's own HTML with an internal marker header
  (to avoid a conversion loop and rate-limit double-count), converts, and returns Markdown.
- Token estimation: weight CJK (~1.5 chars/token) vs. other (~4 chars/token) for a rough count.
- Limits (Cloudflare managed feature): HTML→Markdown only; origin response ≤ 2 MB.
- Conversion must never leak private/authenticated content — negotiate only on public
  routes, and forward the request's auth context so protected pages stay protected.

See `adapters.md` → "Content negotiation" for Next.js / nginx+Lua / Cloudflare / Express.
