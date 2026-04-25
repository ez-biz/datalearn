# Admin portal walkthrough

How to author SQL problems on Data Learn from end to end.

## Becoming an admin

1. Sign in via GitHub or Google at `/api/auth/signin` (this creates your `User` row).
2. Promote yourself in the database:

   ```bash
   psql "$DATABASE_URL" -c "UPDATE \"User\" SET role='ADMIN' WHERE email='you@example.com';"
   ```

3. Reload — the navbar now shows an **Admin** link, and `/admin/*` becomes accessible. Non-admins are redirected to `/`.

## Admin home

Navigate to `/admin` for the overview, or use the nav strip at the top of every admin page:

```
Overview · Problems · Schemas · Tags · Reports · API keys
```

The Reports tab shows a small badge with the count of unresolved reports.

Most CRUD goes through the REST API at `/api/admin/*` (see [`docs/API.md`](./API.md) for the full reference). Reports use server actions instead — same auth gating.

---

## Authoring a problem

Visit **`/admin/problems`** → click **New problem**.

The editor is one long form, broken into cards. Top to bottom:

### 1. Basics

- **Title** — what users see in the problem list. The **slug** auto-derives until you manually type into the slug field.
- **Slug** — URL identifier. Lowercase letters, digits, hyphens. Used in `/practice/<slug>` and `/admin/problems/<slug>/edit`.
- **Difficulty** — Easy / Medium / Hard. Drives the badge color and the by-difficulty stats on profile.
- **Status** — `DRAFT` / `BETA` / `PUBLISHED` / `ARCHIVED`. Only `PUBLISHED` shows on the public `/practice` list and at `/practice/<slug>`. Defaults to `DRAFT` for new problems. Promoting a problem to `PUBLISHED` snapshots an immutable `ProblemVersion` automatically (see [Version snapshots](#version-snapshots)).
- **Ordered comparison** — check this for problems where row order matters (any `ORDER BY` problem). When unchecked, the validator compares as a multiset.
- **Description** — the problem prose users read in the Description tab. Plain text, supports `\n` newlines. Don't paste schema here; the schema panel renders separately.
- **Schema description** *(optional)* — short prose, only shown when no input tables are detected (rare for normal SQL problems).

### 2. Schema

Two modes:

- **Use existing** — pick a previously created `SqlSchema` from the dropdown. Best for problems that share a dataset.
- **Create new** — define the schema inline. Provide a unique `name` and the full DDL + seed data:

  ```sql
  CREATE TABLE customers (
    customer_id INTEGER PRIMARY KEY,
    name VARCHAR,
    email VARCHAR,
    country VARCHAR
  );
  INSERT INTO customers VALUES (1, 'Alice', 'a@e.com', 'USA');
  INSERT INTO customers VALUES (2, 'Bob', 'b@e.com', 'UK');
  ```

  Inline-create is only available when **creating** a problem; switching schemas on an existing problem requires picking an existing `schemaId`.

> **Type recommendation:** use `DOUBLE` (not `DECIMAL`) for currency. DuckDB-WASM's Arrow→JSON pipeline returns raw integer mantissas for `DECIMAL` and breaks validation. We learned this the hard way during smoke tests.

### 3. Solution & expected output (the killer step)

This is where authoring gets fast.

1. **Type your canonical solution** in the **Solution SQL** field — the query that should produce the correct answer.
2. Click **Run & capture** — the editor:
   - Spins up DuckDB-WASM in your browser (one-time per page load)
   - Loads the schema (existing or inline)
   - Runs your solution
   - Serializes the rows to JSON (BigInt-safe)
   - Auto-fills the **Expected output** field below
   - Reports `Captured N rows.` next to the button
3. Inspect the JSON. The validator compares user submissions against this JSON exactly (with float epsilon tolerance, and ordered/unordered modes).

If the schema engine isn't ready yet, the button waits. If your solution errors, the message shows next to the button.

#### The expected-output field is locked by default

The big textarea is **read-only** unless you tick **Override manually (advanced — prefer Run & capture)**. This is intentional: we want the captured-from-solution path to be the obvious one, since hand-typing JSON is the most common authoring mistake (column-name drift, off-by-one rows, wrong float precision).

#### Capture-fresh gate

Save is **disabled** when:
- Override is off, **and**
- Either no capture has happened yet, **or**
- The current solution / schema differs from what was captured

The Save button shows a tooltip and there's an inline status next to it: *"Solution or schema changed — re-capture, or tick Override below the JSON."* Click **Run & capture** again to refresh.

In edit mode the existing `expectedOutput` is trusted on first load, so you can re-save a problem you didn't touch the solution on.

### 4. Hints

A repeater. Add up to 10. Each hint is a free-text string, max 2000 chars.

- Use the up-arrow handle to reorder.
- The trash icon removes a hint.
- The hints tab on the user-facing workspace reveals one at a time, in this order ("Reveal hint 1 of N").
- If `hints` is empty, the Hints tab simply doesn't appear on the problem page.

### 5. Tags

Free-form, slug-keyed. Two ways to add:

- Type a name and hit Enter / click **Add** — slugified, persisted via `POST /api/admin/tags`, and selected. New tag appears in the "Existing tags" row below.
- Click an existing tag chip to toggle.

Click a selected chip to remove it. Tag updates **replace** the existing tag set on save (not append). Max 10 per problem.

### 6. Save

- **Create problem** → `POST /api/admin/problems`. On success, redirects to the edit page.
- **Save changes** (edit mode) → `PATCH /api/admin/problems/<slug>`. Stays on the edit page.
- **Cancel** returns to the list.

If the request fails, an error banner appears at the top with the server-reported reason. Validation details are logged to the console (`F12`).

---

## Recommended workflow

The full lifecycle most authors use:

1. **Create as DRAFT.** Type basics, pick a schema (or inline-create), write the description, paste your solution.
2. **Run & capture.** Verify the output looks right.
3. **Smoke-test as a user.** Open `/practice/<slug>` in a private window — wait, you can't, drafts 404 for non-admins. Instead, in the editor click `View as user` (TODO — for now, just visit the URL while signed in as admin and submit your own solution to confirm validation passes).
4. **Promote to PUBLISHED.** Change `Status` → `Published` → Save. A `ProblemVersion` snapshot is captured automatically (see below). Problem now visible to users.
5. **Edits later.** When you change description / hints / tags on a published problem, re-save — the captured `expectedOutput` is preserved as long as you didn't change the solution. If you do change the solution, re-capture before save.
6. **Re-publish.** Status doesn't change on subsequent saves to a PUBLISHED problem. To force a new version snapshot, demote to DRAFT/BETA, then back to PUBLISHED.

---

## Version snapshots

Every time a problem transitions **to** `PUBLISHED` (from any other status), an immutable `ProblemVersion` row is created in the same DB transaction as the status update. The snapshot captures:

- Title, description, schema description
- The full `schemaSql` (DDL + seeds — not just a foreign key, so even if the schema mutates later, this version stays intact)
- Expected output JSON
- Solution SQL
- Hints, tags, ordered flag
- The admin who published, and when

This is what you'll reach for the first time someone reports *"this used to be accepted, now it isn't."*

There's no UI viewer in this PR — the data lives in the `ProblemVersion` table and is exposed via `GET /api/admin/problems/<slug>/versions`. Query the DB directly when you need the full history. A viewer page is on the roadmap.

---

## Editing or deleting a problem

From `/admin/problems`:

- Click the row title (or the pencil icon) → edit page
- Click the trash icon → confirm dialog → DELETE. Cascades to all submissions and reports for that problem. **Not undoable.**
- Status badges (`draft`, `beta`, `archived`) appear next to the title for non-PUBLISHED rows. PUBLISHED has no badge.

---

## Schemas page

`/admin/schemas` is read-only by design — schemas are usually created inline alongside the first problem that uses them. Each row shows the name, problem count, and an expandable DDL preview.

To create a standalone schema (e.g. before any problem uses it), use the API directly:

```bash
curl -X POST http://localhost:3000/api/admin/schemas \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"hr","sql":"CREATE TABLE …"}'
```

---

## Tags page

`/admin/tags` shows every tag with its usage count. Tags are created via the problem editor or `POST /api/admin/tags`. There's no rename / merge UI yet — to clean up, edit problems that use a stale tag and write the canonical slug.

---

## Reports inbox

`/admin/reports` is where user-submitted problem reports land. The admin nav badge shows the open count.

### How users submit reports

Every problem page has a **Report a problem** link in the breadcrumb bar (next to "All problems"). Clicking it opens a dialog with:

- A **kind** dropdown: Wrong answer / Unclear description / Broken schema / Typo / Other
- A **details** textarea (max 4000 chars)

Auth is **optional** — anonymous users can report too (`userId` is null in those rows).

### Triaging

Each row shows the kind, a link to the problem page, a quick **edit →** link to the admin editor for that problem, the reporter, and the message.

- **Resolve** — sets `resolvedAt` + `resolvedBy`. The row moves to the **Resolved** section at the bottom.
- **Reopen** — clears `resolvedAt`, moves the row back to **Open**.

The list shows the 25 most recent resolved rows; older ones still exist in the DB (`ProblemReport` table), they just aren't surfaced in the UI yet.

### Common signal-to-action

| Report kind | Typical fix |
|---|---|
| Wrong answer | Re-capture expected output. Often the schema's `INSERT`s changed, or floating-point precision drifted. |
| Unclear description | Edit the description. State column-name requirements explicitly. |
| Broken schema | DDL doesn't run cleanly in DuckDB-WASM, or seeds don't satisfy a sample query. |
| Typo | Quick edit. |
| Other | Read the message; figure it out. |

After fixing, hit Resolve. If the fix was substantial enough to warrant a snapshot, demote → republish (the publish transition snapshots a `ProblemVersion`).

---

## API keys

`/admin/api-keys` is where you generate bearer tokens for external automation.

### Generating a key

1. Type a key name (internal label — e.g. `CI seeder`, `bulk-import`).
2. Click **Generate**.
3. The plaintext appears in a yellow banner. **Copy it now** — it's not stored in plaintext anywhere; only the SHA-256 hash and the first 8 chars (`prefix`) are kept.
4. Click "Dismiss" once you've saved it.

Plaintext format: `dl_live_<32-byte base64url>`.

### Using a key

```bash
curl https://your-host/api/admin/problems \
  -H "Authorization: Bearer dl_live_..."
```

Every successful auth touches `lastUsedAt` (best-effort), which is shown on the list page.

### Revoking a key

Click the trash icon on a key row → confirm. The key is **soft-revoked** (sets `revokedAt`). Any client still using it gets `401 API key has been revoked.`

Revoked keys remain in the list for audit. If you need to fully remove, do it directly in the DB.

---

## Tips for content quality

- **Keep `description` short and unambiguous.** Users read it in a narrow left pane. Lead with what to return; put column-name requirements last.
- **Always specify column names** in the description ("Return columns `customer_id`, `name`, `email`, `country`"). Validation compares column sets — a mismatch shows the user "your columns: […] · expected: […]".
- **Use realistic data, not toy data.** 5–10 rows per table with mixed values is plenty. Avoid sequential IDs that accidentally match the answer.
- **Test the solution captures cleanly.** If "Run & capture" shows `0 rows`, your seed data probably doesn't satisfy the predicate.
- **Set `ordered=true` only when you mean it.** It forces the user's row order to match exactly. For most aggregation problems, leave it off.
- **Prefer existing schemas** when problems share data. Authoring 10 problems against one e-commerce schema is faster than authoring 10 schemas.
- **Tags are for filtering on `/practice`.** Use slugs that read naturally: `joins`, `aggregation`, `window-functions`, `filtering`, `cte`, `subqueries`.

---

## Common mistakes

| Symptom | Likely cause |
|---|---|
| `Wrong answer` even though the query looks right | Column-name mismatch (`id` vs `customer_id`); compare against the validation message's column lists |
| `0 rows captured` from a correct-looking solution | Seed data doesn't satisfy the predicate; fix the schema's `INSERT` rows |
| Numeric columns show garbage like `1450000` | Schema uses `DECIMAL`; switch to `DOUBLE` |
| `expectedOutput must be a JSON array` on save | The expected output field isn't a JSON-array. Re-capture or paste a valid array |
| Save button is disabled with "Solution or schema changed" | You edited solution SQL after capturing. Click Run & capture again, or tick **Override** to keep the existing JSON. |
| `schemaId does not match any SqlSchema` on save | The selected schema was deleted between load and save; pick another or refresh |
| New problem doesn't show up at `/practice` | Status is still `DRAFT`. Open the editor, change Status to `Published`, save. |
| User reported a problem but it's not in `/admin/reports` | Reports require a non-empty message; check the `ProblemReport` table directly if you suspect a bug. |

If you hit something not in this list, open an issue with the request payload and the response.
