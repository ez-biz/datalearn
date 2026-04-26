# MCP Server for Data Learn — v1 Design

**Date:** 2026-04-26
**Status:** Approved (awaiting written-spec review)
**Branch:** `feat/mcp-server`

## Goal

Let an AI assistant (Claude Desktop, Cursor, any MCP-aware client) author SQL problems on the Data Learn platform through structured tool calls instead of through hand-written REST scripts. v1 is scoped to the **problem-authoring path**; articles, updates, and approval flows are explicitly out of scope.

The user's framing: MCP is the long-term primary integration surface for trusted/admin-grade authoring. Less-trusted collaborators continue to use the existing UI (`/me/articles`) gated by admin approval. This MCP server is the admin tool, not a contributor tool.

## Non-goals

- Article authoring, updates, approval, or archive flows.
- Problem updates / publish / archive (v1 always creates DRAFT — see "Safety on writes").
- A user-facing UI for installing the MCP server.
- A hosted/remote HTTP transport. Stdio only for v1.
- Publishing to npm. Local install only.
- Read-only "ask AI about platform state" tools — covered by the existing admin UI.

## Architecture

### Where it lives

`mcp-server/` subdirectory in the existing `datalearn` repo. Own `package.json`, own deps, own build output. **Not** a workspace setup — a sibling project that happens to share the repo so it can directly import the existing Zod validators.

When external collaborators eventually need access (and we want a `npx @datalearn/mcp` install path), this directory extracts cleanly to its own npm package or repo. That extraction is deferred until there's a real reason to do it.

### Directory layout

```
datalearn/
├── lib/admin-validation.ts           # existing — pure Zod, single source of truth for input shapes
├── mcp-server/                       # NEW
│   ├── package.json                  # deps: @modelcontextprotocol/sdk, zod, tsup, vitest
│   ├── tsconfig.json
│   ├── tsup.config.ts                # bundles src/ + ../lib/admin-validation into dist/
│   ├── src/
│   │   ├── index.ts                  # MCP server entry — stdio transport, registers tools
│   │   ├── client.ts                 # HTTPS client wrapping fetch + Bearer auth + error mapping
│   │   ├── errors.ts                 # API error → McpError translation
│   │   └── tools/
│   │       ├── topics.ts             # list_topics, create_topic
│   │       ├── tags.ts               # list_tags, create_tag
│   │       ├── schemas.ts            # list_schemas, create_schema
│   │       └── problems.ts           # list_problems, get_problem, create_problem
│   ├── tests/
│   │   ├── client.test.ts            # unit: auth header, error mapping
│   │   └── tools.test.ts             # unit: each tool's input schema + output unwrapping
│   ├── dist/                         # build output (gitignored)
│   └── README.md                     # install + Claude Desktop config + example usage
└── …rest of Next app unchanged
```

### Build

`tsup` bundles `src/index.ts` plus the relative `../lib/admin-validation` import into a single `dist/index.js`. The bundler resolves the cross-directory import at build time and inlines the validators into the output. No workspace setup, no Next config changes.

### Runtime

The server runs as `node mcp-server/dist/index.js` over stdio. MCP clients launch it as a subprocess and pipe stdin/stdout. It reads two env vars (passed by the client's mcpServers config block):

- `DATALEARN_API_KEY` (required) — Bearer key created via `/admin/api-keys`.
- `DATALEARN_BASE_URL` (required) — e.g. `https://datalearn.app` or `http://localhost:3000`.

The server refuses to start if either is missing, so misconfiguration surfaces immediately rather than on the first tool call.

### Talks to

The existing admin REST endpoints under `/api/admin/{topics, tags, schemas, problems}`. Bearer auth flows through the hardened `withAdmin` path that PR #17 just shipped (edge middleware bypasses Bearer requests; `withAdmin` validates against the `ApiKey` table; CSRF gate is unaffected because Authorization header sets the bearer-path, not the cookie path).

All endpoints wrap responses as `{ data: ... }` on success and `{ error, details? }` on failure — the MCP client unwraps `data` before returning to the tool layer.

**No new API endpoints are required for v1.**

## Tool catalog

Each tool's input is a Zod schema (re-exported from `lib/admin-validation` where possible); output is the API's JSON response unwrapped to a minimal shape. Tool descriptions explicitly tell the AI:

- `expectedOutput` must be a JSON array of row objects.
- For `create_problem`, exactly one of `schemaId` or `schemaInline` must be set.
- Created problems always land as `DRAFT` and require manual publish via the admin UI.

| Tool | Input | Output | Notes |
|---|---|---|---|
| `list_topics` | `{}` | `Topic[]` | `{ id, slug, title, description }` |
| `create_topic` | `TopicCreateInput` | `Topic` | reuses `lib/admin-validation` Zod |
| `list_tags` | `{}` | `Tag[]` | `{ id, slug, name }` |
| `create_tag` | `TagCreateInput` | `Tag` | |
| `list_schemas` | `{}` | `SqlSchema[]` | `{ id, slug, title, ddl }` — AI checks for an existing fitting schema before inlining |
| `create_schema` | `SqlSchemaCreateInput` | `SqlSchema` | seed DDL + sample data |
| `list_problems` | `{ difficulty? }` | `Problem[]` | minimal projection: `{ slug, title, difficulty, status, tags }`. **Excludes** `expectedOutput` and `solutionSql` to keep responses small. The existing `GET /api/admin/problems` endpoint returns all problems; the MCP server filters by `difficulty` client-side and projects fields. No API changes required. |
| `get_problem` | `{ slug }` | `Problem` (full) | full record including `expectedOutput`; AI uses this to learn the JSON shape it must produce for new problems |
| `create_problem` | `ProblemCreateInput` **minus `status`** | `Problem` | always lands as `DRAFT`. Accepts `schemaId` OR `schemaInline` per existing Zod refinement. |

### Safety on writes

`create_problem`'s tool input schema **omits** the `status` field entirely. The MCP server hardcodes `status: "DRAFT"` before sending to the API. Even if the AI tries to publish directly, it can't — the field is invisible at the tool layer. Publishing remains a deliberate human action via the admin UI.

This matches the existing platform philosophy (DRAFT → human review → PUBLISHED) that's already in place for articles and was the explicit decision recorded for problems.

## Error handling

The HTTPS client wrapper translates API errors into appropriate MCP error types so the AI receives actionable feedback:

| API status | MCP error | AI behavior |
|---|---|---|
| 400 (Zod validation) | `McpError(InvalidParams, body.error)` | AI sees the exact validation message and self-corrects (e.g., "slug already exists" → AI picks a new slug and retries). |
| 401 / 403 | `McpError(InvalidRequest, "auth failed: ...")` | Bubbles up so user notices a bad/missing key. |
| 404 (on `get_*` tools) | Returns `{ found: false }` | Idiomatic — AI handles missing resource gracefully. |
| 404 (other) | Throws `McpError(InvalidParams, ...)` | Wrong slug/id passed. |
| 5xx | `McpError(InternalError, ...)` + log full body to stderr | Surfaces server bugs. |

## Configuration & startup

```typescript
// src/index.ts startup contract
const apiKey = process.env.DATALEARN_API_KEY
const baseUrl = process.env.DATALEARN_BASE_URL
if (!apiKey) throw new Error("DATALEARN_API_KEY is required")
if (!baseUrl) throw new Error("DATALEARN_BASE_URL is required")
// ... server.connect(stdioTransport)
```

stderr is the only log channel (MCP convention; clients pipe stderr to a log file). No structured logging library — `console.error` is sufficient for v1.

## Testing

- **Unit (`vitest`)**:
  - `client.test.ts`: Bearer header injection, error-status → MCP-error mapping for each status code, base URL normalization (trailing slash handling).
  - `tools.test.ts`: each tool's input Zod schema validates representative correct inputs and rejects malformed ones; output unwrapping works on representative API responses.
- **No integration tests** against a live Next app in v1. The existing E2E suite (`tests/e2e/security.spec.ts`, `tests/e2e/middleware-and-link-guard.spec.ts`) already covers `/api/admin/*` Bearer auth paths end-to-end. If MCP↔Next drift becomes an issue, add a thin smoke test in v2.

## Distribution (v1)

Local-only. README in `mcp-server/` documents the Claude Desktop config:

```json
{
  "mcpServers": {
    "datalearn": {
      "command": "node",
      "args": ["/abs/path/datalearn/mcp-server/dist/index.js"],
      "env": {
        "DATALEARN_API_KEY": "dl_live_...",
        "DATALEARN_BASE_URL": "https://datalearn.app"
      }
    }
  }
}
```

User flow:
1. `cd mcp-server && npm install && npm run build`
2. Generate API key at `/admin/api-keys` in the running app.
3. Add the config block above to Claude Desktop's `claude_desktop_config.json`.
4. Restart Claude Desktop. Ask: "Create a SQL problem about window functions on the orders schema, MEDIUM difficulty."

Extraction to a published npm package (`@datalearn/mcp`) is deferred until external collaborators need it — at that point the directory either gets `npm publish`-ed as-is or extracted to its own repo.

## Open questions

None blocking v1. Followups for v2 (not part of this spec):

- Article authoring tools (`create_article`, `submit_article`, etc.).
- Update tools (`update_problem`, `archive_problem`).
- HTTP/SSE transport for remote MCP usage.
- A `validate_problem` tool that runs the SQL validator and returns mismatches before creating.

## Decisions log (from brainstorming)

- **Q1 (placement)**: A — `mcp-server/` subdirectory in this repo, stdio transport.
- **Q2 (v1 scope)**: A — problem-authoring tools only.
- **Q3 (validators)**: A — direct relative import, bundled by tsup.
- **Q4 (write safety)**: B — force DRAFT in v1, omit `status` from tool input.
