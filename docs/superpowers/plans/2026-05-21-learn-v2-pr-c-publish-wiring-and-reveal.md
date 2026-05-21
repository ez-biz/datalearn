# Learn v2 — PR C: Publish wiring + editor + listing + seed lesson

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tie PR A (asset infra) and PR B (directive renderer + CSP) together into a public, learner-visible reveal. Add `Article.hasVisualBlocks`, the Prisma-aware Layer 2 validator, validation wiring on every PUBLISHED transition path, the `ArticleEditor` insert menu + "My uploads" tab, the "Visual" listing pill, and one fully-authored seed lesson ("How a JOIN works") demonstrating all five directives.

**Architecture:** Single PR off `main` (branch `feat/learn-v2-pr-c-publish-wiring`). **Depends on PR A and PR B being merged to main first.** Adds Layer 2 (`actions/article-publish-validation.ts`, Prisma-aware, server-only) and wires it into four routes. Editor changes use the upload endpoint shipped in PR A and the directive renderer shipped in PR B. Backfill script populates `hasVisualBlocks` on existing PUBLISHED articles after migration.

**Tech Stack:** Next.js 16 App Router server actions + REST routes, Prisma 7, `react-markdown` + directive components (from PR B), `@vercel/blob` uploads via `/api/me/uploads` (from PR A), Playwright.

**References:**
- Spec: `docs/superpowers/specs/2026-05-20-learn-v2-visual-articles-design.md`
  - "Publish-time validation" — Layer 2 contract, four wiring points, route-level test requirements.
  - "Admin editor changes" — insert menu + "My uploads" tab.
  - "Listing UX" — Visual pill, denormalized flag.
  - "Seed lesson" — reference content + idempotency.
- Release version: **v0.5.0** (the reveal release).

---

## File map

**Create:**
- `actions/article-publish-validation.ts` — Layer 2 validator (Prisma-aware, server-only).
- `prisma/migrations/<timestamp>_add_article_has_visual_blocks/migration.sql` — auto-generated.
- `scripts/backfill-has-visual-blocks.ts` — one-shot post-deploy script.
- `scripts/test-article-publish-routes.ts` — route-level wiring tests (six cases per route).
- `prisma/seed-visual-lesson.ts` — seed the "How a JOIN works" reference lesson.
- `public/learn/img/joins-hero.svg`, `public/learn/img/joins-hash-vs-nested.svg`, `public/learn/img/joins-step-1.svg`, `public/learn/img/joins-step-2.svg`, `public/learn/img/joins-step-3.svg`.
- `tests/e2e/learn-visual-article.spec.ts`.
- `tests/e2e/learn-mermaid-lazy-load.spec.ts`.

**Modify:**
- `prisma/schema.prisma` — add `hasVisualBlocks Boolean @default(false)` + index on `Article`.
- `app/api/admin/articles/route.ts` — wire validation on create-with-PUBLISHED.
- `app/api/admin/articles/[slug]/route.ts` — wire validation on PATCH where resulting state is PUBLISHED.
- `app/api/admin/articles/[slug]/approve/route.ts` — wire validation always.
- `app/api/me/articles/[slug]/submit/route.ts` — wire Layer 1 advisory validation (returns errors as 400 without changing publish semantics).
- `components/admin/ArticleEditor.tsx` — insert menu + "My uploads" tab.
- `actions/content.ts` — add `hasVisualBlocks` to topic + article projections.
- `app/learn/page.tsx` and `app/learn/[topicSlug]/page.tsx` — show Visual pill.
- `package.json` — add `seed-visual` + `test:article-publish-routes` scripts.
- `docs/ROADMAP.md`, `docs/DEPLOY.md`, `mcp-server/README.md`.

---

## Task 1: Worktree + branch setup

**Files:** none (git state)

- [ ] **Step 1: Confirm PR A and PR B have merged to main**

```bash
cd /Users/anchitgupta/Documents/Github/datalearn
git fetch origin main
git log --oneline origin/main | head -15
```

Expected: log shows both `feat: Learn v2 PR A — asset infrastructure` and `feat: Learn v2 PR B — directive renderer + CSP` merge commits before this PR begins.

- [ ] **Step 2: Create the worktree off main**

```bash
git worktree add ../datalearn-pr-c -b feat/learn-v2-pr-c-publish-wiring origin/main
cd ../datalearn-pr-c
npm install
```

- [ ] **Step 3: Confirm tree is clean**

```bash
git status && git log --oneline -1
```

---

## Task 2: `Article.hasVisualBlocks` migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the field + index**

In the `Article` model (around line 91), add:

```prisma
  hasVisualBlocks Boolean @default(false)
```

And in the index list at the bottom of the model:

```prisma
  @@index([hasVisualBlocks])
```

- [ ] **Step 2: Generate the migration**

```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' \
  npx prisma migrate dev --name add_article_has_visual_blocks
```

- [ ] **Step 3: Spot-check SQL**

```bash
cat prisma/migrations/*_add_article_has_visual_blocks/migration.sql
```

Expected: `ALTER TABLE "Article" ADD COLUMN "hasVisualBlocks" BOOLEAN NOT NULL DEFAULT false;` + a `CREATE INDEX`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(prisma): Article.hasVisualBlocks denormalized flag"
```

---

## Task 3: Backfill script

**Files:**
- Create: `scripts/backfill-has-visual-blocks.ts`

- [ ] **Step 1: Implement**

```ts
// scripts/backfill-has-visual-blocks.ts
import { PrismaClient } from "@prisma/client"
import { validateArticleDirectivesSyntactic } from "../lib/admin-validation"

const prisma = new PrismaClient()

async function main() {
  let cursor: string | undefined
  let scanned = 0
  let updated = 0
  for (;;) {
    const batch = await prisma.article.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { id: "asc" },
      take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, content: true, hasVisualBlocks: true },
    })
    if (batch.length === 0) break
    for (const a of batch) {
      scanned++
      const result = validateArticleDirectivesSyntactic(a.content)
      if (result.hasVisualBlocks !== a.hasVisualBlocks) {
        await prisma.article.update({
          where: { id: a.id },
          data: { hasVisualBlocks: result.hasVisualBlocks },
        })
        updated++
      }
    }
    cursor = batch[batch.length - 1].id
  }
  console.log(`backfill complete: scanned=${scanned}, updated=${updated}`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Dry-run locally**

```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' \
  npx tsx scripts/backfill-has-visual-blocks.ts
```

Expected: prints scan results. On a fresh local DB with no directives in any article: `scanned=N, updated=0`.

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-has-visual-blocks.ts
git commit -m "feat(backfill): set Article.hasVisualBlocks from existing content"
```

---

## Task 4: Layer 2 validator (Prisma-aware)

**Files:**
- Create: `actions/article-publish-validation.ts`

- [ ] **Step 1: Implement**

```ts
// actions/article-publish-validation.ts
import "server-only"
import { prisma } from "@/lib/prisma"
import {
  validateArticleDirectivesSyntactic,
  type ArticleDirectiveError,
} from "@/lib/admin-validation"

export interface PublishValidationOk {
  ok: true
  hasVisualBlocks: boolean
}
export interface PublishValidationErr {
  ok: false
  errors: ArticleDirectiveError[]
}
export type PublishValidationResult = PublishValidationOk | PublishValidationErr

export async function validateArticleDirectivesForPublish(
  content: string,
  articleAuthorId: string,
): Promise<PublishValidationResult> {
  const syntactic = validateArticleDirectivesSyntactic(content)
  if (!syntactic.ok) return { ok: false, errors: syntactic.errors }

  // Layer 2 semantic checks for figure URLs.
  const blobUrls = syntactic.figureUrls.filter(
    (u) => !u.startsWith("/learn/"),
  )
  if (blobUrls.length === 0) {
    return { ok: true, hasVisualBlocks: syntactic.hasVisualBlocks }
  }

  const assets = await prisma.asset.findMany({
    where: { blobUrl: { in: blobUrls } },
    select: { blobUrl: true, status: true, ownerId: true },
  })
  const byUrl = new Map(assets.map((a) => [a.blobUrl!, a]))

  const errors: ArticleDirectiveError[] = []
  for (const url of blobUrls) {
    const a = byUrl.get(url)
    if (!a) {
      errors.push({
        directive: "figure",
        index: -1,
        message: `figure src "${url}" has no Asset row in this app (foreign Blob rejected)`,
      })
      continue
    }
    if (a.status !== "ACTIVE") {
      errors.push({
        directive: "figure",
        index: -1,
        message: `figure src "${url}" is ${a.status}, not ACTIVE`,
      })
      continue
    }
    if (a.ownerId !== articleAuthorId) {
      errors.push({
        directive: "figure",
        index: -1,
        message: `figure src "${url}" is owned by a different user; admin override is not permitted in v1`,
      })
    }
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, hasVisualBlocks: syntactic.hasVisualBlocks }
}
```

- [ ] **Step 2: Confirm the file is server-only**

`"server-only"` import at top throws at build time if anything client imports this file. No need to touch `lib/admin-validation.ts`.

- [ ] **Step 3: Commit**

```bash
git add actions/article-publish-validation.ts
git commit -m "feat(validation): Layer 2 binds figure URLs to ACTIVE author-owned Assets"
```

---

## Task 5: Wire validation into admin create

**Files:**
- Modify: `app/api/admin/articles/route.ts`

- [ ] **Step 1: Read the existing handler**

```bash
sed -n '1,200p' app/api/admin/articles/route.ts
```

Identify where `status === "PUBLISHED"` is decided on create.

- [ ] **Step 2: Wire the validator**

Where the route handles a PUBLISHED create, add (before the `prisma.article.create`):

```ts
import { validateArticleDirectivesForPublish } from "@/actions/article-publish-validation"

// inside the POST handler, after body parse + Zod validation, before prisma.article.create:
if (parsed.status === "PUBLISHED") {
  const result = await validateArticleDirectivesForPublish(parsed.content, session.user.id)
  if (!result.ok) {
    return NextResponse.json({ error: "directive-validation", errors: result.errors }, { status: 400 })
  }
  parsed.hasVisualBlocks = result.hasVisualBlocks
}
```

Pass `hasVisualBlocks` to the `prisma.article.create` `data` (extend the existing select/data shape).

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/articles/route.ts
git commit -m "feat(api): admin create wires Layer 2 validation on PUBLISHED"
```

---

## Task 6: Wire validation into admin PATCH (resulting-state check)

**Files:**
- Modify: `app/api/admin/articles/[slug]/route.ts`

- [ ] **Step 1: Add resulting-state validation**

Per spec: trigger validation whenever the **resulting** row would be PUBLISHED, not only on transitions.

```ts
import { validateArticleDirectivesForPublish } from "@/actions/article-publish-validation"

// inside PATCH handler, after parsing the body and loading `existing`:
const merged = { ...existing, ...parsed }
if (merged.status === "PUBLISHED") {
  const result = await validateArticleDirectivesForPublish(merged.content, merged.authorId)
  if (!result.ok) {
    return NextResponse.json({ error: "directive-validation", errors: result.errors }, { status: 400 })
  }
  parsed.hasVisualBlocks = result.hasVisualBlocks
} else {
  // Going to DRAFT/ARCHIVED — leaving public — skip validation; preserve current flag.
}
// then pass parsed (with hasVisualBlocks) through to prisma.article.update
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/articles/\[slug\]/route.ts
git commit -m "feat(api): admin PATCH wires Layer 2 on resulting PUBLISHED state"
```

---

## Task 7: Wire validation into approve route

**Files:**
- Modify: `app/api/admin/articles/[slug]/approve/route.ts`

- [ ] **Step 1: Add validation as a hard gate**

```ts
import { validateArticleDirectivesForPublish } from "@/actions/article-publish-validation"

// Inside the POST handler, after loading `article`:
const result = await validateArticleDirectivesForPublish(article.content, article.authorId)
if (!result.ok) {
  return NextResponse.json({ error: "directive-validation", errors: result.errors }, { status: 400 })
}

// continue with the existing approval transaction; pass hasVisualBlocks: result.hasVisualBlocks
// in the prisma.article.update data so the flag stays in sync.
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/articles/\[slug\]/approve/route.ts
git commit -m "feat(api): approve route wires Layer 2 + hasVisualBlocks"
```

---

## Task 8: Wire Layer 1 advisory into contributor submit

**Files:**
- Modify: `app/api/me/articles/[slug]/submit/route.ts`

- [ ] **Step 1: Add advisory validation**

```ts
import { validateArticleDirectivesSyntactic } from "@/lib/admin-validation"

// Inside POST, after loading `article` and confirming ownership:
const syntactic = validateArticleDirectivesSyntactic(article.content)
if (!syntactic.ok) {
  return NextResponse.json(
    { error: "directive-validation", errors: syntactic.errors, advisory: true },
    { status: 400 },
  )
}
// Layer 2 deliberately not run on submit — admin runs it on approve.
```

- [ ] **Step 2: Commit**

```bash
git add app/api/me/articles/\[slug\]/submit/route.ts
git commit -m "feat(api): contributor submit runs Layer 1 advisory check"
```

---

## Task 9: Route-level publish tests

**Files:**
- Create: `scripts/test-article-publish-routes.ts`

- [ ] **Step 1: Add the script entry**

In `package.json`:
```json
"test:article-publish-routes": "tsx scripts/test-article-publish-routes.ts"
```

- [ ] **Step 2: Write the test (covers all four entry points + the PATCH-on-PUBLISHED regression)**

```ts
import { PrismaClient } from "@prisma/client"
import assert from "node:assert/strict"

const prisma = new PrismaClient()
const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000"

async function seedAdmin() {
  const id = "test-pub-admin"
  await prisma.user.upsert({
    where: { id },
    create: { id, email: `${id}@test.local`, role: "ADMIN" },
    update: { role: "ADMIN" },
  })
  return id
}
async function seedContributor(suffix: string) {
  const id = `test-pub-contrib-${suffix}`
  await prisma.user.upsert({
    where: { id },
    create: { id, email: `${id}@test.local`, role: "CONTRIBUTOR" },
    update: { role: "CONTRIBUTOR" },
  })
  return id
}
async function seedActiveAsset(ownerId: string) {
  return prisma.asset.create({
    data: {
      ownerId,
      blobUrl: `https://store.vercel-storage.com/learn/${ownerId}/${Date.now()}.svg`,
      blobKey: `learn/${ownerId}/${Date.now()}.svg`,
      contentType: "image/svg+xml",
      bytes: 100,
      status: "ACTIVE",
    },
  })
}
async function seedTopic() {
  return prisma.topic.upsert({
    where: { slug: "test-pub-topic" },
    create: { name: "T", slug: "test-pub-topic" },
    update: {},
  })
}
const f = (url: string) => async (path: string, init?: RequestInit) =>
  fetch(`${BASE}${path}`, { ...init, headers: { ...init?.headers, "X-Test-User-Id": url } })

async function main() {
  const admin = await seedAdmin()
  const topic = await seedTopic()

  // ===== Case 1: admin create with PUBLISHED — bad alt rejected =====
  const adminFetch = f(admin)
  const adminAsset = await seedActiveAsset(admin)
  const badAlt = await adminFetch("/api/admin/articles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "BadAlt", slug: "badalt", status: "PUBLISHED",
      content: `:::figure{src="${adminAsset.blobUrl}"}\nx\n:::`,
      topicSlug: topic.slug,
    }),
  })
  assert.equal(badAlt.status, 400)

  // ===== Case 2: admin create with PUBLISHED — happy =====
  const okCreate = await adminFetch("/api/admin/articles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "Good", slug: "good-create", status: "PUBLISHED",
      content: `:::figure{src="${adminAsset.blobUrl}" alt="x"}\nx\n:::`,
      topicSlug: topic.slug,
    }),
  })
  assert.equal(okCreate.status, 200, await okCreate.text())
  const created = await prisma.article.findUniqueOrThrow({ where: { slug: "good-create" } })
  assert.equal(created.hasVisualBlocks, true)

  // ===== Case 3: foreign Blob URL rejected =====
  const foreign = await adminFetch("/api/admin/articles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "Foreign", slug: "foreign", status: "PUBLISHED",
      content: `:::figure{src="https://store.vercel-storage.com/some/foreign-url.svg" alt="x"}\nx\n:::`,
      topicSlug: topic.slug,
    }),
  })
  assert.equal(foreign.status, 400)

  // ===== Case 4: cross-owner asset rejected (even for admin publisher) =====
  const otherUser = await seedContributor("4")
  const otherAsset = await seedActiveAsset(otherUser)
  const crossOwner = await adminFetch("/api/admin/articles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "CrossOwn", slug: "crossown", status: "PUBLISHED",
      content: `:::figure{src="${otherAsset.blobUrl}" alt="x"}\nx\n:::`,
      topicSlug: topic.slug,
    }),
  })
  assert.equal(crossOwner.status, 400)

  // ===== Case 5: PATCH on already-PUBLISHED with bad directive rejected =====
  const patchBad = await adminFetch(`/api/admin/articles/good-create`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      content: `:::callout{kind="bogus"}\nx\n:::`,
    }),
  })
  assert.equal(patchBad.status, 400)

  // ===== Case 6: PATCH on already-PUBLISHED removing all directives flips hasVisualBlocks=false =====
  const patchClear = await adminFetch(`/api/admin/articles/good-create`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: `# Plain prose now\n\nNo directives.` }),
  })
  assert.equal(patchClear.status, 200)
  const refreshed = await prisma.article.findUniqueOrThrow({ where: { slug: "good-create" } })
  assert.equal(refreshed.hasVisualBlocks, false)

  // ===== Case 7: approve route runs validation =====
  const c5 = await seedContributor("5")
  const c5Asset = await seedActiveAsset(c5)
  const draft = await prisma.article.create({
    data: {
      title: "Submitted", slug: "submitted", status: "SUBMITTED",
      content: `:::figure{src="${c5Asset.blobUrl}"}\nbad — no alt\n:::`,
      authorId: c5, topicId: topic.id,
    },
  })
  const approve = await adminFetch(`/api/admin/articles/submitted/approve`, { method: "POST" })
  assert.equal(approve.status, 400)
  // Now fix the article and retry
  await prisma.article.update({
    where: { id: draft.id },
    data: { content: `:::figure{src="${c5Asset.blobUrl}" alt="ok"}\nbody\n:::` },
  })
  const approve2 = await adminFetch(`/api/admin/articles/submitted/approve`, { method: "POST" })
  assert.equal(approve2.status, 200, await approve2.text())

  // ===== Case 8: contributor submit returns advisory errors =====
  const c8 = await seedContributor("8")
  const subDraft = await prisma.article.create({
    data: {
      title: "Sub", slug: "sub-bad", status: "DRAFT",
      content: `:::callout{kind="oops"}\nx\n:::`,
      authorId: c8, topicId: topic.id,
    },
  })
  const c8Fetch = f(c8)
  const submit = await c8Fetch(`/api/me/articles/sub-bad/submit`, { method: "POST" })
  assert.equal(submit.status, 400)
  const subBody = (await submit.json()) as { advisory?: boolean }
  assert.equal(subBody.advisory, true)

  // Cleanup
  await prisma.articleVersion.deleteMany({})
  await prisma.article.deleteMany({ where: { topicId: topic.id } })
  await prisma.asset.deleteMany({ where: { ownerId: { in: [admin, otherUser, c5, c8] } } })
  await prisma.userAssetQuota.deleteMany({})
  await prisma.topic.delete({ where: { id: topic.id } })
  await prisma.user.deleteMany({ where: { id: { in: [admin, otherUser, c5, c8] } } })

  console.log("test-article-publish-routes PASS")
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
```

- [ ] **Step 3: Run against a live dev server**

```bash
# Terminal 1
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run dev

# Terminal 2
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' \
  npm run test:article-publish-routes
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add scripts/test-article-publish-routes.ts package.json
git commit -m "test(api): publish-route wiring + PATCH-on-PUBLISHED + approve + submit"
```

---

## Task 10: ArticleEditor — Insert menu

**Files:**
- Modify: `components/admin/ArticleEditor.tsx`

- [ ] **Step 1: Read the existing editor**

```bash
cat components/admin/ArticleEditor.tsx
```

Identify the toolbar and the controlled textarea state.

- [ ] **Step 2: Add an "Insert" dropdown with five entries**

```tsx
// Add at the toolbar level inside ArticleEditor.
function InsertMenu({ onInsert }: { onInsert: (text: string) => void }) {
  const [open, setOpen] = useState(false)
  const items: { label: string; snippet: string }[] = [
    { label: "Upload image…", snippet: "__UPLOAD__" },
    { label: "Mermaid diagram", snippet: `\n:::mermaid{alt=""}\nflowchart LR\n  A --> B\n:::\n` },
    { label: "Steps", snippet: `\n:::steps\n1. **First** body\n2. **Second** body\n3. **Third** body\n:::\n` },
    { label: "Side-by-side", snippet: `\n:::side-by-side\n### Left\nleft body\n\n---\n\n### Right\nright body\n:::\n` },
    { label: "Callout", snippet: `\n:::callout{kind="tip"}\nbody\n:::\n` },
  ]
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
      >
        Insert ▾
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-56 rounded-md border border-border bg-surface shadow-md">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              onClick={async () => {
                setOpen(false)
                if (it.snippet === "__UPLOAD__") {
                  const url = await uploadViaPicker()
                  if (url) onInsert(`\n:::figure{src="${url}" alt=""}\n\n:::\n`)
                  return
                }
                onInsert(it.snippet)
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

async function uploadViaPicker(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/svg+xml,image/png,image/jpeg,image/webp,image/gif"
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/me/uploads", { method: "POST", body: form })
      if (!res.ok) {
        alert(`upload failed: ${res.status} ${await res.text()}`)
        return resolve(null)
      }
      const body = (await res.json()) as { url: string }
      resolve(body.url)
    }
    input.click()
  })
}
```

In the editor body, render `<InsertMenu onInsert={(text) => setContent(c => insertAtCursor(c, text))} />` next to existing toolbar buttons, and implement `insertAtCursor` to splice into the controlled textarea at the current selection.

- [ ] **Step 3: Manual smoke**

```bash
npm run dev
# In a browser: open /admin/articles/<some draft>, click Insert → Mermaid → confirm snippet lands at cursor.
```

- [ ] **Step 4: Commit**

```bash
git add components/admin/ArticleEditor.tsx
git commit -m "feat(admin): Article editor Insert menu (upload, mermaid, steps, sbs, callout)"
```

---

## Task 11: ArticleEditor — "My uploads" tab

**Files:**
- Modify: `components/admin/ArticleEditor.tsx`

- [ ] **Step 1: Add a tab section beside the editor body**

```tsx
function MyUploadsTab({ onInsertUrl }: { onInsertUrl: (url: string) => void }) {
  const [items, setItems] = useState<{ id: string; blobUrl: string; contentType: string; bytes: number }[]>([])
  useEffect(() => {
    fetch("/api/me/uploads").then((r) => r.json()).then((j) => setItems(j.items))
  }, [])

  return (
    <div className="border-l border-border px-3 py-2 text-sm">
      <h3 className="mb-2 font-semibold">My uploads</h3>
      <ul className="grid gap-2">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2 rounded border border-border bg-surface p-2">
            <img src={it.blobUrl} alt="" className="h-10 w-10 rounded object-cover" />
            <div className="flex-1 truncate text-xs">
              <div className="font-mono">{new URL(it.blobUrl).pathname.split("/").pop()}</div>
              <div className="text-muted-foreground">{it.contentType} · {(it.bytes / 1024).toFixed(1)} KB</div>
            </div>
            <button
              type="button"
              onClick={() => onInsertUrl(it.blobUrl)}
              className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
            >
              Insert
            </button>
            <button
              type="button"
              onClick={async () => {
                const res = await fetch(`/api/me/uploads/${it.id}`, { method: "DELETE" })
                if (res.status === 409) {
                  const body = (await res.json()) as { articles: { slug: string }[] }
                  alert(`In use by: ${body.articles.map((a) => a.slug).join(", ")}`)
                  return
                }
                if (res.status === 204) setItems((xs) => xs.filter((x) => x.id !== it.id))
              }}
              className="rounded border border-border px-2 py-1 text-xs"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

Render it as a sidebar to the editor (use the existing layout grid).

- [ ] **Step 2: Manual smoke + commit**

```bash
git add components/admin/ArticleEditor.tsx
git commit -m "feat(admin): My uploads tab with reference-aware delete"
```

---

## Task 12: Listing UX — Visual pill

**Files:**
- Modify: `actions/content.ts`, `app/learn/page.tsx`, `app/learn/[topicSlug]/page.tsx`

- [ ] **Step 1: Add `hasVisualBlocks` to `getTopics()` / `getArticlesByTopic()` projections**

Find the relevant `prisma.article.findMany` `select` blocks and add `hasVisualBlocks: true`.

- [ ] **Step 2: Render a "Visual" `<Badge>` on each card where the flag is true**

```tsx
// In the topic card render — show the badge if any of the topic's PUBLISHED
// articles has hasVisualBlocks. (Aggregate at the topic level too.)
{article.hasVisualBlocks && (
  <Badge variant="outline" className="ml-2 text-[10px]">Visual</Badge>
)}
```

For `/learn` topic cards, add an aggregate count to the topic projection (`articles: { where: { hasVisualBlocks: true } }`) and badge the topic card when ≥1 visual article exists.

- [ ] **Step 3: Commit**

```bash
git add actions/content.ts app/learn/page.tsx app/learn/\[topicSlug\]/page.tsx
git commit -m "feat(learn): show Visual pill on articles with directives"
```

---

## Task 13: Seed reference SVGs to public/learn/img/

**Files:**
- Create: `public/learn/img/joins-hero.svg`, `joins-step-1.svg`, `joins-step-2.svg`, `joins-step-3.svg`, `joins-hash-vs-nested.svg`.

- [ ] **Step 1: Author the five SVGs**

Use the SVGs from `/tmp/datalearn-learn-v2-preview/index.html` (the brainstorm preview) as references — extract each `<svg>` block, save as a standalone file with `xmlns="http://www.w3.org/2000/svg"`. Keep `viewBox` so they scale.

The brainstorm SVG sources are inline in the preview file. Copy them verbatim and trim to single-file SVG documents.

Each file should be:
- < 50 KB
- Single root `<svg>` with `viewBox`
- Use `hsl(var(--primary))` and similar CSS variables for fills so dark mode just works.

- [ ] **Step 2: Commit**

```bash
git add public/learn/img/*.svg
git commit -m "feat(seed): commit reference SVGs for the JOIN seed lesson"
```

---

## Task 14: Seed lesson

**Files:**
- Create: `prisma/seed-visual-lesson.ts`
- Modify: `package.json`

- [ ] **Step 1: Add the script**

```ts
// prisma/seed-visual-lesson.ts
import { PrismaClient } from "@prisma/client"
import { validateArticleDirectivesSyntactic } from "../lib/admin-validation"

const prisma = new PrismaClient()

const CONTENT = `# How a JOIN works

A SQL JOIN combines rows from two tables based on a related column. The database doesn't loop in your head — it builds a result one row at a time.

## The mental model

:::figure{src="/learn/img/joins-hero.svg" alt="Two tables joined by customer_id"}
orders.customer_id maps to customers.id — three rows on the left, three matches on the right.
:::

What's happening above: every row in \`orders\` tries to find a matching row in \`customers\` where \`customer_id = id\`. When a match is found, the columns from both rows are combined into one output row.

## How the engine evaluates it

:::mermaid{alt="JOIN evaluation flow"}
flowchart LR
  A[Scan orders] --> B{For each row}
  B --> C{Probe customers.id}
  C -->|match| D[Emit joined row]
  C -->|no match| E[Drop or keep NULL]
:::

## Walkthrough — 3 steps

:::steps
1. **Pick the driver table** — the optimizer scans \`orders\` first.
   ![](/learn/img/joins-step-1.svg)
2. **Probe the join column** — for each driver row, look up the matching \`customers.id\`.
   ![](/learn/img/joins-step-2.svg)
3. **Emit the joined row** — concatenate columns from both sides.
   ![](/learn/img/joins-step-3.svg)
:::

## INNER vs LEFT — when each is right

:::side-by-side
### INNER JOIN — drops the lonely

\`\`\`sql
SELECT c.name, o.total FROM customers c
INNER JOIN orders o ON o.customer_id = c.id;
\`\`\`

---

### LEFT JOIN — keeps everyone

\`\`\`sql
SELECT c.name, o.total FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id;
\`\`\`
:::

:::callout{kind="pitfall"}
Putting a filter on the right table of a LEFT JOIN in the \`WHERE\` clause silently turns it back into an INNER JOIN. Move that filter into the \`ON\` clause instead.
:::

## The optimizer's choice

:::figure{src="/learn/img/joins-hash-vs-nested.svg" alt="Hash join vs nested loop comparison"}
Hash join: O(n+m) but needs memory. Nested loop: O(n×m) but works without one.
:::

Once you can picture the driver-probe-emit loop, every JOIN variant — RIGHT, FULL, CROSS, semi/anti — is just a tweak on which rows survive each stage.
`

async function main() {
  const adminEmail = "anchitgupt2012@gmail.com"
  const admin = await prisma.user.findFirst({ where: { email: adminEmail } })
  if (!admin) throw new Error(`seed-visual-lesson: admin user with email ${adminEmail} not found`)

  const topic = await prisma.topic.upsert({
    where: { slug: "joins" },
    create: { name: "Joins", slug: "joins", description: "Combine rows from related tables." },
    update: {},
  })

  // Pre-validate the content syntactically before writing — fails fast.
  const validated = validateArticleDirectivesSyntactic(CONTENT)
  if (!validated.ok) {
    throw new Error(`seed-visual-lesson: invalid content: ${JSON.stringify(validated.errors)}`)
  }

  const slug = "how-a-join-works"
  const existing = await prisma.article.findUnique({ where: { slug } })
  if (existing) {
    await prisma.article.update({
      where: { slug },
      data: {
        title: "How a JOIN works",
        content: CONTENT,
        status: "PUBLISHED",
        topicId: topic.id,
        authorId: admin.id,
        hasVisualBlocks: validated.hasVisualBlocks,
      },
    })
    console.log(`seed-visual-lesson: updated ${slug}`)
  } else {
    await prisma.article.create({
      data: {
        title: "How a JOIN works",
        slug,
        content: CONTENT,
        status: "PUBLISHED",
        topicId: topic.id,
        authorId: admin.id,
        hasVisualBlocks: validated.hasVisualBlocks,
      },
    })
    console.log(`seed-visual-lesson: created ${slug}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Add the script to package.json**

```json
"seed:visual": "tsx prisma/seed-visual-lesson.ts"
```

- [ ] **Step 3: Run it**

```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run seed:visual
```

Expected: `seed-visual-lesson: created how-a-join-works`.

- [ ] **Step 4: Verify in the browser**

```bash
npm run dev &
sleep 4
open http://localhost:3000/learn/joins/how-a-join-works
kill %1
```

Expected: full article renders with all five directives, Mermaid chart visible within ~3s.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed-visual-lesson.ts package.json
git commit -m "feat(seed): How a JOIN works reference lesson with all 5 directives"
```

---

## Task 15: E2E — learn-visual-article

**Files:**
- Create: `tests/e2e/learn-visual-article.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from "@playwright/test"

test.describe("Learn v2 — How a JOIN works", () => {
  test("renders all five directive types", async ({ page }) => {
    await page.goto("/learn/joins/how-a-join-works")
    // Body assertions (per the Next 16 streaming-200 footgun, don't check status).
    await expect(page.getByRole("heading", { name: "How a JOIN works" })).toBeVisible()
    // Figures (2): hero + hash-vs-nested.
    const figures = await page.locator("figure").count()
    expect(figures).toBeGreaterThanOrEqual(2)
    // Mermaid renders an SVG inside dl-mermaid.
    await expect(page.locator(".dl-mermaid svg").first()).toBeVisible({ timeout: 5000 })
    // Steps: 3 numbered cards.
    const stepNums = await page.getByText(/^(1|2|3)$/, { exact: true }).count()
    expect(stepNums).toBeGreaterThanOrEqual(3)
    // Side-by-side: two cards with INNER and LEFT JOIN.
    await expect(page.getByText("INNER JOIN — drops the lonely")).toBeVisible()
    await expect(page.getByText("LEFT JOIN — keeps everyone")).toBeVisible()
    // Callout: pitfall tag visible.
    await expect(page.getByText("Pitfall", { exact: false })).toBeVisible()
  })

  test("404 path renders the not-found body (status may be 200 due to streaming RSC)", async ({ page }) => {
    await page.goto("/learn/joins/does-not-exist")
    await expect(page.getByRole("heading", { name: /not found/i })).toBeVisible()
  })
})
```

- [ ] **Step 2: Run it**

```bash
npx playwright test tests/e2e/learn-visual-article.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/learn-visual-article.spec.ts
git commit -m "test(e2e): seed lesson renders all five directives"
```

---

## Task 16: E2E — Mermaid lazy-load smoke

**Files:**
- Create: `tests/e2e/learn-mermaid-lazy-load.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from "@playwright/test"

test("mermaid chunk loads only on articles that use :::mermaid", async ({ page }) => {
  const mermaidRequests: string[] = []
  page.on("request", (req) => {
    if (req.url().includes("mermaid")) mermaidRequests.push(req.url())
  })

  // Hit a markdown-only article first.
  await page.goto("/learn") // index has no directives
  await page.waitForLoadState("networkidle")
  expect(mermaidRequests.length).toBe(0)

  // Then the seed lesson.
  await page.goto("/learn/joins/how-a-join-works")
  await page.waitForLoadState("networkidle")
  expect(mermaidRequests.length).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run it + commit**

```bash
npx playwright test tests/e2e/learn-mermaid-lazy-load.spec.ts
git add tests/e2e/learn-mermaid-lazy-load.spec.ts
git commit -m "test(e2e): mermaid chunk lazy-loads only when :::mermaid present"
```

---

## Task 17: ROADMAP — v0.5.0 entry

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Add the v0.5.0 section above v0.4.14**

```markdown
### v0.5.0 — Learn v2 visual articles

GitHub Release: <https://github.com/ez-biz/datalearn/releases/tag/v0.5.0>. Long-deferred task #59 ships. Articles can now carry diagrams, walkthroughs, side-by-side comparisons, and callouts through five markdown block directives.

- **Five directives (PR B)** — `:::figure`, `:::mermaid`, `:::steps`, `:::side-by-side`, `:::callout`. Mermaid lazy-loaded, sanitized via DOMPurify, theme-aware via `next-themes`. CSP nonces + directive set on `/learn/**`.
- **Asset infrastructure (PR A)** — `Asset` + `UserAssetQuota` tables, two-phase upload at `/api/me/uploads` with atomic 100 MB quota, admin abuse-delete at `/api/admin/assets` with durable retry, daily GC cron.
- **Publish wiring (PR C)** — `validateArticleDirectivesForPublish()` invoked on every PUBLISHED transition path (admin create, admin PATCH on resulting-state, approve, contributor submit advisory). Foreign Blob URLs and cross-owner assets rejected with no admin override.
- **Editor + listing (PR C)** — `ArticleEditor` insert menu (upload, mermaid, steps, side-by-side, callout) + "My uploads" tab with reference-aware delete. Visual pill on `/learn` and `/learn/[topicSlug]`.
- **Seed (PR C)** — "How a JOIN works" reference lesson at `/learn/joins/how-a-join-works` demonstrates all five directives.

Deferred for v1.5: `:::svg` inline raw SVG, MCP article authoring tools, AI image generation.
```

- [ ] **Step 2: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs(roadmap): v0.5.0 — Learn v2 visual articles"
```

---

## Task 18: DEPLOY.md, mcp-server/README.md

**Files:**
- Modify: `docs/DEPLOY.md`, `mcp-server/README.md`

- [ ] **Step 1: DEPLOY.md — add seed step + day-2 ops note**

Under the seed section:

```markdown
- Seed the v0.5.0 reference lesson on a fresh DB: `npm run seed:visual` (idempotent).
- Backfill `hasVisualBlocks` on existing PUBLISHED articles after deploying the migration: `tsx scripts/backfill-has-visual-blocks.ts`.
```

- [ ] **Step 2: mcp-server/README.md — "Visual articles (preview)" section**

Add at the bottom:

```markdown
## Visual articles (preview)

As of v0.5.0, Data Learn articles support five markdown block directives. **MCP tools to create or update articles are not yet implemented** (tracked as "MCP v2: article authoring tools" in `docs/ROADMAP.md`). When they ship, the `content` argument will accept the directive syntax documented below. Authors today use the admin UI.

### Directive syntax

\`\`\`markdown
:::figure{src="https://store.vercel-storage.com/learn/<owner>/<id>.svg" alt="…"}
Optional caption.
:::

:::mermaid{alt="…"}
flowchart LR
  A --> B
:::

:::steps
1. **Step title** — body
2. **Step title** — body
:::

:::side-by-side
### Left
left body

---

### Right
right body
:::

:::callout{kind="tip|pitfall|note|warning"}
body
:::
\`\`\`

Per-directive constraints (enforced by `validateArticleDirectivesSyntactic` in `lib/admin-validation.ts`):

- `:::figure` requires `src` from the allowlist (`/learn/` or `*.vercel-storage.com`) and a non-empty `alt`.
- `:::mermaid` requires a non-empty `alt`.
- `:::side-by-side` body must contain exactly one `---` thematic break.
- `:::callout` `kind` defaults to `note`; allowed values: `tip`, `pitfall`, `note`, `warning`.
- `:::svg` (inline raw SVG) is deferred to v1.5.
```

- [ ] **Step 3: Commit**

```bash
git add docs/DEPLOY.md mcp-server/README.md
git commit -m "docs: v0.5.0 deploy steps + MCP visual-articles preview section"
```

---

## Task 19: Final integration check + push + open PR

- [ ] **Step 1: Run the full local suite**

```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' \
  npm run test:article-publish-validation && \
  npm run test:article-publish-routes && \
  npm run check:mcp-bundle-isolation && \
  npx playwright test tests/e2e/learn-visual-article.spec.ts && \
  npx playwright test tests/e2e/learn-mermaid-lazy-load.spec.ts && \
  npx playwright test tests/e2e/learn-csp.spec.ts
```

Expected: all PASS.

- [ ] **Step 2: Verify the seed renders in a real browser**

```bash
npm run dev &
sleep 4
open http://localhost:3000/learn/joins/how-a-join-works
sleep 10
kill %1
```

Confirm: hero figure visible, Mermaid chart renders within 3s, 3 numbered step cards, INNER vs LEFT side-by-side, pitfall callout, hash-vs-nested figure. Dark mode toggle works. No CSP errors in DevTools console.

- [ ] **Step 3: Curl smoke (catches nested `<a>` regression per May 19 handoff footgun)**

```bash
curl -s http://localhost:3000/learn | grep -c '<a [^>]*<a' || echo "no nested anchors"
curl -s http://localhost:3000/learn/joins/how-a-join-works | grep -c '<a [^>]*<a' || echo "no nested anchors"
```

Expected: `no nested anchors` on both.

- [ ] **Step 4: Type-check + build**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 5: Push + open PR**

```bash
git push -u origin feat/learn-v2-pr-c-publish-wiring
gh pr create --base main --title "feat: Learn v2 PR C — publish wiring + editor + seed (reveal)" --body "$(cat <<'EOF'
## Summary

Reveal of long-deferred task #59 (Learn v2 ByteByteGo-format support). Builds on PR A (asset infra) and PR B (directive renderer).

- `Article.hasVisualBlocks` denormalized flag with backfill script.
- `validateArticleDirectivesForPublish()` (Layer 2, Prisma-aware, `actions/article-publish-validation.ts`) wired into all four PUBLISHED transition paths (admin create, admin PATCH on resulting-state, approve, contributor submit advisory).
- `ArticleEditor` Insert menu (Upload, Mermaid, Steps, Side-by-side, Callout) + "My uploads" tab with reference-aware delete.
- "Visual" pill on `/learn` topic cards + `/learn/[topicSlug]` article rows.
- Seed lesson "How a JOIN works" at `/learn/joins/how-a-join-works` demonstrating all five directives. SVGs committed to `public/learn/img/`.
- Documentation: ROADMAP v0.5.0 entry, DEPLOY backfill + seed steps, MCP README visual-articles preview section.

Spec: `docs/superpowers/specs/2026-05-20-learn-v2-visual-articles-design.md`.
Plan: `docs/superpowers/plans/2026-05-21-learn-v2-pr-c-publish-wiring-and-reveal.md`.

## Verified

- [x] `npm run test:article-publish-validation` (Layer 1)
- [x] `npm run test:article-publish-routes` (all 4 entry points + PATCH-on-PUBLISHED regression)
- [x] `npm run check:mcp-bundle-isolation` clean (Layer 2 file is server-only)
- [x] `npx playwright test tests/e2e/learn-visual-article.spec.ts`
- [x] `npx playwright test tests/e2e/learn-mermaid-lazy-load.spec.ts`
- [x] `npx playwright test tests/e2e/learn-csp.spec.ts`
- [x] Browser smoke: seed lesson renders with all 5 directives, Mermaid lazy-loads, dark mode works, no CSP console errors.
- [x] Curl: no nested `<a>` regressions on `/learn` or seed lesson.
- [x] `npx tsc --noEmit` + `npm run build` (webpack) clean.

## Not yet verified

- [ ] Production Blob token + cron firing post-deploy
- [ ] Backfill on production DB (run `scripts/backfill-has-visual-blocks.ts` after migration applies)

## Release plan after merge

1. Merge to `main`. Preview deploy confirms.
2. After PR A + PR B + this PR all on main, open release PR `main → production` titled `release: v0.5.0`. Tag + GitHub release after merge.
3. Run `tsx scripts/backfill-has-visual-blocks.ts` against production DB (one-shot).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: Confirm CI green; do NOT auto-merge (feature PR rule).**

---

## Self-review checklist

- Spec sections covered: "Publish-time validation" (Layer 2 + four wiring points + route-level tests including PATCH-on-PUBLISHED), "Admin editor changes" (insert menu + My uploads tab), "Listing UX" (Visual pill + denormalized flag + backfill), "Seed lesson" (idempotent + reference SVGs).
- All four publish entry points wired: admin POST, admin PATCH, approve, contributor submit (advisory).
- Layer 2 lives in `actions/article-publish-validation.ts` (server-only) — does not violate the `lib/admin-validation.ts` Prisma-free contract.
- No new MCP tool ships in v1.
- No `:::svg` directive (deferred).
- E2E asserts body text not HTTP status (Next 16 streaming-200 footgun).
- Curl nested-`<a>` smoke included (May 19 handoff footgun).
- Backfill script + seed script are both idempotent.
