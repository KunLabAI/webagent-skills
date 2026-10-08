# Discovery & OAuth

Covers: `apiCatalog` (RFC 9727), `oauthAS` (RFC 8414), `oidc` (OIDC Discovery),
`oauthPRM` (RFC 9728), `authMd` (auth.md). All are `.well-known` JSON/Markdown documents.
Publish only what applies — a static marketing site needs none of these; an API or
agent platform benefits from all.

## API Catalog — RFC 9727

`GET /.well-known/api-catalog` → `Content-Type: application/linkset+json`, HTTP 200.
A `linkset` array advertising each API. Advertise it from the homepage with a
`Link: </.well-known/api-catalog>; rel="api-catalog"` header (see `seo-discoverability.md`).

```json
{
  "linkset": [
    {
      "anchor": "https://api.example.com/",
      "service-desc": [
        { "href": "https://api.example.com/openapi.json", "type": "application/openapi+json" }
      ],
      "service-doc": [
        { "href": "https://docs.example.com/", "type": "text/html" }
      ],
      "status": [
        { "href": "https://status.example.com/api", "type": "application/json" }
      ]
    }
  ]
}
```

- `anchor` — the API's base URI. `service-desc` — OpenAPI spec. `service-doc` — human docs.
  `status` — optional health endpoint.
- Multiple entries for multiple APIs. See RFC 9727 Appendix A.

## OAuth Authorization Server metadata — RFC 8414

`GET /.well-known/oauth-authorization-server` → `application/json`, HTTP 200.

```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "jwks_uri": "https://auth.example.com/.well-known/jwks.json",
  "registration_endpoint": "https://auth.example.com/register",
  "scopes_supported": ["openid", "profile", "api"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token", "client_credentials"],
  "code_challenge_methods_supported": ["S256"]
}
```

Required core: `issuer`, `authorization_endpoint`, `token_endpoint`, `jwks_uri`.
`issuer` must exactly match what a Protected Resource Metadata doc advertises.
Prefer Dynamic Client Registration (`registration_endpoint`, RFC 7591) so agents can
self-onboard; require PKCE (`S256`) for public clients.

## OIDC Discovery — OpenID Connect Discovery 1.0

`GET /.well-known/openid-configuration` → same shape as RFC 8414 plus identity fields:
`userinfo_endpoint`, `subject_types_supported`, `id_token_signing_alg_values_supported`,
and `scopes_supported` including `openid`. Use OIDC when you issue identity tokens; use
plain RFC 8414 for API-only authorization.

## OAuth Protected Resource Metadata — RFC 9728

Tells an agent **how to authenticate to a resource server**.
`GET /.well-known/oauth-protected-resource` → `application/json`, HTTP 200.

```json
{
  "resource": "https://api.example.com",
  "authorization_servers": ["https://auth.example.com"],
  "scopes_supported": ["api:read", "api:write"],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://docs.example.com/api"
}
```

- `resource` — the protected resource identifier (canonical URI).
- `authorization_servers` — array of issuer URLs (must match each AS's `issuer`).
- `bearer_methods_supported` should include `header` (the `Authorization: Bearer` method).
- On a `401`, also return `WWW-Authenticate: Bearer resource_metadata="https://api.example.com/.well-known/oauth-protected-resource"`
  so a client can bootstrap discovery from the challenge (RFC 9728 §5).

The well-known path may be suffixed with the resource path for host-meta style
(`/.well-known/oauth-protected-resource/<path>`) when multiple resources share a host.

## Auth.md — agent registration discovery

`GET /auth.md` → Markdown, HTTP 200, with an **H1 containing `auth.md`** (e.g. `# auth.md`
or `# Example auth.md`). A human+machine readable entry point describing how an agent
registers and authenticates.

When OAuth metadata is available, include an `agent_auth` block:
```markdown
# auth.md

This resource supports agent authentication via OAuth 2.0.

agent_auth:
  skill: https://example.com/.well-known/agent-skills/auth/SKILL.md
  register_uri: https://auth.example.com/register
  methods:
    - identity_assertion   # ID-JAG
    - verified_email
    - client_credentials
```

Flow metadata to declare (pick what you support):
- **ID-JAG** (identity assertion): `identity_types_supported: ["identity_assertion"]`;
  `identity_assertion.assertion_types_supported` including
  `urn:ietf:params:oauth:token-type:id-jag`; credential types; `revocation_uri` +
  revocation event in `events_supported` (scanners may warn if omitted; not required).
- **Verified email**: `identity_assertion.assertion_types_supported` with `verified_email`,
  credential types, and `claim_uri`.
- **Anonymous**: `identity_types_supported: ["anonymous"]`, `anonymous.credential_types_supported`, `claim_uri`.

If OAuth metadata is NOT available, keep `/auth.md` self-contained: identify the agent
audience, document registration/provisioning endpoints, list supported methods, explain
credential use.

**Safety**: never `POST /agent/auth` (or the `register_uri`) during a passive audit —
registration can create accounts, send email, or issue credentials. Read the public
discovery documents only.
