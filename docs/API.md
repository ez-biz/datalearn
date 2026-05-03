# Admin REST API

All admin operations on Data Learn are HTTP endpoints under `/api/admin/*`. The admin UI consumes them; external automation can hit the same endpoints with a bearer token.

- **Base URL** in development: `http://localhost:3000/api/admin`
- **Base URL** in production: your deploy URL + `/api/admin`
- **Content type:** `application/json` for all requests with a body
- **Auth:** session cookie (UI) **or** `Authorization: Bearer <api-key>` (automation)

> **Tip — for AI-driven authoring** of SQL problems: the [`mcp-server/`](../mcp-server/) package wraps the relevant subset of these endpoints as MCP tools (`list_topics`, `create_topic`, `list_tags`, `create_tag`, `list_schemas`, `create_schema`, `update_schema`, `list_problems`, `get_problem`, `create_problem`, `update_problem`). Use it from Claude Desktop / Cursor / any MCP-aware client instead of hand-writing curl scripts. See [`mcp-server/README.md`](../mcp-server/README.md) for install + per-tool data formats. The MCP server uses the same Bearer-key auth path documented below; it forces `status: DRAFT` on every `create_problem` so AI-authored content lands in the admin review queue, while `update_problem` can deliberately publish or archive reviewed problems.

## Authentication

`lib/api-auth.ts::requireAdmin()` accepts either:

1. A logged-in session whose user has `role = 'ADMIN'`, or
2. An `Authorization: Bearer <plaintext>` header that matches a non-revoked, non-expired `ApiKey` whose owner is an admin.

Bearer keys are SHA-256 hashed at rest. Plaintext is shown **once** at creation time — you must record it then. `lastUsedAt` is touched best-effort on each successful auth.

### Failure modes

| Status | Meaning |
|--------|---------|
| 401 | Missing or invalid credentials (no session, missing bearer, unknown key, revoked key, expired key) |
| 403 | Authenticated but not an admin |
| 400 | Validation failed; details under `details` (see below) |
| 404 | Resource not found |
| 409 | Conflict, typically a duplicate slug or schema name |
| 500 | Unhandled server error |

Validation errors return a treeified shape from Zod:

```json
{
  "error": "Validation failed",
  "details": {
    "errors": [],
    "properties": {
      "slug": { "errors": ["Slug must be lowercase letters, digits, and hyphens."] }
    }
  }
}
```

### Generating an API key

In the UI: visit **/admin/api-keys**, give the key a name, click **Generate**, copy the plaintext immediately.

Or via the API itself (must be authed as admin via session first):

```bash
curl -X POST http://localhost:3000/api/admin/api-keys \
  -H "Content-Type: application/json" \
  -b "next-auth.session-token=..." \
  -d '{"name":"CI seeder"}'
```

The response includes `data.plaintext` — store it in your secret manager. Only the prefix is shown after.

---

## Problems

### `GET /api/admin/problems`

List all problems, ordered by most recent.

```bash
curl http://localhost:3000/api/admin/problems \
  -H "Authorization: Bearer dl_live_..."
```

**Response 200**

```json
{
  "data": [
    {
      "id": "cuid…",
      "number": 247,
      "title": "Top customers by revenue",
      "slug": "top-customers-by-revenue",
      "difficulty": "MEDIUM",
      "description": "…",
      "schemaDescription": "",
      "schemaId": "cuid…",
      "expectedOutput": "[…json…]",
      "solutionSql": "SELECT …",
      "ordered": true,
      "hints": ["…"],
      "createdAt": "2026-04-25T10:34:00.000Z",
      "updatedAt": "2026-04-25T10:34:00.000Z",
      "schema": { "id": "cuid…", "name": "ecommerce" },
      "tags": [{ "id": "cuid…", "name": "joins", "slug": "joins" }],
      "_count": { "submissions": 42 }
    }
  ]
}
```

### `POST /api/admin/problems`

Create a problem. Either provide an existing `schemaId` **or** an inline `schemaInline` — exactly one.

**Body**

```jsonc
{
  "title": "Top customers by revenue",
  "slug": "top-customers-by-revenue",          // lowercase, hyphenated
  "difficulty": "MEDIUM",                      // EASY | MEDIUM | HARD
  "description": "Return the 3 customers with the highest total revenue…",
  "schemaDescription": "",                     // optional prose; defaults to ""
  "ordered": true,                             // does row order matter?
  "hints": ["Try a JOIN on customer_id", "Don't forget GROUP BY"],
  "tagSlugs": ["joins", "aggregation"],        // tags upserted by slug
  "schemaId": "cuid_of_existing_schema",       // pick existing, OR…
  "schemaInline": {                            // …create one inline
    "name": "ecommerce",
    "sql": "CREATE TABLE customers (…); INSERT INTO customers VALUES (…);"
  },
  "solutions": {
    "DUCKDB": "SELECT c.name, SUM(o.amount) AS total FROM customers c JOIN orders o ON o.customer_id = c.customer_id GROUP BY c.name ORDER BY total DESC LIMIT 3",
    "POSTGRES": "SELECT c.name, SUM(o.amount) AS total FROM customers c JOIN orders o ON o.customer_id = c.customer_id GROUP BY c.name ORDER BY total DESC LIMIT 3"
  },
  "expectedOutputs": {
    "DUCKDB": "[{\"name\":\"Alice\",\"total\":8420.5}]",
    "POSTGRES": "[{\"name\":\"Alice\",\"total\":8420.5}]"
  },
  // Legacy single-field fallbacks (v0.4.2 transition; removed in the cleanup release):
  "expectedOutput": "[{\"name\":\"Alice\",\"total\":8420.5}]",
  "solutionSql": "SELECT …"
}
```

**Notes**

- Provide **exactly one** of `schemaId` or `schemaInline`. Sending both, or neither, is a 400.
- **Per-dialect maps (v0.4.2+)**: `solutions` and `expectedOutputs` are keyed by `Dialect`. Every key must be a member of `dialects[]`. PUBLISHED problems must have a non-empty entry for every listed dialect. DRAFT/BETA/ARCHIVED tolerate partial population.
- **Legacy fields**: `solutionSql` and `expectedOutput` (singular) are still accepted; the server replicates them across every listed dialect into the new maps. Both legacy fields will be dropped in the cleanup release.
- Each `expectedOutputs[d]` value (and the legacy `expectedOutput`) must be a JSON-encoded array of row objects.
- `tagSlugs` are upserted by slug; unknown slugs are created with `name = slug.replace(/-/g, " ")`.
- The admin UI captures `expectedOutputs[<active dialect>]` automatically by running that dialect's solution against the schema in the browser. External callers can do the same client-side or compute it however they want.
- The response's `number` is the **stable display ID** (`#247.` LeetCode-style). It's minted server-side as `MAX(number)+1` inside the create transaction; you cannot supply it in the request, and it is never recycled — even after archive — so external callers can persist it as a stable foreign key.

**Response 201**

```json
{ "data": { "id": "cuid…", "slug": "top-customers-by-revenue", "…": "…" } }
```

**Errors**

- `400` validation failed (see Failure modes)
- `400` `schemaId does not match any SqlSchema.`
- `409` `A problem with that slug already exists.`

### `GET /api/admin/problems/{slug}`

Fetch one problem. Includes the schema's full `sql` (for the editor) and tag list.

### `PATCH /api/admin/problems/{slug}`

Partial update. All fields optional. Tag updates **replace** (not append) — send the full desired set.

**Body**

```jsonc
{
  "title": "…",
  "slug": "…",
  "difficulty": "EASY",
  "description": "…",
  "schemaDescription": "…",
  "status": "ARCHIVED",
  "ordered": false,
  "dialects": ["DUCKDB", "POSTGRES"],
  "hints": ["…"],
  "tagSlugs": ["joins"],     // replaces existing tags
  "schemaId": "cuid…",       // inline schema not supported on update
  "expectedOutput": "[…]",
  "solutionSql": "…"
}
```

> **Note:** Inline schema creation is only supported on `POST`. To swap a problem's schema, create the schema first via `POST /api/admin/schemas`, then `PATCH` the problem with the new `schemaId`.
>
> Unlike `POST`, `PATCH` does **not** create missing tags. `tagSlugs` must all exist and replaces the full tag set. Use `status: "ARCHIVED"` to hide a problem without deleting submissions.

### `DELETE /api/admin/problems/{slug}`

Hard delete. Cascades to all `Submission` rows for the problem.

```bash
curl -X DELETE http://localhost:3000/api/admin/problems/top-customers-by-revenue \
  -H "Authorization: Bearer dl_live_..."
```

**Response 200** `{"ok":true}`

---

## Schemas

### `GET /api/admin/schemas`

```json
{
  "data": [
    {
      "id": "cuid…",
      "name": "ecommerce",
      "sql": "CREATE TABLE …",
      "createdAt": "…",
      "updatedAt": "…",
      "_count": { "problems": 5 }
    }
  ]
}
```

### `POST /api/admin/schemas`

```jsonc
{
  "name": "hr",
  "sql": "CREATE TABLE employees (…); INSERT INTO employees VALUES (…);"
}
```

**Errors**

- `409` `A schema with that name already exists.`

### `PATCH /api/admin/schemas/{id}`

Partial update. Both fields are optional; omitted fields are left unchanged.

```jsonc
{
  "name": "hr-v2",
  "sql": "CREATE TABLE employees (…); INSERT INTO employees VALUES (…);"
}
```

**Errors**

- `404` `Not found.`
- `409` `A schema with that name already exists.`

> **Type recommendation:** Use `DOUBLE` (not `DECIMAL`) for currency / floating point columns. DuckDB-WASM's Arrow→JSON conversion returns raw integer mantissas for `DECIMAL`, which breaks validation.

---

## Tags

### `GET /api/admin/tags`

Lists all tags with usage counts. Useful for building autocomplete UIs.

### `POST /api/admin/tags`

Upsert by slug. If `slug` is omitted, it's derived from `name`.

```jsonc
{ "name": "Window functions", "slug": "window-functions" }
```

Returns the upserted record. Tag creation also happens implicitly when you submit a problem with new `tagSlugs`.

---

## API keys

Manage keys for external automation.

### `GET /api/admin/api-keys`

Lists all keys (active + revoked). The `keyHash` is **never** returned.

```json
{
  "data": [
    {
      "id": "cuid…",
      "name": "CI seeder",
      "prefix": "dl_live_a3b4",
      "lastUsedAt": "2026-04-25T11:30:00.000Z",
      "expiresAt": null,
      "revokedAt": null,
      "createdAt": "…",
      "createdBy": { "id": "cuid…", "name": "Anchit", "email": "…" }
    }
  ]
}
```

### `POST /api/admin/api-keys`

Create a key. **The plaintext is returned exactly once.** Store it in your secret manager.

```jsonc
{
  "name": "CI seeder",
  "expiresAt": "2027-01-01T00:00:00.000Z"   // optional
}
```

**Response 201**

```json
{
  "data": {
    "id": "cuid…",
    "name": "CI seeder",
    "prefix": "dl_live_a3b4",
    "expiresAt": null,
    "createdAt": "…",
    "plaintext": "dl_live_<base64url-32-bytes>"
  }
}
```

### `DELETE /api/admin/api-keys/{id}`

Soft revoke — sets `revokedAt`. Subsequent requests using the key return 401 with `API key has been revoked.`

---

## End-to-end example: seed a new problem from a script

```bash
KEY="dl_live_..."  # generated once via /admin/api-keys

curl -X POST http://localhost:3000/api/admin/problems \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
{
  "title": "Customers by country",
  "slug": "customers-by-country",
  "difficulty": "EASY",
  "description": "Return every customer whose country is USA. Return columns customer_id, name, email, country.",
  "ordered": false,
  "hints": [],
  "tagSlugs": ["filtering"],
  "schemaInline": {
    "name": "ecommerce-mini",
    "sql": "CREATE TABLE customers (customer_id INTEGER, name VARCHAR, email VARCHAR, country VARCHAR); INSERT INTO customers VALUES (1, 'Alice', 'a@e.com', 'USA'), (2, 'Bob', 'b@e.com', 'UK');"
  },
  "expectedOutput": "[{\"customer_id\":1,\"name\":\"Alice\",\"email\":\"a@e.com\",\"country\":\"USA\"}]",
  "solutionSql": "SELECT customer_id, name, email, country FROM customers WHERE country = 'USA'"
}
EOF
```

That's everything you need to script content onboarding from CSV / spreadsheets / wherever your problem bank lives today.

---

## Custom problem lists

Custom problem lists (`/me/lists`) are intentionally **not exposed via this REST surface** in v1.

They are owner-private, user-scoped data — every operation needs the calling user's identity, not an admin Bearer key. The platform implements them as Server Actions (`actions/lists.ts`) which talk to Prisma directly under the active session. There is no `/api/lists` or `/api/me/lists` route.

If we need programmatic access later (e.g. to expose lists to MCP or to a contributor's own scripts), the path will be:

1. A new `/api/me/lists/*` REST surface that authenticates by the user's session (same pattern as `/api/me/articles/*`).
2. Or extending the MCP server's auth model to support per-user keys instead of admin-only.

Either is a deliberate v2 expansion — see `docs/ROADMAP.md` § V8.

---

## Things this API doesn't do (yet)

- Pagination on `GET` endpoints (current dataset is small enough not to need it)
- Filtering / sorting parameters
- Webhooks for content changes
- Rate limiting on bearer auth
- API key scopes (every key is full-admin)
- Custom problem lists (see section above — server actions only in v1)

If you need any of these for production automation, open an issue describing the use case.
