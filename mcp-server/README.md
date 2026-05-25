# datalearn-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets an MCP-aware assistant (Claude Desktop, Cursor, etc.) author SQL problems on Data Learn through structured tool calls.

## Tools

| Tool | What it does |
|---|---|
| `list_topics`, `create_topic` | Article topics (problems use tags, not topics). |
| `list_tags`, `create_tag` | Problem tags. |
| `list_schemas`, `create_schema`, `update_schema` | SQL schemas (DDL + seed in one `sql` string). |
| `list_problems` | List problems (minimal projection, optional `difficulty` filter). |
| `get_problem` | Fetch a single problem's full record by slug (use this to learn the `expectedOutput` JSON shape). |
| `create_problem` | Create a new problem. **Always lands as DRAFT** — publish manually via the admin UI. |
| `update_problem` | Patch an existing problem by slug. Can replace tags, rename with `newSlug`, and set `status` to `DRAFT`, `PUBLISHED`, or `ARCHIVED`. |
| `set_problem_hidden_dataset` | Write and validate hidden contest test data for a problem by slug. Records a `WRITE_HIDDEN_TEST` audit row. |
| `publish_contest` | Read-only contest readiness validator. Checks hidden-data status without revealing hidden test bodies; does not change contest state. |
| `list_articles` | List Learn articles (minimal projection, optional `topicSlug` and `status` filters). |
| `get_article` | Fetch a single article's full record by slug, including `content` markdown. |
| `create_article` | Create a new Learn article. **Always lands as DRAFT** — publish via `update_article` or the admin UI. Supports v0.5.0 directive syntax. |
| `update_article` | Patch an existing article by slug. PATCH semantics — `content` REPLACES the current value entirely. Can rename via `newSlug` and transition `status`. |
| `submit_article` | Move a DRAFT article to SUBMITTED for admin review. Idempotent. Clears prior `reviewNotes`. |
| `approve_article` | Promote SUBMITTED (or DRAFT/ARCHIVED) → PUBLISHED. Runs Layer 2 directive validation; snapshots an immutable article version. |
| `reject_article` | Send a SUBMITTED article back to DRAFT with required `reviewNotes` (1–4000 chars) for the author. |
| `archive_article` | Hide an article from the public reader without deleting it. Version history is preserved. |
| `delete_topic` | Permanently delete a topic. 409 if articles still reference it. |
| `delete_track` | Delete a track. Hard-delete if DRAFT with zero items; otherwise soft-archived to ARCHIVED. |
| `list_api_keys`, `create_api_key`, `revoke_api_key` | Admin API-key lifecycle. **`create_api_key` returns the plaintext key once** — surface it with an explicit "save now" warning. |
| `list_users`, `update_user_role` | List users (filterable by role and substring); change a user's role to USER, CONTRIBUTOR, or MODERATOR. ADMIN transitions are intentionally rejected — use psql. |
| `list_moderators`, `grant_moderator`, `update_moderator_permissions`, `revoke_moderator` | Moderator role + permission management. Permissions: `VIEW_DISCUSSION_QUEUE`, `HIDE_COMMENT`, `RESTORE_COMMENT`, `DISMISS_REPORT`, `MARK_SPAM`, `LOCK_PROBLEM_DISCUSSION`, `HIDE_PROBLEM_DISCUSSION`. |
| `list_assets`, `delete_asset` | Vercel Blob asset management. `delete_asset` strips referencing `:::figure` blocks and snapshots affected PUBLISHED articles. |
| `list_assets`, `delete_asset` | Vercel Blob asset management. `delete_asset` strips referencing `:::figure` blocks and snapshots affected PUBLISHED articles. |

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

Restart Claude Desktop. The full tool surface (42 tools as of v0.8.0) appears under the `datalearn` namespace.

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
5. Lands as DRAFT in `/admin/problems`. Review, then publish via the admin UI or a deliberate `update_problem` call.

## Visual article authoring

From v0.5.0, Learn articles can be authored through MCP (`create_article` / `update_article`) — DRAFT only at create time, with the review workflow (`submit_article` / `approve_article` / `reject_article` / `archive_article`) shipping in v0.6.0. The app UI remains the human-friendly alternative:

- Contributors: `/me/articles/new` and `/me/articles/<slug>/edit`
- Admins: `/admin/articles/new` and `/admin/articles/<slug>/edit`

Whichever surface you use, the same directives + publish validation apply. The article editor has an insert menu for the five supported visual directives and a My uploads panel that inserts active uploads as `figure` blocks. Publishing runs the same validation used by the public renderer:

- `figure` requires `src` and `alt`; `src` must be `/learn/...` or an active Vercel Blob asset owned by the article author.
- `mermaid` requires `alt`; Mermaid SVG output is sanitized client-side before insertion.
- `steps` requires an ordered list.
- `side-by-side` requires exactly one Markdown horizontal rule separator.
- `callout` supports `tip`, `pitfall`, `warning`, and `note`.

Minimal examples:

```markdown
:::figure{src="/learn/img/joins-hero.svg" alt="Two tables joined by customer_id"}
Rows match where the key values are equal.
:::

:::mermaid{alt="Join execution flow"}
flowchart LR
  scan[Scan tables] --> match[Match join keys] --> project[Return columns]
:::

:::callout{kind="pitfall"}
An INNER JOIN drops rows that do not find a match.
:::
```

## Authoring guide — exact data formats

This section is the source of truth for *what* to send to each tool. The Zod validators in `lib/admin-validation.ts` are authoritative; this is the ergonomic version.

### Recommended workflow before `create_problem`

1. **Check existing schemas.** Call `list_schemas`. If a fitting schema exists (e.g. `Ecommerce`), use its `id` as `schemaId` and skip `schemaInline`. Reuse beats duplication — schemas are referenced by every problem that runs against them.
2. **Check existing tags.** Call `list_tags`. The `tagSlugs[]` field on `create_problem` only accepts slugs of tags that already exist. If you want a new tag, call `create_tag` first.
3. **Mirror an existing problem's `expectedOutput`.** Call `get_problem` on a problem that exercises a similar data shape. Match the column names, value types, and key ordering it returns. The validator does row-by-row JSON equality.
4. **Author and submit.** Call `create_problem`. The result lands as DRAFT in `/admin/problems` for human review. Use `update_problem` only after review to publish or archive.

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
| `solutions` | object | `{ "DUCKDB": "SELECT …", "POSTGRES": "SELECT …" }` (v0.4.2+) | Per-dialect canonical solutions. Keys must be a subset of `dialects[]`. Either this OR the legacy `solutionSql` is required. |
| `expectedOutputs` | object | `{ "DUCKDB": "[{…}]", "POSTGRES": "[{…}]" }` (v0.4.2+) | Per-dialect expected output as **JSON-stringified arrays**. Same key constraint. Either this OR the legacy `expectedOutput` is required. |
| `expectedOutput` | string | 1–2,000,000 chars (legacy) | **Deprecated v0.4.2** — server replicates across every listed dialect into `expectedOutputs`. Removed in the cleanup release. |
| `solutionSql` | string | ≤ 20,000 chars (legacy) | **Deprecated v0.4.2** — same lifecycle. Use `solutions` instead. |
| `status` | — | **NOT ACCEPTED on create** | The `create_problem` input schema omits this field. Every `create_problem` lands as DRAFT. Use `update_problem` to change status after review. |

### `update_problem`

`update_problem` identifies the existing problem by `slug`. Only fields you pass are changed; omitted fields are left untouched. To rename the URL slug, pass `newSlug` — this avoids ambiguity between "the slug to find" and "the slug to set".

```json
{
  "slug": "total-revenue-per-customer",
  "title": "Total revenue by customer",
  "newSlug": "total-revenue-by-customer",
  "status": "ARCHIVED",
  "tagSlugs": ["aggregation", "joins"]
}
```

Notes:

- `tagSlugs` replaces the full tag set. Every slug must already exist; call `list_tags` or `create_tag` first.
- `schemaId` may point to an existing schema. Inline schema creation is create-only.
- `status: "ARCHIVED"` hides a problem from learners while preserving submissions.
- Missing problems return `{ "found": false }`.

### `set_problem_hidden_dataset`

`set_problem_hidden_dataset` writes hidden test data for a problem by `slug`. This is required before a problem can be used safely in a rated contest.

Input:

- `slug` — problem slug.
- `hiddenSchemas` — map of `Dialect -> SQL DDL + seed string`.
- `hiddenExpectedOutputs` — map of `Dialect -> expected row array`.

The server runs the problem's canonical solution against each supplied hidden schema before persisting. Calls with mismatched expected rows fail with a validation error. Every successful call records a `WRITE_HIDDEN_TEST` row in `AdminAuditLog`.

### `publish_contest`

`publish_contest` validates whether a scheduled contest is ready to publish. It does not flip contest status; humans still make the publish decision in the admin UI.

Input:

- `contestId` — contest cuid.

For rated contests, the tool checks every attached problem through `/api/admin/problems/<slug>/hidden-data/status`. That endpoint returns dialect coverage, hashes, validation timestamp, and stale-validation state, never hidden schemas or expected rows. Unrated contests return ready without hidden-data checks.

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

**`update_schema`** — input `{ id, name?, sql? }`. Only passed fields change. Returns the updated schema or `{ found: false }`.

**`list_problems`** — returns minimal projection (`number`, `slug`, `title`, `difficulty`, `status`, `tags`). `number` is the stable display ID (`#247.` LeetCode-style) — minted at create-time, never recycled. To inspect `expectedOutput` of a specific problem, follow up with `get_problem`.

**`get_problem`** — input `{ slug }`. Output is the full record including `expectedOutput` and `solutionSql`. Returns `{ found: false }` if no such slug exists; tools should treat that as a normal "not present" signal, not an error.

**`update_problem`** — input `{ slug, ...fields }`, with `newSlug` for slug rename. Returns the same full shape as `get_problem`, or `{ found: false }` if the current slug does not exist.

**`set_problem_hidden_dataset`** — input `{ slug, hiddenSchemas, hiddenExpectedOutputs }`. Validates canonical solutions against the hidden data before writing; returns hidden-data metadata, not hidden test bodies.

**`publish_contest`** — input `{ contestId }`. Returns `{ ready, issues }`; uses bodies-free hidden-data status checks and never mutates contest state.

### Articles (v0.5.0+, review workflow v0.6.0+)

Article tools mirror the problem-tool shape: `list_articles`, `get_article`, `create_article`, `update_article`. The DRAFT-guard pattern is the same — `create_article` does not accept a `status` field; articles always land in DRAFT and require a human publish via the review workflow below.

**Review workflow (v0.6.0+).** Four dedicated tools drive status transitions so the lifecycle is explicit instead of buried in `update_article`:

- **`submit_article({ slug })`** — DRAFT → SUBMITTED. Author handoff for admin review. Idempotent. Clears any prior `reviewNotes`. Rejected if the article is PUBLISHED or ARCHIVED (move back to DRAFT first via `update_article`).
- **`approve_article({ slug })`** — SUBMITTED → PUBLISHED (also accepted from DRAFT or ARCHIVED for direct publishes). Runs **Layer 2 directive validation** server-side — every `:::figure` URL must resolve to an `ACTIVE` `Asset` row owned by the article author; foreign Blob URLs and missing alts are rejected with the per-directive error list. Snapshots an immutable article version on success.
- **`reject_article({ slug, reviewNotes })`** — SUBMITTED → DRAFT. `reviewNotes` is required (1–4000 chars) and is shown to the author when they reopen the editor; be specific. Rejected if the article is not currently SUBMITTED.
- **`archive_article({ slug })`** — any → ARCHIVED. Hides the article from the public reader; version history is kept. Idempotent.

All four return `{ ok: true, status: "<NEW_STATUS>" }` on success, or `{ found: false }` if the slug does not exist.

**Directive syntax in `content`:** v0.5.0 ships five `remark-directive` block directives — `:::figure`, `:::mermaid`, `:::steps`, `:::side-by-side`, `:::callout`. See `docs/superpowers/prompts/learn-v2-article-author.md` for the full directive grammar and authoring conventions. The MCP server runs a Prisma-free Layer 1 directive check before POSTing — bad `alt`, foreign `src` URLs, or invalid `callout` kinds fail fast with a clear error.

**Figure assets:** `create_article` and `update_article` accept figure URLs but cannot upload images. The author or a human editor must upload via the admin "My uploads" panel first, copy the resulting `*.vercel-storage.com` URL, and paste it into the `:::figure{src="..."}` attribute. Repo-committed `/learn/img/...` paths also work.

**Publishing:** `update_article({ slug, status: "PUBLISHED" })` triggers Layer 2 (Prisma-aware) validation on the resulting article state. Figure URLs must resolve to ACTIVE `Asset` rows owned by the article author — foreign Blob URLs and cross-owner assets are rejected with no admin override in v1.

**Read-before-write for edits.** `update_article.content` REPLACES the article body wholesale. Always call `get_article` first, modify the markdown locally, then send the full modified content back. Same applies to `tagSlugs` and `relatedProblemSlugs` arrays — present means replace, absent means leave unchanged.

### What's NOT exposed

- **`delete_problem` / `delete_article`** — intentionally absent. Archive with `update_problem` / `update_article` / `archive_article` (status=ARCHIVED) so submission history and version snapshots are preserved. `delete_topic` and `delete_track` are available from v0.7.0 (topic deletion blocks on referencing articles; tracks soft-archive when non-empty).
- **Discussion moderation tools.** The `/api/admin/discussions*` routes use session-cookie auth that explicitly rejects Bearer headers — designing a bearer-compatible path is its own security-design conversation. Until then, comment moderation happens through the admin UI.
- **Validation pre-flight.** A `validate_problem` tool that runs `solutionSql` against `schemaInline` and checks the produced rows match `expectedOutput` — deferred. For now, errors surface only when a learner actually runs the query.

## Tests

```bash
npm test          # run once (40 unit tests)
npm run test:watch
npm run typecheck
```

## Safety notes

- All `create_problem` calls land as DRAFT. `update_problem` can change `status`, so treat publish/archive calls as deliberate admin actions.
- **The Bearer key authenticates with full admin scope.** The v1 tool surface restricts itself to topics/tags/schemas/problems, but the *key itself* can call any `/api/admin/*` route directly (users, role grants, API key management, article approval, etc.). Treat it as a full admin credential. If leaked, rotate immediately via `/admin/api-keys`.
- Anyone holding the key can also read every problem's `expectedOutput` (answer key) and `solutionSql` (reference solution) via `get_problem` — they're returned in full. The `list_problems` projection deliberately excludes them.
- Periodically check `/admin/api-keys` for unusual `lastUsedAt` activity — abnormal call volume can indicate a leaked or misused key.
- 5xx error messages from the API are not surfaced raw to the MCP client (they're logged to stderr); a generic `upstream error (HTTP <status>)` is returned instead, so paths/stack traces in API error fields don't leak.
- This server is local-only (stdio transport). HTTP/remote MCP transport is not part of v1.
