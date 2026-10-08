# Security Response Headers

Check id: `securityHeaders` (core). These harden every response against clickjacking,
MIME sniffing, XSS, and protocol downgrade. The validator reports all-present → PASS,
partial → WARN, none → FAIL.

## The six headers

| Header | Recommended value | Defends against |
|--------|-------------------|-----------------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | HTTP downgrade / MITM. **Only send over HTTPS.** |
| `Content-Security-Policy` | see below | XSS, data injection, clickjacking (`frame-ancestors`) |
| `X-Frame-Options` | `DENY` (or `SAMEORIGIN`) | Clickjacking. Redundant if CSP `frame-ancestors` is set — send both for old browsers. |
| `X-Content-Type-Options` | `nosniff` | MIME-type sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Feature abuse; disable what the site doesn't use |

Optional legacy: `X-XSS-Protection: 1; mode=block` (deprecated; CSP supersedes it).

## A pragmatic CSP starting point

Tighten per site. `'unsafe-inline'` for scripts should be removed once nonces/hashes
are in place; keep it only if the framework injects inline scripts you can't yet nonce.

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
font-src 'self' data:;
connect-src 'self' https: wss:;
media-src 'self' data: blob: https:;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none'
```

Notes:
- `frame-ancestors 'none'` in CSP is the modern equivalent of `X-Frame-Options: DENY`;
  the validator accepts it as a substitute when XFO is absent.
- Development usually needs `script-src 'unsafe-inline' 'unsafe-eval'` for HMR — gate it
  behind `NODE_ENV`/environment so production stays strict.
- Add third-party origins you actually load (analytics, fonts, CDN) explicitly rather
  than widening to `https:` where avoidable.

## Deployment shape

- Apply to **all** paths (`/(.*)`), not just the homepage.
- HSTS must NOT be sent on plain-HTTP responses; scope it to HTTPS.
- These headers must **survive content conversion** (Markdown-for-Agents) and be
  re-emitted on converted responses — see `markdown-negotiation.md`.
- If a CDN/edge terminates TLS, it can also inject these without origin changes
  (Transform Rules / response-header middleware).

See `adapters.md` → "Security headers" for Next.js `headers()`, nginx `add_header`,
Express `helmet`, and Cloudflare.

## Relationship to inbound/outbound protections

Response headers protect **users loading your site**. Two adjacent concerns this skill
also covers:
- **Outbound SSRF** (your server fetching user-supplied URLs): validate scheme/port, resolve
  DNS and reject private/loopback/link-local/reserved IPs (incl. `169.254.169.254`), re-validate
  on every redirect hop, and cap download size. Not HTTP-detectable — enforce in code.
- **Inbound bot identity** (others verifying your bot): see `web-bot-auth.md`.
