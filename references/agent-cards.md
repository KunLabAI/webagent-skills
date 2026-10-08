# Agent Discovery Cards

Covers: `a2aAgentCard`, `agentSkills`, `mcpServerCard`. These let autonomous agents find
and use your service. Publish only the ones matching what you actually expose.

## A2A Agent Card — A2A Protocol

`GET /.well-known/agent-card.json` → `application/json`, HTTP 200. Describes an agent for
agent-to-agent discovery.

```json
{
  "name": "Example Research Agent",
  "version": "1.0.0",
  "description": "Searches and summarizes Example's knowledge base.",
  "url": "https://agent.example.com/a2a",
  "preferredTransport": "JSONRPC",
  "supportedInterfaces": [
    { "url": "https://agent.example.com/a2a", "transport": "JSONRPC" }
  ],
  "capabilities": { "streaming": true, "pushNotifications": false },
  "defaultInputModes": ["text/plain"],
  "defaultOutputModes": ["text/plain"],
  "skills": [
    { "id": "search", "name": "Search", "description": "Full-text search over docs",
      "tags": ["search", "docs"], "examples": ["find release notes about X"] }
  ]
}
```

- Required: `name`, `version`, `description`, a service URL + transport, `capabilities`,
  and `skills[]` (each `id`, `name`, `description`).
- **AP2 extension** (agent payments): add an `extensions`/`skills` extension entry with
  `uri` `https://github.com/google-agentic-commerce/AP2/tree/v0.1.0` and `params.roles`
  declaring your role (`merchant`, `shopper`, `credentials-provider`, `payment-processor`).
  Merchant agents mark the extension `required`. See `commerce.md`.
- Verify the exact schema against the current A2A spec (`a2a-protocol.org`) — field names
  evolve (e.g. `agent.json` vs `agent-card.json`).

## Agent Skills Discovery Index — Agent Skills Discovery RFC v0.2.0

`GET /.well-known/agent-skills/index.json` → `application/json`, HTTP 200. Lists installable
SKILL.md skills so agents can fetch and run them.

```json
{
  "$schema": "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
  "skills": [
    {
      "name": "content-signals",
      "type": "skill-md",
      "description": "Publish Content-Signal preferences in robots.txt and headers.",
      "url": "https://example.com/.well-known/agent-skills/content-signals/SKILL.md",
      "digest": "sha256:9f2c…ab1"
    }
  ]
}
```

- `$schema` must be exactly `https://schemas.agentskills.io/discovery/0.2.0/schema.json`.
- Each `skills[]` entry: `name` (lowercase alphanumeric + hyphens), `type` (`skill-md` for a
  single SKILL.md, `archive` for a bundled archive), `description`, `url` (artifact), and
  `digest` (`sha256:{hex}` of the artifact — lets agents verify integrity before running).
- Compute the digest over the exact bytes served at `url`. This is how you publish **this**
  skill (and any others) for autonomous discovery.

## MCP Server Card — MCP SEP-1649

`GET /.well-known/mcp/server-card.json` → `application/json`, HTTP 200. Advertises a
Model Context Protocol server.

```json
{
  "serverInfo": { "name": "example-mcp", "version": "1.2.0" },
  "endpoint": "https://example.com/mcp",
  "transport": "streamable-http",
  "capabilities": {
    "tools": { "listChanged": true },
    "resources": { "subscribe": false },
    "prompts": { "listChanged": false }
  }
}
```

- Required: `serverInfo` (`name`, `version`), a transport `endpoint` (e.g. `/mcp` for
  Streamable HTTP), and `capabilities` (tools/resources/prompts the server supports).
- SEP-1649 is still a proposal — pin to the version your server implements and re-check
  the spec before relying on optional fields.

## Notes

- These cards describe **public** capabilities. Never embed secrets, private endpoints,
  or credentials in them.
- Keep `url`/`endpoint` values absolute and reachable; agents will fetch them.
- Serve with permissive-enough CORS for agent fetches, but do not widen site-wide CORS
  to `*` just for these — scope it to the `.well-known` paths if needed.
