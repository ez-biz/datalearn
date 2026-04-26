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

## Authoring guide — exact data formats

This section is the source of truth for *what* to send to each tool. The Zod validators in `lib/admin-validation.ts` are authoritative; this is the ergonomic version.

### Recommended workflow before `create_problem`

1. **Check existing schemas.** Call `list_schemas`. If a fitting schema exists (e.g. `Ecommerce`), use its `id` as `schemaId` and skip `schemaInline`. Reuse beats duplication — schemas are referenced by every problem that runs against them.
2. **Check existing tags.** Call `list_tags`. The `tagSlugs[]` field on `create_problem` only accepts slugs of tags that already exist. If you want a new tag, call `create_tag` first.
3. **Mirror an existing problem's `expectedOutput`.** Call `get_problem` on a problem that exercises a similar data shape. Match the column names, value types, and key ordering it returns. The validator does row-by-row JSON equality.
4. **Author and submit.** Call `create_problem`. The result lands as DRAFT in `/admin/problems` for human review. You cannot publish via this server.

### Field-by-field reference

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `title` | string | 1–200 chars | Plain text. Title Case (e.g. "Top Selling Products"). |
| `slug` | string | kebab-case, 1–120, `^[a-z0-9]+(?:-[a-z0-9]+)*$` | Globally unique. Used in URLs (`/practice/<slug>`). |
| `difficulty` | enum | `"EASY"` \| `"MEDIUM"` \| `"HARD"` | No `"BEGINNER"` etc. — exact enum. |
| `description` | string | 1–20,000 chars | Markdown supported. Backtick-wrap column/table names: ``Return columns `name` and `total_revenue`.`` |
| `schemaDescription` | string | ≤ 2,000 chars (default `""`) | Short hint shown next to the schema panel. Example: ``Tables: customers, orders, order_items, products``. |
| `ordered` | boolean | default `false` | `true` if the problem requires a specific row order (you wrote `ORDER BY` in the description). When `true`, validation compares arrays positionally; when `false`, it compares as sets. |
| `hints` | string[] | ≤ 10 items, each 1–2,000 chars (default `[]`) | Progressive hints. Optional. |
| `tagSlugs` | string[] | ≤ 10 items (default `[]`) | Slugs of **existing** tags. Call `list_tags` first. |
| `schemaId` | string | optional, must exist | EITHER this OR `schemaInline`. |
| `schemaInline` | object | optional | EITHER this OR `schemaId`. Shape: `{ name, sql }`. |
| `schemaInline.sql` | string | 1–50,000 chars | One string containing CREATE TABLE statements + INSERT seed rows. See "Schema format" below. |
| `expectedOutput` | string | 1–2,000,000 chars, **JSON-stringified array** | Required. Each element is a row object with the columns your SQL returns. See "expectedOutput format" below. |
| `solutionSql` | string | ≤ 20,000 chars | Optional reference solution. Stored alongside the problem; not shown to learners. |
| `status` | — | **NOT ACCEPTED** | The MCP tool input schema omits this field. Every `create_problem` lands as DRAFT. |

### Schema format (`schemaInline.sql` or `create_schema`'s `sql`)

The `sql` field is a single string containing both DDL and seed `INSERT` statements, separated by `;`. It runs in DuckDB-WASM in the learner's browser, so use DuckDB-compatible types:

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name VARCHAR,
    role VARCHAR
);

INSERT INTO users VALUES (1, 'Alice', 'Engineer');
INSERT INTO users VALUES (2, 'Bob', 'Sales');
```

**Type gotchas (DuckDB):**
- Use `DOUBLE` for currency/decimals — **not** `DECIMAL`. DuckDB-WASM's Arrow→JSON conversion returns raw integer mantissas for `DECIMAL`, which breaks `expectedOutput` matching.
- `DATE` and `TIMESTAMP` serialize as ISO strings (`"2023-01-15"`).
- `BOOLEAN` serializes as `true` / `false` (JSON booleans, not strings).

### `expectedOutput` format

A JSON-stringified array of row objects. Each row object's **keys must exactly match** the column names produced by the reference SQL solution (column aliases included). Values are typed naturally:

```json
[
  {"name": "John Doe", "total_revenue": 1450},
  {"name": "Alice Johnson", "total_revenue": 1350},
  {"name": "Jane Smith", "total_revenue": 800}
]
```

Then JSON.stringify it for the `expectedOutput` field:

```json
"[{\"name\":\"John Doe\",\"total_revenue\":1450},{\"name\":\"Alice Johnson\",\"total_revenue\":1350},{\"name\":\"Jane Smith\",\"total_revenue\":800}]"
```

**Rules:**
- Numbers as JSON numbers (`1450`), not strings (`"1450"`).
- Strings double-quoted. NULL columns appear as JSON `null`.
- If `ordered: true`, the order of rows in the array is significant. Otherwise, validation treats it as a set.
- Column ordering inside each row object is **not** significant.
- Dates: whatever DuckDB returns from your SQL — usually `"YYYY-MM-DD"`.

### Worked example: a complete `create_problem` call

This is the JSON the AI sends as `arguments` to the `create_problem` tool. Equivalent to the existing seed problem `total-revenue-per-customer`:

```json
{
  "title": "Total Revenue Per Customer",
  "slug": "total-revenue-per-customer",
  "difficulty": "MEDIUM",
  "description": "Calculate the total revenue generated by each customer who has placed at least one order. Return columns `name` and `total_revenue`. Order by `total_revenue` descending.",
  "schemaDescription": "Tables: customers, orders, order_items, products",
  "ordered": true,
  "schemaId": "<id-from-list_schemas>",
  "tagSlugs": ["aggregations", "joins"],
  "hints": [
    "JOIN customers to orders on customer_id, then sum order totals.",
    "GROUP BY the customer's name and SUM the relevant column."
  ],
  "solutionSql": "SELECT c.name, SUM(o.total_amount) AS total_revenue FROM customers c JOIN orders o ON c.customer_id = o.customer_id GROUP BY c.name ORDER BY total_revenue DESC;",
  "expectedOutput": "[{\"name\":\"John Doe\",\"total_revenue\":1450},{\"name\":\"Alice Johnson\",\"total_revenue\":1350},{\"name\":\"Jane Smith\",\"total_revenue\":800}]"
}
```

If `<id-from-list_schemas>` doesn't exist (no fitting schema), drop `schemaId` and use `schemaInline` instead — the validator enforces exactly-one-of:

```json
{
  ...
  "schemaInline": {
    "name": "Ecommerce",
    "sql": "CREATE TABLE customers (...); INSERT INTO customers VALUES (...);  CREATE TABLE orders (...); INSERT INTO orders VALUES (...);"
  },
  ...
}
```

### Common validation errors and how to recover

The Next API runs Zod validation server-side; failures come back as `McpError(InvalidParams)` with the actual message. The AI sees these and self-corrects. Common ones:

| Server error message | Cause | Fix |
|---|---|---|
| `Provide exactly one of schemaId or schemaInline.` | Both or neither set. | Drop one. |
| `expectedOutput JSON is required.` | Missing field. | Add it. |
| `expectedOutput must be a JSON array of row objects.` | Not valid JSON, or not an array. | Quote-escape, ensure outer brackets. |
| `Slug must be lowercase letters, digits, and hyphens.` | Underscores, spaces, capitals. | Use kebab-case. |
| `409 ... already exists` | Slug collision. | Pick a new slug. |
| `404 ... schema not found` (when using schemaId) | Stale id. | Re-call `list_schemas`. |

### Other tools — quick format notes

**`create_topic`** — for *articles* (not problems). Topics group learning articles; they are not used by problems.
```json
{ "name": "SQL Fundamentals", "slug": "sql-fundamentals", "description": "Optional short blurb." }
```

**`create_tag`** — for *problems*. `slug` is optional; if omitted, it's derived from `name` server-side.
```json
{ "name": "Window Functions", "slug": "window-functions" }
```

**`create_schema`** — independent of any problem. Returns `{ id, name, sql }`. Use the returned `id` as `schemaId` in subsequent `create_problem` calls.
```json
{ "name": "Ecommerce", "sql": "CREATE TABLE customers (...); INSERT INTO customers VALUES (...);" }
```

**`list_problems`** — returns minimal projection (`slug`, `title`, `difficulty`, `status`, `tags`). To inspect `expectedOutput` of a specific problem, follow up with `get_problem`.

**`get_problem`** — input `{ slug }`. Output is the full record including `expectedOutput` and `solutionSql`. Returns `{ found: false }` if no such slug exists; tools should treat that as a normal "not present" signal, not an error.

### What's NOT in v1

- **Articles.** The `create_article` / `submit_article` / `approve_article` tools are deferred to v2. Article authoring stays in the existing UI (`/me/articles` for contributors, `/admin/articles` for admins) for now.
- **Problem updates.** `update_problem`, `archive_problem`, `publish_problem` — deferred. Edit DRAFTs in `/admin/problems` after `create_problem` lands them.
- **Validation pre-flight.** A `validate_problem` tool that runs `solutionSql` against `schemaInline` and checks the produced rows match `expectedOutput` — deferred. For now, errors surface only when a learner actually runs the query.

## Tests

```bash
npm test          # run once (40 unit tests)
npm run test:watch
npm run typecheck
```

## Safety notes

- All `create_problem` calls land as DRAFT. The `status` field is not exposed at the tool layer; it cannot be set to PUBLISHED via this server.
- **The Bearer key authenticates with full admin scope.** The v1 tool surface restricts itself to topics/tags/schemas/problems, but the *key itself* can call any `/api/admin/*` route directly (users, role grants, API key management, article approval, etc.). Treat it as a full admin credential. If leaked, rotate immediately via `/admin/api-keys`.
- Anyone holding the key can also read every problem's `expectedOutput` (answer key) and `solutionSql` (reference solution) via `get_problem` — they're returned in full. The `list_problems` projection deliberately excludes them.
- Periodically check `/admin/api-keys` for unusual `lastUsedAt` activity — abnormal call volume can indicate a leaked or misused key.
- 5xx error messages from the API are not surfaced raw to the MCP client (they're logged to stderr); a generic `upstream error (HTTP <status>)` is returned instead, so paths/stack traces in API error fields don't leak.
- This server is local-only (stdio transport). HTTP/remote MCP transport is not part of v1.
