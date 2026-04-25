# Ship v1 — Design Spec

> **Date:** 2026-04-25
> **Branch:** `feat/ship-v1`
> **Goal:** Deploy datalearn to a public URL at which a stranger can practice SQL with a working validation loop.

---

## 1. Context

The project has a working local dev experience (auth, learning hub, SQL playground with DuckDB-WASM, admin for pages, RSS news) and a committed "foundation hardening" pass (SEO, type safety, Zod validation, loading/error pages). An earlier PM review (`docs/PM_STRATEGY_REVIEW.md`, 2026-02-16) recommended shipping to production as the next step; ~10 weeks have passed without that happening. Uncommitted changes on disk partially fix the SQL playground but are not yet merged.

This spec defines a single coherent launch — the minimum that makes the live URL usable by a cold visitor — and explicitly defers everything else.

---

## 2. Goals

1. The site is live at a Vercel production URL backed by Neon Postgres.
2. A stranger (no login) can open any SQL problem, run queries in DuckDB-WASM, click **Submit**, and see ✅ / ✗ against an expected output.
3. The content bank is 10–12 SQL problems across 2–3 schemas and 3 articles — enough that a first-time visitor has real material.
4. Uncommitted SQL playground fixes land as part of this ship.
5. Prod has basic observability (Vercel Analytics + Runtime Logs) so we know if anything breaks.

## 3. Non-goals

These are deliberately deferred to follow-up spec cycles:

- Login-gated practice loop, per-user progress persistence, `Submission` model.
- Admin CRUD for Topics / Articles / SQL Problems (content seeds via `prisma/seed.ts`).
- Design system overhaul, dark mode, animations.
- Testing framework (Vitest/Playwright) and GitHub Actions CI.
- Hint system, solution reveal, query history, "solved" badges.
- Python playground, real-time collaboration, system design whiteboard.
- Sentry / dedicated error monitoring beyond Vercel's built-ins.

---

## 4. User flow

1. Stranger visits `/practice/<slug>`.
2. Server component (`app/practice/[slug]/page.tsx`) loads the problem with `include: { schema: true }`.
3. Page renders `ProblemWorkspace` with `{ initialSql, schemaSql: problem.schema.sql, problemSlug, ordered }`. `expectedOutput` stays server-only.
4. `SqlPlayground` initializes DuckDB-WASM, splits schema into single statements, executes them sequentially.
5. User writes SQL, clicks **Run** → DuckDB executes client-side → results render in `ResultTable`.
6. User clicks **Submit** → client re-runs the current query → calls `validateSubmission({ problemSlug, userResult })` server action.
7. Server loads the problem by slug, reads `expectedOutput` and `ordered`, runs `compareResults(...)`, returns `{ ok, reason?, diff? }`.
8. `ValidationResult` renders ✅ "Correct" or ✗ with reason and optional diff.

No DB writes occur in this flow.

---

## 5. Validation semantics

Pure function, `lib/sql-validator.ts`:

```ts
compareResults(user: Row[], expected: Row[], opts: { ordered: boolean }): Result
```

where `Result = { ok: true } | { ok: false, reason: string, diff?: { userKeys, expectedKeys, firstMismatch } }`.

**Algorithm:**
1. Both sides must be `Array<Record<string, unknown>>`. Otherwise `{ ok: false, reason: "Unexpected result shape" }`.
2. **Column match (strict on set, lenient on order):** compare sets of keys. Mismatch → fail with `"Column mismatch — got [a,b], expected [a,c]"`. Extra columns in user's result count as mismatch.
3. **Row comparison:**
   - `ordered: true` → compare row-by-row in the original order.
   - `ordered: false` → canonicalize each row (sort its keys and serialize), sort the array of canonical strings on both sides, then compare.
   - Multiset semantics: duplicate rows are counted (prevents passing `DISTINCT`-requiring problems with fewer rows).
4. **Cell equality:**
   - `null` matches `null`.
   - Strings are trimmed before comparison.
   - Numeric strings match numbers (`"1" == 1`).
   - `Decimal` / `BigInt` values returned by DuckDB are coerced to `Number` when the value is within `Number.MAX_SAFE_INTEGER` and round-trips exactly; otherwise compared as canonical decimal strings (no scientific notation, trimmed trailing zeros after the decimal point).
   - Floating-point comparison uses an epsilon of `1e-9`.
5. Empty user result and empty expected result both → pass.

**Server placement:** all validation runs inside the `validateSubmission` server action. `expectedOutput` is never shipped to the client. Input is Zod-validated (`problemSlug: string`, `userResult: array of records`).

**Schema addition:** `ordered Boolean @default(false)` on `SQLProblem`. Seeded `true` only for problems whose answer depends on ordering (e.g., "Department with largest headcount").

---

## 6. Data model changes

### 6.1 New `SqlSchema` model

Currently every `SQLProblem` stores its own full copy of the schema SQL in the `sqlSchema` TEXT column. Seeding 5 ecommerce problems duplicates ~800 chars five times, and any schema edit needs five updates. We introduce a shared `SqlSchema` model:

```prisma
model SqlSchema {
  id       String       @id @default(cuid())
  name     String       @unique  // "ecommerce" | "hr" | "users"
  sql      String       @db.Text
  problems SQLProblem[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model SQLProblem {
  // ... existing fields except sqlSchema
  schemaId String
  schema   SqlSchema @relation(fields: [schemaId], references: [id])
}
```

### 6.2 Migration strategy

DDL is split from DML — Prisma migrations handle structure; the seed script handles data.

**Migration `add_sql_schema_model` (DDL only):**

1. Create `SqlSchema` table.
2. Add nullable `schemaId` column on `SQLProblem` with FK to `SqlSchema(id)`.
3. Keep the existing `sqlSchema` TEXT column *for now* (removed in a follow-up migration once every row is linked).

**Seed step (run after migration, in `prisma/seed.ts`):**

4. Upsert the three canonical `SqlSchema` rows (`users`, `ecommerce`, `hr`) by unique `name`.
5. Upsert each `SQLProblem` with its `schemaId` pointing at the right schema row. The existing three problems get linked at this point; new problems are created linked from the start.

**Migration `finalize_sql_schema_model` (DDL, follow-up):**

6. Alter `schemaId` to `NOT NULL`.
7. Drop `sqlSchema` column from `SQLProblem`.

Production DB is empty at launch (first deploy), so `prisma migrate deploy` runs both migrations and the seed in order with no backfill concerns. The split exists for correctness on any non-empty DB (local dev that has already been seeded) and to keep each migration trivially reversible.

### 6.3 `ordered` flag

Separate migration `add_ordered_flag_to_sql_problem`: adds `ordered BOOLEAN NOT NULL DEFAULT false` to `SQLProblem`. Kept in its own migration so the data-model refactor and the feature addition land separately.

---

## 7. Content plan

**Three schemas:**

- `users` (already present; keep): warmup schema, 1 problem.
- `ecommerce` (already in `lib/seed-data.ts`; unchanged): `customers`, `products`, `orders`, `order_items`.
- `hr` (new, `lib/seed-data-hr.ts`): `employees`, `departments`, `salaries`, ~8 employees across 3 departments.

**Eleven problems, skewed easy:**

| # | Slug | Schema | Difficulty | `ordered` |
|---|------|--------|------------|-----------|
| 1 | `simple-select` | users | EASY | false |
| 2 | `customers-by-country` | ecommerce | EASY | false |
| 3 | `orders-in-date-range` | ecommerce | EASY | false |
| 4 | `average-order-value` | ecommerce | EASY | false |
| 5 | `total-revenue-per-customer` | ecommerce | MEDIUM | false |
| 6 | `customers-with-more-than-n-orders` | ecommerce | MEDIUM | false |
| 7 | `products-never-ordered` | ecommerce | MEDIUM | false |
| 8 | `top-selling-products` | ecommerce | HARD | false |
| 9 | `employees-hired-in-last-year` | hr | EASY | false |
| 10 | `highest-paid-per-department` | hr | MEDIUM | false |
| 11 | `largest-department` | hr | MEDIUM | true |

Spread: 4 EASY / 5 MEDIUM / 2 HARD.

**Three articles under the existing "Data Engineering 101" topic:**

- `what-is-etl` (existing).
- `batch-vs-stream-processing` (new, ~400 words).
- `oltp-vs-olap` (new, ~400 words).

---

## 8. Architecture & components

### 8.1 New files

- `lib/sql-validator.ts` — pure `compareResults` function.
- `lib/seed-data-hr.ts` — HR schema SQL constant.
- `actions/submissions.ts` — `validateSubmission` server action.
- `components/sql/ValidationResult.tsx` — presentational ✅/✗ with reason + optional diff view.

### 8.2 Modified files

- `prisma/schema.prisma` — add `SqlSchema` model, update `SQLProblem`, add `ordered`.
- `prisma/seed.ts` — write schemas first, then problems referencing `schemaId`.
- `app/practice/[slug]/page.tsx` — fetch with `include: { schema: true }`.
- `components/sql/SqlPlayground.tsx` — accept optional `onSubmit` / `problemSlug`, render Submit button when present. Keep the uncommitted multi-statement splitter and `initialQuery` plumbing.
- `components/sql/ProblemWorkspace.tsx` — wire the submit handler and `problemSlug` prop. Keep the uncommitted `initialQuery` threading.
- `lib/seed-data.ts` — keep the uncommitted one-statement-per-line ecommerce form.
- `actions/news.ts`, `package.json` — keep the uncommitted `rss-parser` removal / hand-rolled fetch.
- `app/layout.tsx` — add `@vercel/analytics/react` `<Analytics />`.

### 8.3 Deployment configuration

- **Vercel** — project linked to repo, `main` = production, PRs get previews.
- **Neon Postgres** — free tier; single prod DB for v1 (branch DBs for previews are a nice-to-have, not required).
- **Env vars (Vercel Project Settings):** `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GITHUB_ID`, `GITHUB_SECRET`, `GOOGLE_ID`, `GOOGLE_SECRET`.
- **Build command:** `prisma migrate deploy && next build` (via `vercel-build` script in `package.json`).
- **`postinstall`** already runs `prisma generate` — keep.
- **OAuth callbacks:** register the Vercel production URL with GitHub and Google OAuth apps. Admin path is the only user of auth in v1.

### 8.4 Observability

- `@vercel/analytics` package in root layout — page views, Web Vitals.
- Vercel Runtime Logs — server action errors.
- No Sentry this round. Revisit after first week in prod.

---

## 9. Error handling

| Case | Where caught | Behavior |
|------|--------------|----------|
| DuckDB-WASM init fails | `SqlPlayground` `useEffect` | Existing error state |
| Schema statement fails | Statement loop in playground | Show "Setup error: <stmt>"; disable Run/Submit |
| User query syntax error | DuckDB `query()` catch | Show error in `ResultTable` error row |
| User clicks Submit before Run | Button disabled until first successful Run | UI state |
| User edits query after Run, then clicks Submit | Submit handler re-runs the current editor contents before validating | Always validates current query |
| Server: slug not found | Zod + explicit check | `{ ok: false, reason: "Problem not found" }` |
| Server: malformed userResult | Zod reject | `{ ok: false, reason: "Invalid result shape" }` |
| Prod: `DATABASE_URL` missing or Neon cold-start timeout | Existing `app/error.tsx` boundary | User sees the committed error page |
| Prod: DuckDB-WASM 404 | Client init error path | "SQL engine failed to load. Reload." |

**Security:**
- `expectedOutput` never crosses the network to the client.
- Server action is anonymous (Q4 decision) but Zod-validated.
- Admin routes keep existing NextAuth session gating.
- No rate limiting this round; acceptable because the action is read-only and cheap.

---

## 10. Launch sequence

Single branch `feat/ship-v1` off `main`. One atomic commit per step. Merge once.

1. `fix: sql playground handles multi-statement schemas` — land uncommitted playground + seed-data + news changes.
2. `feat: SqlSchema model, migrate problems to FK` — new model, migration, seed rewrite, practice page FK include.
3. `feat: add ordered flag to SQLProblem` — single-field migration + seed update.
4. `feat: sql result validator` — `lib/sql-validator.ts` (pure function).
5. `feat: submit button + validation UI` — server action + `ValidationResult` + Submit button wiring.
6. `feat: seed HR schema and expand problem bank` — `lib/seed-data-hr.ts` + 8 new problems.
7. `feat: seed two additional articles` — markdown content.
8. `chore: vercel analytics + prod env scaffolding` — `@vercel/analytics`, `env.example` updates, README Vercel/Neon setup notes.

**🚦 Infra smoke deploy (after step 3 or 4):** push branch to Vercel as preview with a throwaway Neon branch. Verify OAuth callbacks resolve, Prisma connects through the pooler, DuckDB-WASM WASM binary loads via Vercel CDN, `app/error.tsx` triggers when `DATABASE_URL` is deliberately broken. Fix any issue in-branch. Preview URL not shared.

9. **Prod launch:** merge `feat/ship-v1` → `main` → Vercel auto-deploys. `prisma migrate deploy` runs in build. Manual smoke: home → practice → run → submit → ✅. Tag `v0.2.0`.

---

## 11. Risks

- **NextAuth 5 beta × Neon pooler × Vercel** — edge-runtime assumptions can fail at build time. Mitigation: infra smoke deploy before the full feature branch is done.
- **DuckDB-WASM first-load size (~30MB)** — painful on mobile. Accepted for v1; document in README.
- **Zero automated tests** — validator edge cases could regress unnoticed. Mitigation: hand-walk the Section 5 matrix against the seeded problems before launch, and structure the validator as a pure function so tests are easy to add in a follow-up.
- **Content thinness even after expansion** — 11 problems is ~30 min of chewing. Accepted; a follow-up spec can focus purely on content.

---

## 12. Open questions

None outstanding as of spec completion. Future spec cycles will address:

- When to add auth-gated progress tracking (`Submission` model, solved badges).
- When / whether to build admin CRUD for problems (with `SqlSchema` now in place, it becomes tractable).
- When to add tests + CI.
- When / whether to add Sentry.
