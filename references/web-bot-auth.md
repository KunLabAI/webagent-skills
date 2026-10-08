# Web Bot Auth (outbound bot identity)

Check id: `webBotAuth` (optional). Lets **your** bot/agent cryptographically identify
itself when it makes requests to *other* sites, so they can verify and trust it — the
inbound counterpart to allow-listing crawlers in robots.txt. Based on HTTP Message
Signatures (RFC 9421) and the IETF WebBotAuth working group.

## Two halves

1. **Publish a public key directory (JWKS)** so verifiers can check your signatures.
2. **Sign your outbound requests** with the corresponding private key.

## 1. JWKS directory

`GET /.well-known/http-message-signatures-directory` → `application/json`, HTTP 200,
a JWKS with ≥1 public key:

```json
{
  "keys": [
    {
      "kty": "OKP",
      "crv": "Ed25519",
      "kid": "2026-10-bot-key",
      "use": "sig",
      "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo"
    }
  ]
}
```

- Publish **public** keys only. The private key stays in your secret store / KMS — never
  in the repo, never in the JWKS.
- Use `kid` to allow rotation: publish the new key before switching signers, keep the old
  one until in-flight requests expire.
- Ed25519 (`OKP`) or ECDSA (`EC`, `P-256`) are typical.

## 2. Signing outbound requests (RFC 9421)

Sign selected request components and send the signature headers. Receiving sites verify
against your JWKS (looked up via the `Signature-Agent` / key id).

```http
GET /api/data HTTP/1.1
Host: target.example
Signature-Input: sig1=("@method" "@target-uri" "@authority");keyid="2026-10-bot-key";alg="ed25519";created=1760000000
Signature: sig1=:MEUCIQDx…base64…:
Signature-Agent: https://example.com/
```

- `Signature-Input` declares the covered components and signing parameters (`keyid`,
  `alg`, `created`, optional `expires`, `nonce`).
- `Signature` carries the base64 signature (`:…:` is the RFC 9421 byte-sequence format).
- `Signature-Agent` identifies the signing agent (a URL resolving to your JWKS/agent card).
- Cover at least `@method`, `@target-uri`, `@authority`; add `content-digest` +
  `content-type` when there's a body (bind the body with a `Content-Digest` header).

## Design guidance

- Sign at the HTTP client layer so every outbound bot request is covered uniformly
  (a thin wrapper around `fetch`/`httpx`), not per-call-site.
- Bind the body (Content-Digest) for any request with a payload to prevent tampering.
- Set a short `expires` and/or a `nonce` to limit replay.
- Rotate keys on a schedule; the JWKS `kid` lets verifiers pick the right key.
- Verify your **own** inbound verification path (if you also verify other bots) rejects
  unsigned/expired/unknown-key requests and never trusts a `Signature-Agent` it can't
  resolve over HTTPS.

## Relationship to SSRF defense

Web Bot Auth proves *who is calling*. It does **not** make an outbound target safe to
fetch. When your server fetches user- or agent-supplied URLs, still apply SSRF defenses
(scheme/port allow-list, DNS resolution + private/loopback/link-local/reserved IP rejection
including `169.254.169.254`, per-hop re-validation on redirects, size caps). Signing and
SSRF-safety are complementary, not substitutes.

## Validation

The validator (`war audit`) fetches the JWKS directory and asserts `keys[]` is present and JSON-valid.
It cannot verify that your outbound requests are actually signed — confirm that with an
integration test that asserts the three `Signature*` headers on a captured request.
