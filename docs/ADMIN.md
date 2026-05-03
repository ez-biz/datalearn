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
Overview · Problems · Schemas · Tags · Discussions · Moderators · API keys
```

Everything you do here is plumbed through the REST API at `/api/admin/*`. See [`docs/API.md`](./API.md) for the full reference.

---

## Authoring a problem

Visit **`/admin/problems`** → click **New problem**.

The editor is one long form, broken into cards. Top to bottom:

### 1. Basics

- **Title** — what users see in the problem list. The **slug** auto-derives until you manually type into the slug field.
- **Slug** — URL identifier. Lowercase letters, digits, hyphens. Used in `/practice/<slug>` and `/admin/problems/<slug>/edit`.
- **Difficulty** — Easy / Medium / Hard. Drives the badge color and the by-difficulty stats on profile.
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
3. Inspect the JSON. Edit if needed. The validator compares user submissions against this JSON exactly (with float epsilon tolerance, and ordered/unordered modes).

If the schema engine isn't ready yet, the button waits. If your solution errors, the message shows next to the button. Either way, you can also paste raw JSON if you'd rather.

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

### 7. Discussion mode

Edit mode includes a **Discussion** card. It controls only the learner-facing discussion tab for that problem:

- **Open** — default. Learners can read and signed-in learners can comment, reply, vote, and report.
- **Locked** — existing discussion remains readable, but new discussion mutations are blocked.
- **Hidden** — removes the Discussion tab from the practice page.

Global discussion availability is controlled separately in `/admin/discussions/settings`. A globally disabled discussion system hides the tab everywhere, even if a problem mode is `OPEN`.

---

## Editing or deleting a problem

From `/admin/problems`:

- Click the row title (or the pencil icon) → edit page
- Click the trash icon → confirm dialog → DELETE. Cascades to all submissions for that problem. **Not undoable.**

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

## Discussion moderation

`/admin/discussions` is the moderation queue for problem discussions.

Queue buckets:

- **Needs review** — visible comments whose OPEN report count is at or above the configured threshold.
- **Hidden** — comments manually hidden from public discussion.
- **Dismissed reports** — comments whose reports were reviewed and dismissed.
- **Spam** — comments confirmed as spam.

Actions:

- **Hide** removes a visible comment from learner-facing discussion.
- **Restore** makes a hidden or spam comment visible again.
- **Dismiss reports** closes OPEN reports without hiding the comment.
- **Mark spam** confirms reports, moves the comment to spam, and records the moderation event.

Reports do not auto-hide comments. The threshold only controls when a comment enters the queue.

### Discussion settings

`/admin/discussions/settings` is admin-only. It edits the singleton `DiscussionSettings` row:

- global enable/disable
- report threshold
- edit window
- duplicate-comment cooldown
- body length cap
- per-tier hourly comment/reply/vote limits
- per-problem daily comment limits
- minimum seconds between comments
- reputation thresholds for trusted tiers

Discussions are enabled by default for fresh installs. Use the global toggle to pause all learner-facing discussion actions, or set individual problem mode to `LOCKED`/`HIDDEN` when only one problem needs intervention.

### Moderators

`/admin/moderators` is admin-only. Admins can search existing `USER` accounts, promote one to `MODERATOR`, and assign a permission set. Moderator powers are not all-or-nothing:

- `VIEW_DISCUSSION_QUEUE`
- `HIDE_COMMENT`
- `RESTORE_COMMENT`
- `DISMISS_REPORT`
- `MARK_SPAM`
- `LOCK_PROBLEM_DISCUSSION`
- `HIDE_PROBLEM_DISCUSSION`

Moderators can enter only discussion moderation surfaces. They cannot access problem CRUD, schema/tag management, API keys, global settings, or moderator management unless they are promoted to `ADMIN`.

Every moderation action, settings change, problem mode change, and moderator permission grant/revoke writes a `DiscussionModerationLog` row.

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
| `schemaId does not match any SqlSchema` on save | The selected schema was deleted between load and save; pick another or refresh |

If you hit something not in this list, open an issue with the request payload and the response.
