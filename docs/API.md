# Admin REST API

All admin operations on Data Learn are HTTP endpoints under `/api/admin/*`. The admin UI consumes them; external automation can hit the same endpoints with a bearer token.

- **Base URL** in development: `http://localhost:3000/api/admin`
- **Base URL** in production: your deploy URL + `/api/admin`
- **Content type:** `application/json` for all requests with a body
- **Auth:** session cookie (UI) **or** `Authorization: Bearer <api-key>` (automation)

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
  "status": "DRAFT",                           // DRAFT | BETA | PUBLISHED | ARCHIVED — defaults to DRAFT
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
  "expectedOutput": "[{\"name\":\"Alice\",\"total\":8420.5}]",
  "solutionSql": "SELECT c.name, SUM(o.amount) AS total FROM customers c JOIN orders o ON o.customer_id = c.customer_id GROUP BY c.name ORDER BY total DESC LIMIT 3"
}
```

**Notes**

- Provide **exactly one** of `schemaId` or `schemaInline`. Sending both, or neither, is a 400.
- `expectedOutput` must be a JSON-encoded array of row objects. The server parses it during validation.
- `tagSlugs` are upserted by slug; unknown slugs are created with `name = slug.replace(/-/g, " ")`.
- `solutionSql` is optional and stored on the problem for reference / future re-capture.
- The admin UI captures `expectedOutput` automatically by running `solutionSql` against the schema in the browser via DuckDB-WASM. External callers can do the same client-side or compute it however they want.
- **`status`** controls visibility. Only `PUBLISHED` problems show up on the public `/practice` list and `/practice/<slug>` pages; `DRAFT`, `BETA`, and `ARCHIVED` are admin-only. Creating with `status: "PUBLISHED"` triggers a `ProblemVersion` snapshot automatically (see [Versions](#versions)).

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
  "status": "PUBLISHED",     // DRAFT | BETA | PUBLISHED | ARCHIVED
  "description": "…",
  "schemaDescription": "…",
  "ordered": false,
  "hints": ["…"],
  "tagSlugs": ["joins"],     // replaces existing tags
  "schemaId": "cuid…",       // inline schema not supported on update
  "expectedOutput": "[…]",
  "solutionSql": "…"
}
```

> **Note:** Inline schema creation is only supported on `POST`. To swap a problem's schema, create the schema first via `POST /api/admin/schemas`, then `PATCH` the problem with the new `schemaId`.
>
> **Snapshot side-effect:** When `status` transitions from non-`PUBLISHED` to `PUBLISHED` (the typical "promote a draft" flow), a `ProblemVersion` row is created in the same transaction. Edits to an already-published problem do *not* bump version — only re-publishes do.

### `DELETE /api/admin/problems/{slug}`

Hard delete. Cascades to all `Submission` rows and `ProblemReport` rows for the problem.

```bash
curl -X DELETE http://localhost:3000/api/admin/problems/top-customers-by-revenue \
  -H "Authorization: Bearer dl_live_..."
```

**Response 200** `{"ok":true}`

### `GET /api/admin/problems/{slug}/versions`

Returns the immutable snapshot history for a problem, newest first. A new row is created every time `status` transitions to `PUBLISHED`.

```json
{
  "data": [
    {
      "id": "cuid…",
      "versionNumber": 3,
      "title": "Top customers by revenue",
      "ordered": true,
      "tagSlugs": ["joins", "aggregation"],
      "publishedById": "user_cuid",
      "capturedAt": "2026-04-25T11:30:00.000Z"
    },
    { "versionNumber": 2, "…": "…" },
    { "versionNumber": 1, "…": "…" }
  ]
}
```

The full snapshot (including `description`, `schemaSql`, `expectedOutput`, `solutionSql`, `hints`, `schemaDescription`) lives in the `ProblemVersion` table — the list endpoint trims to a header view; query the DB directly if you need the full body.

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

## Reports

User-submitted reports about problems (wrong answer, unclear description, broken schema, typo, other). Currently routed through **server actions**, not REST endpoints — they're called from the client directly via React Server Components. If you need to script report submission externally, ping us and we'll add a REST endpoint.

### Submitting a report (from the UI)

The "Report a problem" link on `/practice/<slug>` opens a dialog backed by `actions/reports.ts::submitProblemReport`:

```ts
await submitProblemReport({
  problemSlug: "top-customers-by-revenue",
  kind: "WRONG_ANSWER",   // | UNCLEAR_DESCRIPTION | BROKEN_SCHEMA | TYPO | OTHER
  message: "The expected output has 'amount' as a string but my correct query returns a number…",
})
```

Auth is **optional** — anonymous reports are allowed (`userId` will be null in the DB).

### Resolving / reopening (admin only)

`actions/reports.ts::resolveProblemReport(reportId)` and `reopenProblemReport(reportId)`. Both gated by admin session. Used by the resolve / reopen buttons on `/admin/reports`.

### Where they show up

- `/admin/reports` — open + resolved sections, with the kind, problem link, reporter, and timestamps.
- AdminNav shows an open-count badge.

The DB shape:

```prisma
model ProblemReport {
  id         String              @id @default(cuid())
  problemId  String
  problem    SQLProblem          @relation(...)
  userId     String?
  user       User?               @relation(...)
  kind       ProblemReportKind   // WRONG_ANSWER | UNCLEAR_DESCRIPTION | BROKEN_SCHEMA | TYPO | OTHER
  message    String              @db.Text
  resolvedAt DateTime?
  resolvedBy String?
  createdAt  DateTime            @default(now())
}
```

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
  "status": "PUBLISHED",
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

### Two-phase publishing pattern (recommended for bulk imports)

For larger imports, prefer creating problems as `DRAFT` first, reviewing them in `/admin/problems`, then promoting to `PUBLISHED`:

```bash
# 1. Create as DRAFT (no snapshot yet, not visible to users)
curl -X POST $BASE/problems -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"slug":"…", "status":"DRAFT", …}'

# 2. After reviewing in the admin UI, promote to PUBLISHED. This
#    transition triggers a ProblemVersion snapshot automatically.
curl -X PATCH $BASE/problems/<slug> -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"status":"PUBLISHED"}'
```

This matches the seed script's pattern in `prisma/seed.ts` for the 12 starter problems and the workflow recommended in [`ADMIN.md`](./ADMIN.md).

---

## Things this API doesn't do (yet)

- Pagination on `GET` endpoints (current dataset is small enough not to need it)
- Filtering / sorting parameters
- Webhooks for content changes
- Rate limiting on bearer auth
- API key scopes (every key is full-admin)
- A REST endpoint for submitting reports externally (currently only via server action; ping us if you need this)
- A "rollback to version N" endpoint (the snapshot data is there in `ProblemVersion`; rolling back is a manual `PATCH` for now)

If you need any of these for production automation, open an issue describing the use case.
