# datalearn-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets an MCP-aware assistant (Claude Desktop, Cursor, etc.) author SQL problems on Data Learn through structured tool calls.

## Tools

| Tool | What it does |
|---|---|
| `list_topics`, `create_topic` | Article topics (problems use tags, not topics). |
| `list_tags`, `create_tag` | Problem tags. |
| `list_schemas`, `create_schema` | SQL schemas (DDL + seed in one `sql` string). |
| `list_problems` | List problems (minimal projection, optional `difficulty` filter). |
| `get_problem` | Fetch a single problem's full record by slug (use this to learn the `expectedOutput` JSON shape). |
| `create_problem` | Create a new problem. **Always lands as DRAFT** — publish manually via the admin UI. |

## Install

```bash
cd mcp-server
npm install
npm run build
```

Output: `dist/index.js` (single bundled file with shebang).

## Run

The server expects two env vars:

- `DATALEARN_API_KEY` — Bearer key from `/admin/api-keys` on the running app.
- `DATALEARN_BASE_URL` — e.g. `https://datalearn.app` or `http://localhost:3000`.

`http://` is rejected for any host other than `localhost` / `127.0.0.1` / `::1` to prevent accidentally leaking the API key over plaintext.

## Claude Desktop config

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) and add:

```json
{
  "mcpServers": {
    "datalearn": {
      "command": "node",
      "args": ["/abs/path/to/datalearn/mcp-server/dist/index.js"],
      "env": {
        "DATALEARN_API_KEY": "dl_live_...",
        "DATALEARN_BASE_URL": "https://datalearn.app"
      }
    }
  }
}
```

Restart Claude Desktop. The 9 tools appear under the `datalearn` namespace.

### Local development

Run alongside a local Next dev server:

1. From repo root: `npm run dev` (starts Next on port 3000).
2. Sign in as ADMIN and generate a key at `http://localhost:3000/admin/api-keys`.
3. Add a second entry to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "datalearn-local": {
      "command": "node",
      "args": ["/abs/path/to/datalearn/mcp-server/dist/index.js"],
      "env": {
        "DATALEARN_API_KEY": "dl_live_local_...",
        "DATALEARN_BASE_URL": "http://localhost:3000"
      }
    },
    "datalearn": {
      "command": "node",
      "args": ["/abs/path/to/datalearn/mcp-server/dist/index.js"],
      "env": {
        "DATALEARN_API_KEY": "dl_live_prod_...",
        "DATALEARN_BASE_URL": "https://datalearn.app"
      }
    }
  }
}
```

The two servers appear under different namespaces (`datalearn-local`, `datalearn`); ask the AI to use whichever you intend.

When you change tool definitions: rerun `npm run build` (or `npm run dev` for watch mode). The Next dev server doesn't need restarting.

## Example prompt

> "Create a MEDIUM problem on the orders schema about window functions. Use the existing `orders` schema if it exists; show me the expectedOutput for an existing problem first so you match the shape."

The AI will:

1. Call `list_schemas` → find `orders`.
2. Call `list_problems` → find an existing problem to model the `expectedOutput` shape.
3. Call `get_problem` on a similar problem → see the full JSON.
4. Call `create_problem` with `schemaId: "<orders-id>"`, generated SQL solution, and a matching `expectedOutput`.
5. Lands as DRAFT in `/admin/problems`. Review, fix, publish.

## Tests

```bash
npm test          # run once (40 unit tests)
npm run test:watch
npm run typecheck
```

## Safety notes

- All `create_problem` calls land as DRAFT. The `status` field is not exposed at the tool layer; it cannot be set to PUBLISHED via this server.
- Bearer keys have full admin power. Keep them out of source control. Rotate via `/admin/api-keys` if leaked.
- 5xx error messages from the API are not surfaced raw to the MCP client (they're logged to stderr); a generic `upstream error (HTTP <status>)` is returned instead, so paths/stack traces in API error fields don't leak.
- This server is local-only (stdio transport). HTTP/remote MCP transport is not part of v1.
