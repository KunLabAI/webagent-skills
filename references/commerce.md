# Agent Commerce Protocols

Covers: `acp`, `ap2`, `mpp`, `ucp`, `x402`. **Only relevant if the site transacts.**
For a non-commerce site these are legitimately `skip`/`manual` — do not add payment
endpoints just to turn a check green. Each protocol is young; pin to the version you
implement and re-check the spec.

## ACP — Agentic Commerce Protocol

`GET /.well-known/acp.json` → `application/json`, HTTP 200.

```json
{
  "protocol": { "name": "acp", "version": "0.1.0" },
  "api_base_url": "https://api.example.com/acp",
  "transports": ["https+json"],
  "capabilities": {
    "services": ["product_search", "checkout", "order_status"]
  }
}
```

Required: `protocol.name` = `"acp"`, `protocol.version`, absolute `api_base_url`,
non-empty `transports[]`, non-empty `capabilities.services[]`. Ensure referenced spec
URLs/schemas are reachable.

## AP2 — Agent Payments Protocol

An **extension of the A2A Agent Card** (see `agent-cards.md`), not a standalone endpoint.
Add an extension entry:

```json
{
  "extensions": [
    {
      "uri": "https://github.com/google-agentic-commerce/AP2/tree/v0.1.0",
      "params": { "roles": ["merchant"] },
      "required": true
    }
  ]
}
```

`params.roles` ∈ `merchant`, `shopper`, `credentials-provider`, `payment-processor`.
Merchant agents mark `required: true`. Enables cryptographically-signed payment mandates.
The validator reports AP2 as `manual` — verify the card declares the uri + roles.

## MPP — Machine Payment Protocol (payment discovery)

Publish payment metadata inside your OpenAPI document.
`GET /openapi.json` → `application/json`, HTTP 200, with `x-payment-info` on payable ops:

```json
{
  "openapi": "3.1.0",
  "info": { "title": "Example API", "version": "1.0" },
  "x-service-info": { "categories": ["data", "media"] },
  "paths": {
    "/report": {
      "get": {
        "x-payment-info": {
          "intent": "charge",
          "method": "stripe",
          "amount": "2.00",
          "currency": "USD",
          "description": "Full report download"
        }
      }
    }
  }
}
```

`intent` ∈ `charge`|`session`; `method` ∈ `tempo`|`stripe`|`lightning`|`card`; `amount`
required. Optional: `currency`, `description`, top-level `x-service-info.categories`.

## UCP — Universal Commerce Protocol

`GET /.well-known/ucp` → `application/json`, HTTP 200.

```json
{
  "protocol_version": "0.1.0",
  "services": [{ "name": "checkout", "endpoint": "https://api.example.com/ucp/checkout" }],
  "capabilities": ["content_payments"],
  "endpoints": { "manifest": "https://api.example.com/ucp/manifest" }
}
```

Required: `protocol_version`, `services`, `capabilities`, `endpoints`. Referenced spec
URLs and schemas must be reachable.

## x402 — agent-native HTTP payments

Add x402 payment middleware to API routes; protected routes return **HTTP 402** with
payment requirements the agent fulfills automatically, then retries.

- Middleware packages: `@x402/express`, `@x402/hono`, `@x402/next`.
- Configure a **facilitator URL** and a **wallet address**.
- Flow: client hits a paid route → `402 Payment Required` with terms → client pays via the
  facilitator → retries with proof → `200`.

```js
// Express sketch
import { withPayment } from "@x402/express";
app.use("/paid", withPayment({ facilitatorUrl: process.env.X402_FACILITATOR,
  payTo: process.env.X402_WALLET }));
```

The validator reports x402 as `manual` — it will not trigger a charge. Verify with a test
that asserts a `402` + payment-requirements body on a known paid route.

## Safety

- Keep wallet addresses, facilitator secrets, and signing keys in the secret store.
- Amounts/currencies must be server-authoritative — never trust client-supplied prices.
- Test payment flows against sandbox/test facilitators before production.
