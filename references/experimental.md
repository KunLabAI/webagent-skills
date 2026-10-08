# Experimental: DNS-AID & WebMCP

Early-adopter mechanisms. Both are legitimately `skip`/`manual` for most sites — adopt
only if you have a concrete need and can maintain them.

## DNS-AID — DNS for AI Discovery

Lets agents discover your agent endpoints **through DNS** instead of HTTP, under the
`_agents` namespace of your domain.

- Publish `SVCB` records (ServiceMode), or `HTTPS` records for HTTPS endpoints, under
  names like `_index._agents.example.com` or `_a2a._agents.example.com`.
- Include `alpn` and endpoint connection parameters (`port`, etc.).
- Use numeric `keyNNNNN` SvcParamKey names for experimental custom parameters until they
  are formally registered.
- **Sign the discovery zone with DNSSEC** so validating resolvers return authenticated data.

Example zone record:
```dns
_a2a._agents.example.com. 3600 IN SVCB 1 agent.example.com. alpn="a2a" port=443 mandatory=alpn,port
```

Validation is via DNS-over-HTTPS. The validator queries `_index._agents.<host>` (type `SVCB`)
against `https://cloudflare-dns.com/dns-query`, falling back to `https://dns.google/resolve`;
override with `--doh URL` (disables fallback). A record is `pass` when the resolver returns
`Status: 0` with a non-empty `Answer`.

Practical notes:
- Requires DNS write access + DNSSEC — usually done in the registrar/DNS provider UI or
  zone file, not in application code. An agent typically cannot do this without credentials.
- Keep DNS-AID records consistent with the HTTP `.well-known` cards they point to.

## WebMCP — expose site tools in the browser

Lets an AI agent drive your page through tools you register in the browser, via the
`navigator.modelContext` API (Web Machine Learning CG; shipped as a Chrome origin trial).

```js
// Register a tool on page load
const ac = new AbortController();
navigator.modelContext?.registerTool({
  name: "search_products",
  description: "Search the catalog by keyword.",
  inputSchema: {
    type: "object",
    properties: { query: { type: "string" } },
    required: ["query"],
  },
  execute: async ({ query }) => {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    return res.json();
  },
}, { signal: ac.signal });

// Unregister when no longer needed
// ac.abort();
```

Requirements:
- Call `registerTool()` for each tool: `name`, `description`, `inputSchema` (JSON Schema),
  `execute` callback.
- Expose the site's key actions (search, navigation, data retrieval).
- Use an `AbortController` signal to unregister when done.
- The script must run on page load — detection works by loading the page in a real browser.

Detection caveat: WebMCP is observable **only in a browser that supports and runs the API**.
The validator reports it as `manual` (not detectable over plain HTTP). Verify with a headless
browser that asserts `navigator.modelContext` is used and tools are registered.

Security: tools execute real actions — scope them to public, safe operations; require the
same authZ the UI would; never expose a tool that bypasses server-side permission checks.
