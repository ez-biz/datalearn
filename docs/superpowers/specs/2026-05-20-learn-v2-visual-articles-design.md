# Learn v2 — Visual Articles (ByteByteGo-format)

> **Status:** design approved, pending plan + implementation. Closes long-deferred task #59.

## Goal

Let Data Learn articles carry diagrams, numbered walkthroughs, side-by-side comparisons, and inline illustrations alongside today's prose-and-code format. Reach a ByteByteGo-style visual density (diagram-first cards, short captions, numbered steps) on `/learn/[topicSlug]/[articleSlug]` without forking the content model.

The shipped scope is one PR delivering the renderer for five directives, two illustration sources (`:::mermaid` and `:::figure`), the contributor-scoped upload endpoint with an `Asset` table, the admin editor changes, publish-time validation invoked from every PUBLISHED transition path, and one fully-authored reference lesson ("How a JOIN works") to validate the surface end-to-end.

**`:::svg` (inline raw SVG) is explicitly deferred to v1.5** — see "Deferred for v1.5" below for the conditions under which it will land.

## Non-goals

- WYSIWYG / drag-and-drop block builder (rejected in favor of directive syntax).
- New content model — no `VisualLesson` table, no JSON-block storage. Articles remain markdown strings.
- MDX. Considered and rejected for component-allowlist + MCP-friendliness reasons (see "Approaches considered").
- AI image generation pipeline. Designer/author-supplied uploads only for `:::figure`.
- Mermaid live-edit preview in the admin editor (paste-and-publish for v1; preview lands later if it hurts).
- Article items inside Tracks gain no special visual styling — Tracks v1 still references articles by slug.
- Dark variants of uploaded raster assets — recommend SVG-on-transparent for uploads.
- Inline raw `:::svg` directive — deferred to v1.5 (see Deferred section).
- MCP article authoring tools (`create_article`, `update_article`) — deferred to MCP v2.

## Decisions

| Question | Decision |
|---|---|
| Approach | Markdown with `remark-directive` block directives. No content-model change. |
| Storage | `Article.content` stays `String` (markdown). Versioning via existing `ArticleVersion` works unchanged. |
| Directives in v1 | `:::figure`, `:::steps`, `:::side-by-side`, `:::callout`, `:::mermaid`. **Five block directives.** |
| Illustration sources | Two: `:::mermaid` (text → SVG, client-rendered) and `:::figure` (uploaded asset on Vercel Blob). |
| Image hosting | Vercel Blob via `@vercel/blob`. Upload endpoint at `/api/me/uploads` (contributor-accessible), with admin-side asset admin under `/api/admin/assets`. |
| Asset ownership | New `Asset` table records owner, blob key/URL, content type, bytes, status. Every upload is owned by a user; admins can manage anyone's, contributors can only manage their own. |
| Abuse controls | Per-user upload rate limit (10/min, 50/day) and per-user quota cap (100 MB total ACTIVE assets). Deleted assets garbage-collected by a daily Vercel cron after a 7-day soft-delete tombstone window. |
| Mermaid loading | Lazy-loaded client-side via dynamic import (Mermaid is ~2 MB). Falls back to a code-block render if the chunk fails to load. |
| Dark mode | Mermaid uses `themeVariables` keyed off the current `next-themes` value. Uploaded `:::figure` assets — author's responsibility; recommend transparent SVG. |
| Versioning | No schema change to `Article` / `ArticleVersion`. `ArticleVersion.content` captures the full markdown source including directives. |
| Listing UX | Add `Article.hasVisualBlocks Boolean @default(false)`. Set on every PUBLISHED transition by scanning directive presence. `/learn` and `/learn/[topicSlug]` show a small "Visual" pill on cards where true. No new route. |
| Listing query | Existing `getTopics()` / `getArticlesByTopic()` projections add `hasVisualBlocks`. |
| MCP impact | None in v1. Repo has no `create_article` / `update_article` MCP tools today (per `docs/ROADMAP.md`, these are still "MCP v2: article authoring tools — Todo"). Visual articles are admin-UI-authored in v1. Directive syntax is documented in `mcp-server/README.md` as future preparation. |
| Required `alt` | Enforced by a single publish-validation helper invoked from every PUBLISHED transition path. Articles with a `:::figure` missing `alt` cannot be PUBLISHED. |
| Seed | One reference lesson, hand-authored with all five directives (mermaid for the execution-flow diagram, figure for the table-with-arrows hero and the hash-vs-nested-loop diagram). Lesson lives in `prisma/seed-visual-lesson.ts`, guarded by `--include-visual-seed`. |

## Approaches considered

Three approaches were prototyped in the brainstorm preview at `/tmp/datalearn-learn-v2-preview/index.html`:

1. **A — markdown directives (chosen).** Smallest surface change; existing `react-markdown` pipeline and `ArticleVersion` unchanged; storage stays a markdown string so future MCP article tools can author directives just like prose.
2. **B — MDX (`next-mdx-remote`).** Rejected. Same authoring ergonomics as A in practice but with a much larger codebase swap, a required component allowlist for safety, and a harder failure mode (MDX compile errors break the render).
3. **C — block JSON model.** Rejected for v1. Best ergonomics for surgical block-level MCP tools (matching the Tracks item-management pattern), but requires a new model, a new admin builder UI, a new MCP tool family, and dual content surfaces forever. Revisit only if edit-pain on full-content updates becomes a real cost once MCP article tools land.

## Directives

All directives use `remark-directive` triple-colon block syntax. Attributes use `{key="value"}` syntax. Each directive maps to a React component in `components/markdown/directives/`.

### `:::figure`

Uploaded raster or vector asset.

```markdown
:::figure{src="https://blob.vercel-storage.com/learn/join-hero-a8f3.svg"
          alt="Hash join vs nested loop side-by-side"
          caption="Hash join: O(n+m) but needs memory. Nested loop: O(n×m) but works without one."}
The optimizer picks based on row counts.
:::
```

- `src` required. Must match `^https://[a-z0-9.-]+\.vercel-storage\.com/` (allowlist) or `^/learn/` (committed-to-repo public assets).
- `alt` required. Validated at publish.
- `caption` optional. If omitted, the directive body becomes the caption.

Renders as a `<figure>` with the image and a `<figcaption>`.

### `:::mermaid`

Text-source diagram rendered client-side.

```markdown
:::mermaid{caption="JOIN evaluation flow"
           alt="Flowchart: scan, probe, emit"}
flowchart LR
  A[Scan orders] --> B{For each row}
  B --> C{Probe customers.id}
  C -->|match| D[Emit joined row]
  C -->|no match| E[Drop / keep NULL]
:::
```

- `alt` required. Mermaid does not generate accessible alt text on its own.
- `caption` optional.
- Body is the Mermaid source.
- Renders `<figure>` with a `<MermaidClient>` child (lazy-loaded). On client mount, calls `mermaid.render()` and replaces the placeholder with the resulting SVG. On render failure, falls back to a `<pre><code class="language-mermaid">` block.
- Mermaid theme switches between `default` and `dark` based on `useTheme()`.

### `:::steps`

Numbered walkthrough.

```markdown
:::steps
1. **Pick the driver table** — the optimizer scans `orders` first.
   ![](/learn/img/step1.svg)
2. **Probe the join column** — for each driver row, look up the matching `customers.id`.
   :::mermaid
   ...
   :::
3. **Emit the joined row** — concatenate columns from both sides.
:::
```

- Each list item becomes a numbered card.
- Bolded first phrase becomes the step title; the rest is the body.
- A single image (`![](url)`) or nested directive inside a step becomes the step's visual.
- Nested `:::mermaid` is allowed inside steps. Nested `:::steps` is not.

### `:::side-by-side`

Two-column comparison.

```markdown
:::side-by-side
### INNER JOIN — drops the lonely
```sql
SELECT c.name, o.total FROM customers c
INNER JOIN orders o ON o.customer_id = c.id;
```
---
### LEFT JOIN — keeps everyone
```sql
SELECT c.name, o.total FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id;
```
:::
```

- Body is split into two halves on the first `---` thematic break.
- Each half renders as a card. The first heading per half (`###`) is the card title.
- Optional `{kind="good-bad"}` attribute renders ✓/✗ icons on the titles. Default omits icons.

### `:::callout`

Inline note styled by tone.

```markdown
:::callout{kind="pitfall"}
Putting a filter on the right table of a LEFT JOIN in the `WHERE`
clause silently turns it back into an INNER JOIN.
:::
```

- `kind` ∈ `tip | pitfall | note | warning`. Defaults to `note`.
- Body is regular markdown; supports inline code and links.

## Renderer architecture

```
components/markdown/
  MarkdownRenderer.tsx        // unchanged signature, adds plugins + component map
  directives/
    Figure.tsx                // <figure> + <img> + <figcaption>
    Mermaid.tsx               // dynamic import of MermaidClient
    MermaidClient.tsx         // client-only, "use client"
    Steps.tsx
    SideBySide.tsx
    Callout.tsx
  remarkBlockDirectives.ts    // remark plugin: walks tree, rewrites containerDirective nodes
                              // into hast elements with the right tag name
```

`remarkBlockDirectives` is the only new remark plugin. It walks `containerDirective` and `leafDirective` nodes produced by `remark-directive` and rewrites their `data.hName` and `data.hProperties` so `react-markdown`'s `components` prop can dispatch to our React components.

`MermaidClient.tsx` is the only client component in the directive set. It dynamically imports `mermaid`, calls `mermaid.initialize({ startOnLoad: false, theme, securityLevel: 'strict', htmlLabels: false, flowchart: { htmlLabels: false } })` once per theme change, and calls `mermaid.render(id, source)` to produce the SVG. Errors render the source as a `<pre><code>` block with a small "Mermaid render failed" label.

**Mermaid output is sanitized before insertion.** Although Mermaid generates its own SVG (the input is text, not markup), the *source* is contributor-authored and historically Mermaid has had escaping CVEs (e.g. CVE-2024-31115). Defense-in-depth:

1. **Mermaid config:** `securityLevel: 'strict'` (escapes HTML in labels), `htmlLabels: false` everywhere (forces plain-text labels — disables Mermaid's HTML-in-label feature, the primary historical XSS surface), and no `flowchart.useMaxWidth` quirks.
2. **DOMPurify on the rendered SVG.** Before `MermaidClient` inserts the SVG into the DOM, the output runs through `DOMPurify.sanitize(svgString, { USE_PROFILES: { svg: true, svgFilters: false }, FORBID_TAGS: ['script', 'foreignObject'], FORBID_ATTR: [/^on/i, 'href', 'xlink:href', 'style'] })`. The forbidden-attr list is wider than Mermaid's own escapes — even if Mermaid emits an `<a href>` for a click action, we strip it. Click-actions are not a v1 feature.
3. **CSP coverage** (see "Content-Security-Policy" section below).

`Figure.tsx` renders a Next.js `<Image>` for `image/png`, `image/jpeg`, `image/webp`, `image/gif` URLs, and a plain `<img>` for `image/svg+xml`. The `next.config.ts` `images.remotePatterns` block is extended to include the `*.vercel-storage.com` hostname so Next/Image can optimize Blob-hosted raster assets.

### Content-Security-Policy (new in v1)

The repo today ships **no CSP**. This design adds one — scoped narrowly to the learner article surface so the rest of the app is not perturbed in this PR.

`middleware.ts` injects a `Content-Security-Policy` header for `/learn/**` responses only:

```
default-src 'self';
script-src 'self' 'nonce-<per-request-nonce>';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https://*.vercel-storage.com;
connect-src 'self';
font-src 'self' data:;
frame-ancestors 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
```

Notes on each directive:

- `script-src 'self' + nonce`: blocks inline `<script>`, blocks any externally-hosted script. The nonce is generated per-request and stamped on the App Router's bootstrap scripts (Next 16 supports nonces via `headers()`).
- `style-src 'self' 'unsafe-inline'`: Tailwind v4 generates inline `style` via CSS variables — `'unsafe-inline'` is required for Tailwind. Acceptable trade-off given XSS primary vector is script.
- `img-src 'self' data: *.vercel-storage.com`: covers Next/Image, data URIs, Blob assets. Mermaid SVG is inlined (not loaded via `img-src`).
- `frame-ancestors 'none'`: clickjacking defense.
- No `'unsafe-eval'`: confirmed compatible with Mermaid (Mermaid 11+ does not eval).

Mermaid-specific concerns the CSP addresses: even if Mermaid emits an `<a href="javascript:...">`, the inline-script nonce check blocks execution; even if Mermaid emits an `<img src="https://evil.com/track">`, the `img-src` allowlist blocks the request.

CSP coverage is verified by a test that:
- Loads `/learn/joins/how-a-join-works`.
- Asserts the `Content-Security-Policy` response header exists and contains each required directive.
- Loads a deliberately crafted seed article with a Mermaid source attempting common XSS patterns (`<svg><script>alert(1)</script></svg>` as a label, `javascript:` URLs, `<img onerror>`), and asserts the rendered DOM contains none of them.

`Figure.tsx` renders a Next.js `<Image>` for `image/png`, `image/jpeg`, `image/webp`, `image/gif` URLs, and a plain `<img>` for `image/svg+xml`. The `next.config.ts` `images.remotePatterns` block is extended to include the `*.vercel-storage.com` hostname so Next/Image can optimize Blob-hosted raster assets.

## Asset upload + management

The existing `/api/admin/*` middleware enforces `ADMIN`-only and cannot host a contributor-accessible upload endpoint without loosening that boundary. Instead, this design introduces a contributor-owned route under `/api/me/uploads` and a small `Asset` table to track ownership, lifecycle, and quotas.

### Asset model

```prisma
model Asset {
  id                String      @id @default(cuid())
  ownerId           String
  owner             User        @relation(fields: [ownerId], references: [id])
  blobUrl           String?     @unique          // null while PENDING (key allocated, blob not yet written)
  blobKey           String      @unique          // path component used by @vercel/blob, e.g. learn/{ownerId}/{cuid}.svg
  contentType       String
  bytes             Int                          // declared size; reserved against quota during PENDING
  status            AssetStatus @default(PENDING)
  pendingExpiresAt  DateTime?                    // null after status transitions away from PENDING
  deletedAt         DateTime?
  deletionAttempts  Int         @default(0)      // admin abuse-delete retry counter (see Stage 2 sequence)
  lastDeletionError String?                      // last error message surfaced to admin
  createdAt         DateTime    @default(now())

  @@index([ownerId, status])
  @@index([status, deletedAt])
  @@index([status, pendingExpiresAt])
}

enum AssetStatus {
  PENDING       // row exists, blob not yet written, quota reserved
  ACTIVE        // row exists, blob exists, quota reserved
  DELETING      // admin abuse-delete in progress, references stripped, blob removal pending
  DELETED       // soft-deleted by owner (7-day tombstone) OR fully removed (will be hard-deleted by GC)
}
```

`Asset` is decoupled from `Article` in v1 — assets are referenced by URL string in directive `src` attributes, not by foreign key. This avoids cascade churn on article delete; reference-aware owner delete + admin abuse-delete unlink flow + GC reconciliation collectively keep state consistent.

### Endpoints

### Upload lifecycle (two-phase, durable)

Blob storage is **outside** Prisma transactions, so a naive "put then write row" sequence can leak storage if the DB write fails between calls. The design uses a two-phase commit: the `Asset` row is created `PENDING` (reserving quota) **before** the blob write, and promoted to `ACTIVE` **after** the blob write confirms. Any failure between phases is reconciled by a janitor.

`app/api/me/uploads/route.ts`:

- `POST /api/me/uploads`, multipart/form-data, `file` field.
- Auth: any authenticated user with role `ADMIN` or `CONTRIBUTOR`. Standard learner users denied.
- Content-type allowlist: `image/svg+xml`, `image/png`, `image/jpeg`, `image/webp`, `image/gif`.
- Per-request size cap: 4 MB. The route reads `Content-Length` first and rejects oversize before reading the body.
- Per-user rate limits: **10 uploads / minute, 50 uploads / day**, enforced in-memory in v1 (acceptable on a single Vercel region; upgrade to Upstash if multi-region).

### Concurrency-safe quota reservation

A naive `SELECT SUM(bytes); check; INSERT` is racy under read-committed isolation — two concurrent uploads can each read `90 MB` and both insert, exceeding the cap. The design uses an **atomic conditional UPDATE** against the `UserAssetQuota` counter, which is the only safe primitive that doesn't require serializable isolation or app-level locks.

The reservation step is a single SQL statement that increments the counter only if the resulting value is within the cap. In Prisma:

```ts
const QUOTA_BYTES = 100 * 1024 * 1024 // 100 MB

const reserved = await prisma.$executeRaw`
  UPDATE "UserAssetQuota"
  SET "reservedBytes" = "reservedBytes" + ${bytes}::bigint,
      "updatedAt" = now()
  WHERE "userId" = ${ownerId}
    AND "reservedBytes" + ${bytes}::bigint <= ${QUOTA_BYTES}::bigint
`
```

If the UPDATE affects 0 rows, the quota would be exceeded — reject with HTTP 413 and do not insert an Asset row. If it affects 1 row, the reservation is held and we proceed to Phase 1b.

This works because Postgres acquires a row lock for the duration of the UPDATE statement. Concurrent UPDATEs serialize: the second waits for the first to commit, then re-evaluates its `WHERE` predicate against the post-commit value, and correctly rejects if the cap is now exceeded. No advisory locks, no serializable retries, no application-level mutexes.

If the `UserAssetQuota` row doesn't exist yet (first upload for this user), the route does an `INSERT ... ON CONFLICT DO NOTHING` to ensure the row exists, then runs the atomic UPDATE. This is two statements but the second is the critical one.

**Concurrency test (`scripts/test-upload-quota-race.ts`):** spawn 10 parallel uploads for the same user, each 15 MB. The total would be 150 MB, but the cap is 100 MB. Assert exactly 6 succeed (90 MB committed) and the rest receive HTTP 413. Reservation must release on subsequent soft-delete, validated by a follow-up successful upload.

### Upload handler sequence

The quota reservation and the PENDING `Asset` insert happen **in a single transaction** so a failure between them cannot leak the reservation. The blob write is the only step outside a transaction, and its failure modes are handled by both an inline cleanup path and the janitor's reconciliation sweeps.

1. **Reserve quota + insert PENDING Asset (Phase 1, single transaction).** All three statements run inside one `prisma.$transaction`:
   - `INSERT INTO "UserAssetQuota" ... ON CONFLICT DO NOTHING` (ensure the row exists).
   - Atomic conditional UPDATE against `UserAssetQuota` (the snippet shown above under "Concurrency-safe quota reservation"). If 0 rows affected → abort the transaction and return HTTP 413.
   - Insert `Asset { status: 'PENDING', blobUrl: null, blobKey, bytes, pendingExpiresAt: now() + 5 min }`. `blobKey = "learn/<ownerId>/<cuid>.<ext>"`.
   - Commit. The reservation and the Asset row land atomically. If the Asset insert fails for any reason (unique constraint violation, DB hiccup, transient error), the entire transaction rolls back and the quota counter is unchanged.
2. **Write blob (Phase 2, outside transaction).**
   - Call `@vercel/blob` `put(blobKey, file, { access: 'public', addRandomSuffix: false })`. The key is deterministic so retries are idempotent.
   - On success, get back the public URL.
3. **Promote PENDING → ACTIVE (Phase 3).**
   - In a new transaction, `UPDATE asset SET status='ACTIVE', blobUrl=?, pendingExpiresAt=NULL WHERE id=? AND status='PENDING'`.
   - If the update affects 0 rows (row was cleaned up by janitor while blob write was running), call `del(blobKey)` to remove the orphan blob and respond with HTTP 409. Quota counter is already correct (the janitor that took the row also released the reservation).
4. **Failure paths.**
   - **Phase 2 throws (blob write failure):** in `finally`/`catch`, run one transaction that sets the Asset to `DELETED` and **releases the quota reservation** (`UPDATE UserAssetQuota SET reservedBytes = reservedBytes - <bytes>` in the same transaction). Return HTTP 502.
   - **Phase 3 throws (DB unreachable after blob write):** the blob exists, the row is still PENDING, the quota counter still holds the reservation. The next janitor pass (sweep 2) handles it — either promotes the orphan blob if it can re-read the row, or removes the row + key + releases the quota.
   - **Phase 1 fails midway (e.g. constraint violation on Asset insert):** transaction rolls back entirely. No row inserted, no reservation held. Return HTTP 500.
5. **Response.** `{ id, url, contentType, bytes, createdAt }`.

**Regression test for the Phase 1 atomicity (`scripts/test-upload-phase1-atomicity.ts`):** mock `prisma.asset.create` to throw inside the transaction *after* the `UserAssetQuota` UPDATE succeeds. Assert `UserAssetQuota.reservedBytes` reads its pre-call value after the request returns 500. This proves the single-transaction guarantee.

Every state change to `Asset.status` is paired with an offsetting `UserAssetQuota.reservedBytes` adjustment in the same transaction:

| Transition | Quota delta |
|---|---|
| (insert PENDING) | `+bytes` |
| PENDING → ACTIVE | `0` (already counted) |
| PENDING → DELETED (failure cleanup) | `-bytes` |
| ACTIVE → DELETED (owner soft-delete; only allowed if asset unreferenced) | `0` (still counted until GC sweep 1a hard-deletes) |
| ACTIVE → DELETING (admin abuse-delete stage 1; references stripped) | `0` (still reserved — blob is still public) |
| DELETING → DELETED (blob `del()` confirms, inline or GC sweep 1b) | `-bytes` |
| DELETED → (GC hard-delete via sweep 1a) | `-bytes` |
| PENDING → (GC hard-delete via sweep 2) | `-bytes` |

The "owner soft-delete keeps counting against quota for 7 days" rule is **intentional**: it prevents a user from spam-uploading-and-deleting to defeat the rate limits. Documented in the user-facing error message when an owner hits quota.

`app/api/me/uploads/route.ts` `GET`:

- Returns the authenticated user's `Asset` rows where `status = 'ACTIVE'`, paginated. Powers the "My uploads" tab in `ArticleEditor`.

`app/api/me/uploads/[id]/route.ts` `DELETE`:

- Owner-only soft-delete. **Reference-aware:** before marking the row, the route runs a `SELECT slug, status FROM article WHERE content LIKE '%' || $blobUrl || '%'` (the URL is a unique CUID-bearing path, so false positives are negligible).
  - If any row comes back, return HTTP 409 with `{ error: "asset-in-use", articles: [{ slug, status }, ...] }`. The author must remove the `:::figure` from each referencing article (or unpublish it) before deletion can proceed. This prevents a routine asset-cleanup action from silently breaking a live article 7 days later.
  - If no rows, run `UPDATE asset SET status='DELETED', deletedAt=now() WHERE id=? AND ownerId=?`. Blob is not removed until GC runs. URL remains "live" during the 7-day tombstone, but no article references it.
- The "My uploads" tab in `ArticleEditor` surfaces a reference badge per asset ("In use in 2 articles: …") fed by the same query, so authors see the linkage before they hit Delete.

`app/api/admin/assets/route.ts` and `app/api/admin/assets/[id]/route.ts`:

- `GET /api/admin/assets` — list all assets across users with pagination, filter by owner/status. Admin-only.
- `DELETE /api/admin/assets/:id` — **admin abuse-delete is a hard delete** (see "Admin abuse-delete" below), distinct from the owner-side soft-delete.

### Garbage collection + reconciliation

`app/api/cron/asset-gc/route.ts`, scheduled in `vercel.json` to run daily at 04:00 UTC. Three sweeps per run:

**Sweep 1a — expired tombstones (owner soft-deletes).**

1. Find `Asset` rows where `status='DELETED' AND deletedAt < now() - interval '7 days'`.
2. For each, call `@vercel/blob` `del(blobUrl)`.
3. Hard-delete the `Asset` row after the blob delete confirms; release quota in the same transaction.

**Sweep 1b — DELETING retries (admin abuse-delete blob removal that didn't confirm inline).**

1. Find `Asset` rows where `status='DELETING'`. No age threshold — abusive content should not wait days.
2. For each, attempt `@vercel/blob` `del(blobUrl)`.
3. On success, transition to `DELETED`, release quota, log `gcDeletingResolved`.
4. On failure, bump `deletionAttempts`, log `lastDeletionError`, move on.
5. After 24 cumulative attempts on a single asset, the GC job emits a `gcDeletingStuck` alert log line so an admin can investigate manually.

**Sweep 2 — expired PENDING reservations (interrupted uploads).**

1. Find `Asset` rows where `status='PENDING' AND pendingExpiresAt < now()`. The 5-minute reservation window has elapsed.
2. For each, attempt `@vercel/blob` `head(blobKey)`:
   - If the blob exists, the upload completed but the promotion step failed. Promote: `UPDATE asset SET status='ACTIVE', blobUrl=?, pendingExpiresAt=NULL WHERE id=?`.
   - If the blob does not exist, the upload never completed. Delete the row.

**Sweep 3 — orphan blobs (defense-in-depth reconciliation).**

1. List all blobs under the `learn/` prefix in batches.
2. For each blob URL, check `SELECT 1 FROM asset WHERE blobUrl = ? OR blobKey = ?`.
3. If no matching row, the blob is an orphan (data corruption or off-by-one bug). Log + delete after a 24-hour grace window (compare blob `uploadedAt` from `head()`).

Sweep 3 runs at most once a week (rate-limited via a stored `last_orphan_sweep_at` marker) — it is O(blob count) and primarily a safety net, not the primary cleanup path.

Cron is protected by the existing `CRON_SECRET` header pattern. Logs emit one structured record per sweep: `{ sweep: 'tombstone' | 'deleting' | 'pending' | 'orphan', deleted, failed, bytesReclaimed }`.

### Admin abuse-delete (hard, durable, unlinking)

`DELETE /api/admin/assets/:id` is **not** the same operation as the owner-side soft-delete. The DB state and the Blob state must remain consistent — recording "deleted" before the public blob is actually gone would let an abusive object stay live while moderation logs claim it was removed. The spec uses an explicit two-stage state machine with retry semantics for the blob removal.

A new `AssetStatus` value, `DELETING`, represents the window where the DB has unlinked references but the Blob deletion has not yet confirmed. Quota stays reserved until the blob is durably gone.

```prisma
enum AssetStatus { PENDING ACTIVE DELETING DELETED }

model Asset {
  // ... existing fields
  deletionAttempts Int       @default(0)        // bumped on each failed blob del()
  lastDeletionError String?                     // last error message for admin diagnostics
}
```

Sequence:

1. **Stage 1 (DB transaction).**
   - `UPDATE asset SET status='DELETING', deletedAt=now() WHERE id=? AND status='ACTIVE'`.
   - Find every `Article` whose `content` contains the asset's `blobUrl` (literal string LIKE search; the URL is a unique CUID-bearing path, so false positives are negligible). For each, **strip the `:::figure` block referencing that URL from `content`**: locate the smallest containing `:::figure ... :::` fence by parsing with `remark-directive`, remove that node, re-serialize. Persist the modified `content` and, if the article remains PUBLISHED, recompute `hasVisualBlocks` via Layer 2 validation.
   - Snapshot a new `ArticleVersion` for each modified PUBLISHED article so the abuse-removal is auditable.
   - Commit. The asset is now visibly unreferenced from articles, but the blob remains accessible.
2. **Stage 2 (blob removal, with bounded inline retry).**
   - Call `@vercel/blob` `del(blobUrl)` with **3 inline retries** at 200 ms / 1 s / 5 s.
   - On success: transaction `UPDATE asset SET status='DELETED', deletionAttempts=…, lastDeletionError=NULL WHERE id=?` and release quota (`UPDATE UserAssetQuota SET reservedBytes = reservedBytes - <bytes>`).
   - On all retries failing: `UPDATE asset SET deletionAttempts = deletionAttempts + 4, lastDeletionError=? WHERE id=?` (asset stays in `DELETING`, quota stays reserved). Return HTTP 502 to the admin: `{ error: "blob-deletion-pending", assetId, articlesUnlinked, willRetryInGc: true }` so the admin sees the blob is still live and can re-attempt or escalate.
3. **Stage 3 (GC backstop).**
   - GC sweep 1 is extended: find `Asset` rows where `status='DELETING'` (regardless of age) and retry `del()`. On success, transition to `DELETED` and release quota. On failure, bump `deletionAttempts`, log, and move on. After 24 attempts (≥ 24 days of daily retries), surface in an admin dashboard "stuck deletions" view.

Response envelope from the admin DELETE endpoint:

```ts
{
  assetId: string,
  blobDeleted: boolean,                       // true only after del() confirms
  status: 'DELETED' | 'DELETING',
  affectedArticles: { slug, hadDirectives, snapshotVersion?: number }[],
  retryAttempts?: number,                     // present when status='DELETING'
  lastError?: string,
}
```

The admin sees `blobDeleted: false` and `status: 'DELETING'` as a non-success signal — the unlinking succeeded but the blob is still public. They can re-invoke the endpoint or wait for GC backstop.

Tests for this path:
- Admin abuse-delete of an asset embedded in a PUBLISHED article: blob is gone immediately, article `content` no longer contains the URL, `ArticleVersion` snapshot exists, `hasVisualBlocks` is recomputed if the directive was the only visual.
- Admin abuse-delete of an asset embedded in a DRAFT: same content stripping happens but no `ArticleVersion` snapshot (snapshots only fire on PUBLISHED edits).
- Admin abuse-delete of an unreferenced asset: blob gone, no article touched.
- **Blob `del()` fails repeatedly:** asset transitions to `DELETING`, `deletionAttempts > 0`, response includes `blobDeleted: false`. Subsequent GC sweep with mocked successful `del()` finalizes the transition to `DELETED` and releases quota.
- **Quota stays reserved during `DELETING`:** uploading more content during this window is rejected by the standard quota check until the deletion finalizes. This is a feature, not a bug — prevents abuse-delete from being used as a quota reset.

### Env

- `BLOB_READ_WRITE_TOKEN` — Vercel auto-provisions when the Blob integration is installed.
- `CRON_SECRET` — already used by other cron routes; no new env.

Documented in `docs/DEPLOY.md`.

## Admin editor changes

`components/admin/ArticleEditor.tsx` (existing) gets a new "Insert" menu in the toolbar:

- **Upload image…** → file picker → POST to `/api/me/uploads` → inserts `:::figure{src="<returnedUrl>" alt=""}\n\n:::` snippet at the cursor. Focuses the cursor on the empty `alt=""`.
- **Mermaid diagram** → inserts a `:::mermaid{alt=""}\n flowchart LR\n  A --> B\n:::` skeleton.
- **Steps** → 3-step skeleton.
- **Side-by-side** → 2-column skeleton.
- **Callout** → kind picker → skeleton.

A "My uploads" tab in `/admin/articles/edit` lists the current user's `Asset` rows (thumbnail, content type, bytes, status, "Copy URL" / "Soft-delete" actions) so authors can re-use existing uploads without re-uploading. Fetches via `GET /api/me/uploads` (owner-scoped list — added alongside the POST).

No live preview in v1. Author runs the dev server to verify.

## Publish-time validation

The repo publishes articles through **three** REST entry points, not a single `publishArticle()` server action:

1. `POST /api/admin/articles` with `status: "PUBLISHED"` (admin create-and-publish).
2. `PATCH /api/admin/articles/[slug]` transitioning `status` to `"PUBLISHED"` (admin promote-from-DRAFT).
3. `POST /api/admin/articles/[slug]/approve` (admin approves a contributor-submitted SUBMITTED article).

Contributors can also `POST /api/me/articles/[slug]/submit` to advance from DRAFT to SUBMITTED, but no public render happens at that step. Validation runs at SUBMITTED too so authors get errors early, but only PUBLISHED rejection is hard.

### The validation helper

`lib/admin-validation.ts` (Prisma-free) exports:

```ts
export function validateArticleDirectivesForPublish(
  content: string,
): { ok: true; hasVisualBlocks: boolean }
  | { ok: false; errors: ArticleDirectiveError[] }
```

Implementation:

Validation has two layers split by **import boundary** — Layer 1 lives in `lib/admin-validation.ts` (Prisma-free; MCP-importable per the CLAUDE.md contract) and Layer 2 lives in `actions/article-publish-validation.ts` (server-only, Prisma-aware; never touched by MCP). The brainstorm preview's MCP findings (footgun #1 in CLAUDE.md) explicitly forbid Prisma in `lib/admin-validation.ts` — Layer 2 must be a separate module.

**Layer 1 — `validateArticleDirectivesSyntactic(content)` in `lib/admin-validation.ts` (Prisma-free, MCP-importable):**

1. Parse `content` with `remark-parse` + `remark-directive` (stand-alone, no React).
2. Walk the AST. Set `hasVisualBlocks = true` if any of the five new directive names appear.
3. For every `:::figure` node, assert `src` is present and matches a structural allowlist: either a `/learn/` path or a URL starting with `https://` and whose hostname ends with `.vercel-storage.com`. Assert `alt` is present and non-empty.
4. For every `:::mermaid` node, assert `alt` is present and non-empty (screen readers cannot extract semantics from a rendered Mermaid SVG).
5. For every `:::side-by-side` node, assert the body contains exactly one `---` thematic break.
6. For every `:::callout` node, assert `kind` is one of `tip | pitfall | note | warning` (default `note` is allowed).
7. Return `{ ok, hasVisualBlocks, figureUrls: string[] }` (the list of Blob URLs gathered for Layer 2).

Layer 1 has zero Prisma or Next/server imports. The MCP bundle continues to import `lib/admin-validation.ts` unchanged.

**Layer 2 — `validateArticleDirectivesForPublish(content, articleAuthorId)` in `actions/article-publish-validation.ts` (server-only, Prisma-aware):**

1. Call Layer 1. If syntactic check fails, return its errors.
2. For each `figureUrls` entry that points at `*.vercel-storage.com`:
   - Look up `Asset` by `blobUrl = ?`.
   - **Reject the publish** if no `Asset` row exists. This blocks foreign-Blob URLs (e.g. URLs from a different Vercel project or hand-crafted URLs that bypass the upload route). The structural allowlist in Layer 1 is necessary but not sufficient.
   - Reject if `Asset.status !== 'ACTIVE'` (PENDING uploads cannot be referenced; DELETED uploads cannot be re-used).
   - **Reject if `Asset.ownerId !== articleAuthorId`.** No cross-owner exception. This includes the admin-approval path: if an admin approves a contributor article whose `:::figure` references an asset the contributor doesn't own, the approval is rejected. The contributor must re-upload the asset themselves (or the admin must reject and ask the contributor to swap the figure).
3. `/learn/`-prefixed URLs skip the Asset lookup (they reference repo-committed files in `public/learn/`).
4. Return `{ ok: true, hasVisualBlocks }` or `{ ok: false, errors }`.

This binds every published `:::figure` to an audit trail and gives admin abuse-delete a real moderation surface. The strict ownership check (no admin-override semantics in v1) prevents a contributor from referencing a foreign user's public Blob URL and pulling unrelated content into their article. If admin curation of shared assets becomes a real need, a future "duplicate asset to current user" admin tool can be added — v1 keeps the contract simple.

### Wiring — validate the resulting state, not the transition

The trigger condition is **"the resulting article row would be PUBLISHED"**, not "status is changing to PUBLISHED". This closes the bypass where a PATCH edits `content` while `status` remains `PUBLISHED`. The helper is called and its result persisted (including the recomputed `hasVisualBlocks`) in the same transaction that writes the article row:

- `app/api/admin/articles/route.ts` — on create, when the incoming `status === 'PUBLISHED'`.
- `app/api/admin/articles/[slug]/route.ts` — on PATCH, whenever the **resulting** row's `status === 'PUBLISHED'`. This covers:
  - DRAFT → PUBLISHED transition (validation runs).
  - PUBLISHED → PUBLISHED with `content` or any other directive-bearing field edited (validation runs).
  - PUBLISHED → DRAFT/ARCHIVED transition (validation skipped — leaving public).
  - DRAFT → DRAFT edits (validation skipped — not public).
- `app/api/admin/articles/[slug]/approve/route.ts` — always (approval implies publish).
- `app/api/me/articles/[slug]/submit/route.ts` — runs validation in advisory mode (returns errors as a 400 so the contributor sees them early), does not change publish semantics.

Implementation pattern for the PATCH route:

```ts
import { validateArticleDirectivesForPublish }
  from "@/actions/article-publish-validation"

const merged = { ...existing, ...patch }
if (merged.status === "PUBLISHED") {
  const result = await validateArticleDirectivesForPublish(
    merged.content,
    merged.authorId,
  )
  if (!result.ok) return badRequest(result.errors)
  await prisma.article.update({
    where: { slug },
    data: { ...patch, hasVisualBlocks: result.hasVisualBlocks },
  })
}
```

Layer 1 (`validateArticleDirectivesSyntactic` in `lib/admin-validation.ts`) is Prisma-free and used by the contributor-submit advisory path and future MCP article tools for pre-validation. Layer 2 (`validateArticleDirectivesForPublish` in `actions/article-publish-validation.ts`) requires the DB and runs on every PUBLISHED transition. **Never import Layer 2 from anywhere that the MCP bundle reaches.**

### Route-level tests

For each of the four entry points, add a route test that asserts:

- A `PUBLISHED` payload with a `:::figure` missing `alt` is rejected with HTTP 400 and a clear error.
- A `PUBLISHED` payload with a `:::figure` whose `src` is a non-allowlisted URL is rejected at Layer 1.
- **A `PUBLISHED` payload with a `:::figure` whose `src` matches the structural allowlist (`*.vercel-storage.com`) but resolves to no `Asset` row is rejected at Layer 2.** Regression for the "foreign Blob URL bypass" finding.
- A `PUBLISHED` payload with a `:::figure` whose `src` resolves to an `Asset` owned by a different user is rejected, regardless of whether the publisher is `CONTRIBUTOR` or `ADMIN`. Admin-approval path included.
- A `PUBLISHED` payload with a `:::figure` whose `src` resolves to a `PENDING` or `DELETED` `Asset` is rejected.
- A `PUBLISHED` payload with all directives well-formed and Asset rows resolving correctly is accepted and persists `hasVisualBlocks=true`.
- **PATCH-specific:** editing `content` on an existing `PUBLISHED` article with a malformed directive is rejected (regression test for the "resulting state vs transition" bypass).
- **PATCH-specific:** editing an existing `PUBLISHED` article that previously had `hasVisualBlocks=true` to remove every directive succeeds and updates the flag to `false`.

These tests are the explicit defense against bypass via paths other than the canonical "transition to PUBLISHED".

## MCP impact

**None in v1.** The repo today has no `create_article` or `update_article` MCP tool (per `docs/ROADMAP.md` these are still "MCP v2: article authoring tools — Todo"). All visual-article authoring happens through the admin UI in v1.

`mcp-server/README.md` gains a "Visual articles (preview)" section documenting the five directives with copy-pasteable examples. It explicitly states the tools are not implemented yet; the section exists so when MCP v2 lands, the contract is already documented.

When MCP v2 article tools do land, they will:

- Reuse `validateArticleDirectivesForPublish()` to pre-validate `content` before POSTing.
- Be exercised by an extension to `scripts/mcp-e2e-test.mjs` that creates a visual article and asserts `hasVisualBlocks=true`. (Not in scope for this PR.)

The "stale bundle" footgun applies if and when MCP changes ship — anyone changing `mcp-server/src/**` rebuilds the bundle and verifies the startup log shows the latest SHA.

## Listing UX

`/learn` topic cards and `/learn/[topicSlug]` article rows render a small "Visual" pill when `article.hasVisualBlocks === true`:

```tsx
{article.hasVisualBlocks && (
  <Badge variant="outline" className="text-xs">Visual</Badge>
)}
```

No separate route. No filter UI in v1 — the pill is a discovery hint, not a navigation surface.

## Versioning

`ArticleVersion.content` already captures the full markdown source. No schema change to `Article` / `ArticleVersion`. The denormalized `hasVisualBlocks` field is on `Article` only; historical visual-state can be re-derived from `ArticleVersion.content` if ever needed.

## Seed lesson

One reference lesson committed to the seed and live on prod after release:

- **Title:** "How a JOIN works"
- **Slug:** `how-a-join-works`
- **Topic:** `joins` (created if missing)
- **Status:** `PUBLISHED`
- **Demonstrates:** all five directives. The two diagrams that were `:::svg` in the brainstorm preview (table-with-arrows hero, hash-vs-nested-loop) ship as `:::figure` pointing to SVGs committed to `public/learn/img/` so the seed has no Blob dependency.
- Implementation: `prisma/seed-visual-lesson.ts`, run by `npm run db:seed -- --include-visual`. Idempotent — re-runs upsert on slug.

This serves both as a smoke test for the renderer and as a reference for future authors / Claude prompts.

## Test plan

- **Unit (`scripts/test-directive-renderer.ts`)** — for each of the five directives, assert the markdown source produces the expected hast tree shape. Includes negative tests for missing `alt`, nested `:::steps`, malformed `:::side-by-side` without `---`, invalid `:::callout` `kind`.
- **Publish validation (`scripts/test-article-publish-validation.ts`)** — `validateArticleDirectivesForPublish()` rejects missing `alt`, rejects external `src`, rejects invalid `callout` kind, accepts well-formed content. Returns the correct `hasVisualBlocks` flag.
- **Route-level tests (`scripts/test-article-publish-routes.ts`)** — for each of the four publish entry points (admin create, admin PATCH, approve, contributor submit), assert validation is invoked and bad payloads are rejected with HTTP 400. **Includes the PATCH-on-already-PUBLISHED regression test.** Includes the PATCH-removing-all-directives → `hasVisualBlocks=false` test.
- **Upload endpoint (`scripts/test-uploads.ts`)** — happy-path upload, content-type rejection, oversize rejection, contributor role accepted, learner role rejected, rate-limit kick-in after 10 in a minute, quota rejection at 100 MB (PENDING counts), blob-write-failure rolls Asset to DELETED and releases quota, DB-write-after-blob-failure leaves orphan and is reconciled by GC sweep 2.
- **Quota concurrency (`scripts/test-upload-quota-race.ts`)** — 10 parallel uploads of 15 MB for the same user. Asserts exactly 6 succeed (within 100 MB cap), the rest receive HTTP 413, `UserAssetQuota.reservedBytes` reads `90 * 1024 * 1024` at the end.
- **Phase 1 atomicity (`scripts/test-upload-phase1-atomicity.ts`)** — mocks `prisma.asset.create` to throw inside the upload transaction. Asserts `UserAssetQuota.reservedBytes` is restored to its pre-call value, no Asset row is created, no blob write is attempted.
- **MCP bundle import check (`scripts/check-mcp-bundle-isolation.ts`)** — static import-graph scan: starting from `mcp-server/src/index.ts`, walks all reachable modules, asserts none of them import `@prisma/client`, `next/server`, or `actions/article-publish-validation`. CI-gated. Prevents accidental regression of the Prisma-free MCP boundary.
- **GC cron (`scripts/test-asset-gc.ts`)** — three sweeps tested independently: tombstones older than 7 days are deleted; expired PENDING with existing blob is promoted to ACTIVE; expired PENDING without blob is row-deleted; orphan blobs older than 24h are deleted.
- **Owner reference-aware soft-delete (`scripts/test-asset-delete-references.ts`)** — owner attempts to delete an asset embedded in a PUBLISHED article: returns HTTP 409 with the referencing slugs, asset stays `ACTIVE`, blob untouched. Owner removes the figure, retries, succeeds. Also tested for DRAFT references (both PUBLISHED and DRAFT block).
- **Admin abuse-delete happy path (`scripts/test-admin-asset-delete.ts`)** — abuse-delete of asset in PUBLISHED article: blob gone, article `content` stripped of the `:::figure`, `ArticleVersion` snapshot created, `hasVisualBlocks` recomputed, final status `DELETED`, quota released.
- **Admin abuse-delete with blob failure (`scripts/test-admin-asset-delete-retry.ts`)** — mock `del()` to throw on all 3 inline retries. Asset transitions to `DELETING`, `deletionAttempts=3`, response is HTTP 502 with `blobDeleted:false`, articles are already unlinked, quota still reserved. Run GC sweep 1b with mocked-successful `del()`: asset finalizes to `DELETED`, quota released. Asserts the durable-removal guarantee.
- **Mermaid sanitization (`scripts/test-mermaid-sanitization.ts`)** — feed Mermaid sources crafted to attempt XSS (script-in-label, `javascript:` link, `<img onerror>`, foreignObject, `xlink:href`), assert sanitized output contains none of them.
- **CSP enforcement (`tests/e2e/learn-csp.spec.ts`)** — load a learner article page, assert the CSP header matches the expected directive set, attempt inline script injection via a deliberately malformed seed article and assert the script does not execute.
- **E2E (`tests/e2e/learn-visual-article.spec.ts`)** — load `/learn/joins/how-a-join-works`, assert `<figure>` count, mermaid SVG appears within 3 s, side-by-side has two columns, callout has tone class. **Status code**: per the Next 16 streaming-200 footgun documented in the May 19 handoff, assertions check body text, not HTTP status.
- **Mermaid lazy-load smoke** — capture network requests on the article page, assert the `mermaid` chunk request fires only when a `:::mermaid` directive is present.

## Migration

Single Prisma migration `add-article-has-visual-blocks-and-asset`:

```prisma
model Article {
  // ... existing
  hasVisualBlocks Boolean @default(false)
  @@index([hasVisualBlocks])
}

model Asset {
  id                String      @id @default(cuid())
  ownerId           String
  owner             User        @relation(fields: [ownerId], references: [id])
  blobUrl           String?     @unique          // null while PENDING
  blobKey           String      @unique
  contentType       String
  bytes             Int
  status            AssetStatus @default(PENDING)
  pendingExpiresAt  DateTime?
  deletedAt         DateTime?
  deletionAttempts  Int         @default(0)      // admin abuse-delete blob removal retries
  lastDeletionError String?
  createdAt         DateTime    @default(now())

  @@index([ownerId, status])
  @@index([status, deletedAt])
  @@index([status, pendingExpiresAt])
}

enum AssetStatus { PENDING ACTIVE DELETING DELETED }

model UserAssetQuota {
  userId         String   @id
  user           User     @relation(fields: [userId], references: [id])
  reservedBytes  BigInt   @default(0)
  updatedAt      DateTime @updatedAt
}
```

`UserAssetQuota.reservedBytes` is the **per-user authoritative counter** for both PENDING and ACTIVE bytes. It is the source of truth used during upload reservation (see "Concurrency-safe quota" below). `SUM(bytes)` over the `Asset` table is the audit reference but is not used in the hot path. The row is created on first upload via a `prisma.userAssetQuota.upsert()`.

Backfill: post-migration script `scripts/backfill-has-visual-blocks.ts` walks every `PUBLISHED` article, parses, sets the flag. Idempotent. Run once after deploy then archived.

## Release plan

- **Branch:** `feat/learn-v2-visual-articles` (base: `main`).
- **Single PR.** Scope:
  1. Install `remark-directive`, `mermaid`, `isomorphic-dompurify`, `@vercel/blob`.
  2. Migration (`Article.hasVisualBlocks` + `Asset` table with `PENDING/ACTIVE/DELETED` + `pendingExpiresAt` + `UserAssetQuota`) and `scripts/backfill-has-visual-blocks.ts`.
  3. `remarkBlockDirectives.ts` plugin.
  4. Five directive components (`Figure`, `Mermaid`, `MermaidClient`, `Steps`, `SideBySide`, `Callout`). Mermaid output sanitized via DOMPurify before insertion.
  5. `MarkdownRenderer.tsx` wiring.
  6. CSP middleware injection on `/learn/**` with per-request script nonce.
  7. `/api/me/uploads` (POST two-phase + GET list) and `/api/me/uploads/[id]` (DELETE soft).
  8. `/api/admin/assets` (GET) and `/api/admin/assets/[id]` (DELETE hard + article unlink).
  9. `/api/cron/asset-gc` with three sweeps (tombstone, expired-PENDING, orphan-blob) + `vercel.json` schedule entry.
  10. `ArticleEditor.tsx` insert menu + "My uploads" tab.
  11. `validateArticleDirectivesSyntactic()` (Layer 1) in `lib/admin-validation.ts` — stays Prisma-free, MCP-importable. `validateArticleDirectivesForPublish()` (Layer 2) in **`actions/article-publish-validation.ts`** — server-only, Prisma-aware, never imported by MCP. Wired into all four publish entry points, triggered by **resulting** PUBLISHED state. Layer 2 binds every `*.vercel-storage.com` figure URL to an ACTIVE Asset row **owned by the article author** (no cross-owner override in v1).
  12. Listing UX — "Visual" pill on `/learn` and `/learn/[topicSlug]`.
  13. Seed lesson `prisma/seed-visual-lesson.ts` + reference SVGs in `public/learn/img/`.
  14. Test files listed in Test plan.
  15. `docs/ROADMAP.md` update.
  16. `docs/DEPLOY.md` — `BLOB_READ_WRITE_TOKEN` env, `CRON_SECRET`, asset-gc cron entry, CSP rollout note.
  17. `mcp-server/README.md` — "Visual articles (preview)" section, explicitly noting MCP article tools are deferred.
- **Release version:** v0.5.0 (or v0.4.13 if the v0.5.0 cleanup PR hasn't shipped yet — sequencing decided at release-PR time).
- No feature flag. Renderer is additive; legacy articles render identically.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Validation bypassed by a publish path the design forgot | `validateArticleDirectivesForPublish()` triggered by **resulting** PUBLISHED state, not transitions. Wired into all four entry points. PATCH-on-already-PUBLISHED tested explicitly. |
| Mermaid contributor source produces stored XSS via labels / click-handlers | `securityLevel: 'strict'`, `htmlLabels: false`, DOMPurify on the rendered SVG before insertion (forbids `<script>`, `foreignObject`, event handlers, `href`, `xlink:href`, `style`). CSP on `/learn/**` adds defense-in-depth. Regression fixtures exercise common XSS payloads. |
| Mermaid client bundle size (~2 MB) | Lazy-loaded via dynamic import. Articles without `:::mermaid` never load the chunk. |
| Mermaid render failure on malformed source | Try/catch around `mermaid.render()`. Fall back to `<pre><code class="language-mermaid">` so the source is still readable. |
| Blob upload + DB write not atomic — orphan storage | Two-phase PENDING → ACTIVE. Quota reserved in DB before blob write. GC sweep 2 reconciles expired PENDING. GC sweep 3 scans `learn/` prefix for orphans, deletes after 24h grace. |
| Compromised contributor uploads many large files | Per-user 100 MB total quota (PENDING + ACTIVE both count), 10/min and 50/day rate limits, owner-scoped delete, admin abuse-delete (hard), daily GC. |
| Owner soft-deletes a referenced asset → article breaks after 7 days | Owner soft-delete is **reference-aware**: route returns HTTP 409 with the list of referencing articles. Author removes the figure first (or unpublishes), then re-attempts. Tested explicitly. |
| Admin abuse-delete records "deleted" while abusive blob is still public | Two-stage state machine: `ACTIVE → DELETING → DELETED`. Transition to `DELETED` only after blob `del()` confirms. Inline retries (3 attempts) + GC backstop (sweep 1b) retries indefinitely. Admin response surfaces `blobDeleted: false` and `status: 'DELETING'` when the public blob is still live. Quota stays reserved during `DELETING` so abuse-delete can't be used as a quota reset. Tested explicitly. |
| `:::figure src` pointing to an arbitrary external URL (CSRF / tracking) | Layer 1 structural allowlist (only `*.vercel-storage.com` and `/learn/`). Layer 2 semantic check requires `*.vercel-storage.com` URLs to resolve to an ACTIVE `Asset` row owned by the article author (or admin override). CSP `img-src` allowlist enforces the host at the browser level too. |
| Contributor references a foreign Vercel Blob URL (uploaded outside this app) to bypass moderation | Layer 2 publish validation rejects any `*.vercel-storage.com` URL that has no `Asset` row in this app. Admin abuse-delete therefore has a moderation surface for every published Blob figure. Tested explicitly. |
| Contributor references another user's ACTIVE asset to piggyback on someone else's content | Layer 2 requires `Asset.ownerId === article.authorId`, with no admin-override in v1. Admin approval of a contributor article with a foreign-owned figure is rejected. Tested explicitly. |
| MCP bundle pulls Prisma in via `lib/admin-validation.ts` and breaks at runtime | Layer 1 (Prisma-free) stays in `lib/admin-validation.ts`. Layer 2 (Prisma-aware) lives in `actions/article-publish-validation.ts`, never imported by MCP. CI assertion: `import-check` step ensures nothing under `mcp-server/src/**` reaches a file that imports `@prisma/client`. |
| Race condition: concurrent uploads bypass the 100 MB quota | Atomic conditional UPDATE against `UserAssetQuota.reservedBytes` with `WHERE reservedBytes + ? <= 100MB`, inside the same transaction as the PENDING Asset insert. Postgres row-locks serialize concurrent UPDATEs. Concurrent-upload test (`test-upload-quota-race`) asserts the cap holds under 10 parallel uploads. |
| Quota leak when Asset insert fails after reservation | Quota UPDATE and Asset INSERT are in **one transaction**; either both commit or both roll back. Regression test (`test-upload-phase1-atomicity`) forces the Asset insert to throw mid-transaction and asserts `reservedBytes` reads its pre-call value. |
| Vercel Blob URL leakage / hot-link | URLs are public by design. We are not hosting sensitive imagery. Blob key includes `learn/<ownerId>/` so ownership is recoverable from the URL. |
| Backfill of `hasVisualBlocks` on prod | Idempotent script; runs once; old articles default to `false`. Worst case: a true-positive article shows without a pill until backfill runs. |
| Nested directive parsing edge cases | Test fixtures cover `:::steps` containing `:::mermaid` (allowed), `:::steps` containing `:::steps` (rejected), `:::side-by-side` containing `:::callout` (allowed). |
| Mermaid + `next-themes` flash | Mermaid re-renders on theme change. Brief flash acceptable; track perceived UX in seed lesson before scoping a fix. |
| CSP breakage of other surfaces | CSP injected only for `/learn/**` paths in v1, not site-wide. Rollout to other routes is a separate follow-up after this PR proves the directive list. |

## Deferred for v1.5

Tracked as explicit deferrals so the design surface is finite and Codex-style "you promised X but it's missing" never recurs:

### `:::svg` inline raw SVG (high priority)

Rationale for deferral: the security perimeter on inline `dangerouslySetInnerHTML` SVG needs a more rigorous spec than this PR's scope allows — see the v1.5 prerequisites below. Until then, authors compose custom diagrams as SVG files uploaded via `:::figure`. Model-authored SVG is still possible: the model produces SVG, the human uploads the file. Acceptable but adds a step.

**v1 already ships some prerequisites that v1.5 will build on** — namely the DOMPurify-on-Mermaid-output pipeline and the `/learn/**` CSP middleware. The remaining v1.5 work is specific to user-authored raw SVG:

- Extend the existing DOMPurify pipeline with an explicit allowlist for the `:::svg` directive body, defined by enumerated tags (`svg, g, path, rect, circle, ellipse, line, polyline, polygon, text, tspan, defs, marker, linearGradient, stop, use, title`), enumerated attributes, and a URL-protocol allowlist (`http`, `https`, `data:image/*` only — no `javascript:`).
- Block all external-reference surfaces: `href`, `xlink:href`, `style` attribute, `url(...)` in inline styles, `<image>` elements with `href`.
- Tighten the existing CSP (drop `'unsafe-inline'` for `style-src` if feasible, or scope inline-style exemption to a nonce).
- Test fixtures covering each XSS vector: `<script>`, event handlers, `javascript:` URLs, `data:text/html` URLs, `style="background:url(...)"`, foreign objects, external `xlink:href`, embedded HTML via `<foreignObject>`.
- Author-role gate: only `ADMIN` can publish articles containing `:::svg`. Validation rejects contributor-submitted articles with `:::svg` regardless of who later approves them.
- Render-time sanitization (not write-time) for defense-in-depth if the allowlist changes later.

### MCP article authoring tools (medium priority)

Per `docs/ROADMAP.md`, `create_article` / `update_article` / `approve_article` are MCP v2 work. When that lands:

- The tools reuse `validateArticleDirectivesForPublish()` for pre-validation.
- `scripts/mcp-e2e-test.mjs` extends with a visual-article smoke test.
- The "stale bundle" footgun applies — rebuild after any `mcp-server/src/**` change.

### Other v1.5 items

- WYSIWYG block builder (approach C). Revisit if MCP edit-pain becomes real.
- AI image generation.
- Mermaid live preview in `ArticleEditor`.
- Visual articles inside Tracks with special styling.
- A `:::quiz` or `:::interactive-query` directive — interactive surfaces deserve their own design.
- Dark variants of uploaded raster assets.
- A `/learn/visual` filtered route.
- Public asset library / image search across uploaded blobs.
- OG-image generation that uses the first `:::figure` as the social card.
- Orphan-blob detection in the GC cron (second-pass scan of `Article.content` references).

## Verification commands

```bash
# Local dev
npm run dev
open http://localhost:3000/learn/joins/how-a-join-works

# Unit + render
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' \
  npm run test:directive-renderer
DATABASE_URL='...' npm run test:article-publish-validation
DATABASE_URL='...' npm run test:article-publish-routes
DATABASE_URL='...' npm run test:uploads
DATABASE_URL='...' npm run test:upload-quota-race
DATABASE_URL='...' npm run test:upload-phase1-atomicity
DATABASE_URL='...' npm run test:asset-gc

# MCP boundary check (no DB needed)
npm run check:mcp-bundle-isolation
DATABASE_URL='...' npm run test:asset-delete-references
DATABASE_URL='...' npm run test:admin-asset-delete
DATABASE_URL='...' npm run test:admin-asset-delete-retry
DATABASE_URL='...' npm run test:mermaid-sanitization

# E2E
npx playwright test tests/e2e/learn-visual-article.spec.ts
npx playwright test tests/e2e/learn-csp.spec.ts

# Seed (idempotent)
DATABASE_URL='...' npm run db:seed -- --include-visual

# Health
curl -s http://localhost:3000/api/health
```

## Reference

- Brainstorm preview: `/tmp/datalearn-learn-v2-preview/index.html` (visual side-by-side of the three approaches, with one fully rendered example article).
- Existing renderer: `components/markdown/MarkdownRenderer.tsx`, `app/learn/[topicSlug]/[articleSlug]/page.tsx`.
- Existing Article model: `prisma/schema.prisma` lines 91-145.
- MCP server: `mcp-server/src/index.ts`, contract in `mcp-server/README.md`.
