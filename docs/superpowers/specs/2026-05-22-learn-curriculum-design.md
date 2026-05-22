# Learn — Curriculum v1 (lanes, spine, MCP wiring, author rules)

> **Status:** design approved by user. Awaits implementation plan via writing-plans skill.
> **Date:** 2026-05-22
> **Builds on:** `docs/superpowers/specs/2026-05-20-learn-v2-visual-articles-design.md` (Learn v2 renderer & data model — shipped as v0.5.0).

## Goal

Define the curriculum the platform commits to in v1: which **topics**, in what **order**, in what **lanes**, with what **per-article shape**, surfaced via the **existing** Article ↔ Tag ↔ SQLProblem relations, with MCP author tools that make it cheap to author the missing articles without falling into the figure-404 / asset-not-found footguns that bit v0.5.0.

The spec is a curriculum strategy + the small infrastructure changes (Topic schema additions, MCP tool additions, author prompt updates) that make it executable. Article-by-article content drafting is a follow-on cycle.

## Non-goals

- WYSIWYG editor changes. The existing admin editor + MCP author tools are sufficient.
- Tracks integration. Tracks stay problem-only (no schema change, no `TrackItem.type` discriminator). Bridges between articles and tracks are footer links, not data.
- New visual directives. The five `:::figure / :::mermaid / :::steps / :::side-by-side / :::callout` from Learn v2 are the full set.
- AI image generation. Author or human-curator-uploaded assets only.
- Per-topic article extensions (intro / mechanics / advanced split). v1 is spine-first: 1 pillar article per SQL topic; DE-lane topics keep their existing multi-article shape.
- Prerequisite gating. The lane order is a recommendation, not enforced.
- Tool-specific articles (Spark, dbt, Airflow, Kafka, Snowflake, BigQuery). All v1 content is evergreen and tool-agnostic.
- Concept-tag `TagKind`. Concept tags reuse the existing `TagKind.TOPIC` value. No new enum variant.

## Decisions

| Question | Decision |
|---|---|
| Audience | Mixed: interview prep + career switcher. Practicing-engineer-brush-up is a future `/learn/advanced` lane. |
| Scope | Tool-agnostic SQL + Data Engineering concepts. Evergreen content only. |
| Structure | **Two lanes**: `SQL` (granular, 1 topic per feature family) and `DATA_ENGINEERING` (broad, 1 topic per theme cluster). |
| v1 volume | **Spine-first.** ~10 topics × ~1 pillar article each. Existing multi-article topics keep their articles. |
| Per-article format | Visual-first (≥1 `:::figure` or `:::mermaid`). 1200–3000 words baseline, up to ~4000 for deep topics. |
| Article ↔ problem linkage | SQL-lane articles **must** link ≥3 `relatedProblemSlugs` and ≥3 `tagSlugs`. DE-lane optional. |
| Topic ordering | New columns `Topic.lane` and `Topic.displayOrder`. `/learn` sorts by `(lane, displayOrder)`. |
| Tag taxonomy | Concept tags use `TagKind.TOPIC`. Company tags stay `TagKind.COMPANY`. No new kind. |
| Tracks | Unchanged. Problem-only, separate UX at `/learn/tracks`. |

## Lanes and topic spine

### SQL lane (6 topics)

| # | Slug | Pillar article (working title) | Current state |
|---|---|---|---|
| 1 | `sql-foundations` | "SELECT, WHERE, ORDER BY — the four-line query mental model" | new topic + new article |
| 2 | `joins` | "How a JOIN works" | live (1 article, seed-quality) — refresh to new skeleton |
| 3 | `aggregations` | "GROUP BY, HAVING, and the silent NULL trap" | new topic + new article |
| 4 | `ctes-and-subqueries` | "CTEs vs subqueries — when each wins (and recursive CTEs)" | new topic + new article |
| 5 | `window-functions` | "Your First Look at Window Functions" | live (1 article — broken figure swapped out by user 2026-05-22; mermaid blocks render once v0.5.0.1 CSP hotfix ships; full refresh under this curriculum) |
| 6 | `query-performance` | "EXPLAIN, indexes, and when to denormalize" | new topic + new article |

### Data Engineering lane (4 topics)

| # | Slug | Pillar article (working title) | Current state |
|---|---|---|---|
| 7 | `data-engineering-101` | (existing: OLTP vs OLAP, ETL, Batch vs Stream) | live (3 articles) — refresh each to new skeleton |
| 8 | `storage-and-modeling` | "Star schemas, partitioning, and the file formats that make them fast" | new topic + new article |
| 9 | `pipelines-and-movement` | "Orchestration, dependencies, and CDC without the tools" | new topic + new article |
| 10 | `data-quality` | "Idempotency, SCD, and how to know your pipeline is honest" | new topic + new article |

### Total v1 authoring work

- **7 new pillar articles** (sql-foundations, aggregations, ctes-and-subqueries, query-performance, storage-and-modeling, pipelines-and-movement, data-quality).
- **5 existing articles refreshed** to the new pillar-article skeleton (joins/how-a-join-works; window-functions/first-look-at-window-functions; data-engineering-101/{oltp-vs-olap, what-is-etl, batch-vs-stream-processing}).
- **12 articles touched** at end of v1.

### Topic ordering

Each topic gets a `displayOrder` int. `/learn` index queries `prisma.topic.findMany({ orderBy: [{ lane: "asc" }, { displayOrder: "asc" }] })` and renders two columns. The numbering in the tables above is the initial `displayOrder` value.

## Per-article skeleton

Mandatory blocks in order:

1. `# Title` — short, descriptive. SQL-lane titles use feature names; DE-lane titles use "X vs Y" or "X without the tools" pattern.
2. **TL;DR** — 2–3 sentence summary of what the learner will be able to do.
3. **Mental model** — one `:::figure` or `:::mermaid` block at the top, followed by 1–2 paragraphs of plain-language framing. Caption explains the diagram in one line.
4. **Mechanics** — multiple `## H2` sub-sections. Each sub-section gets its own diagram and worked example. This is the bulk of the article. (Example: Window Functions splits into OVER · PARTITION BY · ORDER BY · frame clauses · ranking functions · aggregate-as-window.)
5. **Worked example end-to-end** — a single realistic scenario that exercises the mechanics in sequence. Schema → questions → queries → answers. Tables: `orders`, `customers`, `events`, never `foo/bar`. 3–5 example rows per table.
6. **Pitfalls** — 4–8 `:::callout` blocks, one per common mistake. (Use `:::callout{kind="warning"}` or `:::callout{kind="info"}`.)
7. **When NOT to use this / alternatives** — short. (Example: "Use GROUP BY instead of a window when…").
8. **Practice prompts** — SQL lane: link 3–5 problems via `Article.relatedProblems`. Renders as `<RelatedProblemsPanel/>` at article bottom (already shipped). DE lane: optional.
9. **One-paragraph recap.**
10. **Further reading** (optional) — internal Learn cross-links + canonical external docs (Postgres, DuckDB, mode.com analytics tutorials). External links must be authoritative.

### Length

- Baseline: **1200–3000 words**.
- Deep topics (window-functions, joins, query-performance, storage-and-modeling): up to **~4000 words**.
- Operating principle: **depth over brevity**. Trim adverbs and filler, never trim coverage.

### Visual minimum

Every article ≥ 1 `:::figure` or `:::mermaid` block. The existing `hasVisualBlocks` boolean is recomputed at publish time; we make it **mandatory for publish** for any article authored or refreshed under this curriculum (existing pre-curriculum articles that happen to be prose-only stay published).

### Page-side UX

- Right-sidebar TOC enabled via `MarkdownRenderer withHeadingIds={true}` (already supported, already on for `/learn/[topic]/[article]`). Verify scaling to ~10 H2s.
- Tags render as chips above the title (`article.tags` projection already in route handler; UI already renders).
- `<RelatedProblemsPanel/>` at the bottom (already shipped).

## Taxonomy: Topic vs Tag vs Track

| Concept | Job | Cardinality |
|---|---|---|
| **Topic** | Curriculum bucket + URL space (`/learn/[topicSlug]`). One lane, one displayOrder. | 1 article → 1 topic |
| **Tag** | Cross-cutting concept marker; M-M with Article and SQLProblem | many-to-many, both directions |
| **Track** | Curated problem path (existing, unchanged) | problems only |
| **Article.relatedProblems** | Explicit, hand-picked article-to-problem links (M-M) | already exists, already snapshotted in ArticleVersion |

### Schema migration

```prisma
model Topic {
  id           String    @id @default(cuid())
  name         String    @unique
  slug         String    @unique
  description  String?
  lane         TopicLane @default(SQL)
  displayOrder Int       @default(0)
  articles     Article[]
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([lane, displayOrder])
}

enum TopicLane {
  SQL
  DATA_ENGINEERING
}
```

Backfill in the same migration:
- `joins`, `window-functions`, `sql-foundations`, `aggregations`, `ctes-and-subqueries`, `query-performance` → `lane = SQL`, displayOrder = 1..6.
- `data-engineering-101`, `storage-and-modeling`, `pipelines-and-movement`, `data-quality` → `lane = DATA_ENGINEERING`, displayOrder = 7..10.

If `data-engineering-101` or other topic rows don't exist yet, the seed script (`scripts/seed-curriculum-topics.ts`) creates them as part of the curriculum rollout.

### Concept tag seed

A one-shot idempotent script (`scripts/seed-curriculum-tags.ts`) creates the following `TagKind.TOPIC` tags if missing. These are the curated concept-level tags for cross-cutting linkage in v1:

- **SQL concepts:** `inner-join`, `left-join`, `anti-join`, `semi-join`, `group-by`, `having`, `partition-by`, `frame-clause`, `ranking-functions`, `recursive-cte`, `correlated-subquery`, `explain-plan`, `index-usage`, `null-handling`
- **DE concepts:** `dimensional-modeling`, `star-schema`, `scd-type-2`, `cdc`, `idempotency`, `partitioning`, `parquet`, `oltp`, `olap`, `etl`, `elt`, `stream-processing`, `orchestration`, `data-quality`

(~28 tags. Tag.slug is the kebab-case form; Tag.name is the human-readable form, e.g., "Partition By".)

Article authoring uses these slugs in `tagSlugs[]`. Existing problems can be retro-tagged in a follow-on pass (out of scope for this spec).

## MCP changes

### Already shipped (no work)

- `Article.tags` M-M; `create_article` / `update_article` accept `tagSlugs[]` (≤10), admin API validates slugs exist, `ArticleVersion.tagSlugs` snapshot.
- `Article.relatedProblems` M-M; `create_article` / `update_article` accept `relatedProblemSlugs[]` (≤20), admin API validates slugs exist, `ArticleVersion.relatedProblemSlugs` snapshot.
- `<RelatedProblemsPanel/>` and tag chip rendering on `/learn/[topic]/[article]`.
- Discovery tools: `list_topics`, `list_tags`, `list_problems`, `list_articles`, `get_article`, `get_problem` all exist.
- `create_topic`, `create_tag` exist.

### New work

1. **Topic schema migration** (above).
2. **`create_topic` extended** with `lane: "SQL" | "DATA_ENGINEERING"` (optional, default `SQL`) and `displayOrder: number` (optional, default 0).
3. **`list_topics` projection extended** to include `lane`, `displayOrder`. Sort by `(lane ASC, displayOrder ASC)` by default.
4. **`update_topic` — new MCP tool.** PATCH semantics. Inputs: `slug` (required), `newSlug`, `name`, `description`, `lane`, `displayOrder` (all optional). Calls a new `PATCH /api/admin/topics/[slug]` route (new admin API endpoint).
5. **`/learn` index page** updates to query with the new ordering and render two lane columns.

### Optional, deferred to v1.1

- `suggest_relations(articleSlug)` MCP tool that returns candidate tag and problem slugs based on content (lexical match on the article body against tag names + problem titles). Not in v1; the LLM can run `list_tags` + `list_problems(tagSlug: …)` itself.

## Author prompt update

File: `docs/superpowers/prompts/learn-v2-article-author.md`. Diff intent (full text rewrite happens during implementation):

1. **Forbid LLM-generated `/learn/img/*` paths.** Causes of the v0.5.0 figure-404 incident:
   - The author LLM invents a `/learn/img/<slug>.svg` path that doesn't exist on disk.
   - Layer 2 publish validator currently skips existence checks for `/learn/**` paths.
   The prompt MUST instruct: every figure block authored by an LLM uses either (a) a `:::mermaid` block (preferred, renders client-side, no asset), or (b) an inline `[FIGURE-TODO: <description>]` placeholder that the human editor swaps for an `https://*.vercel-storage.com/...` URL before publishing. The LLM never writes a `/learn/img/...` src.
2. **Diagram-first reflex.** Every major H2 sub-section must lead with a `:::mermaid` (preferred) or `[FIGURE-TODO: …]` placeholder, not prose. If a paragraph describes structure, replace it with a diagram.
3. **Mandate use of tags + related problems for SQL-lane drafts.** Before drafting, the LLM calls `list_tags(kind: "TOPIC")` and `list_problems(tagSlug: <relevant>)` to discover what's available. The `create_article` call must include `tagSlugs[]` (≥3 entries) and `relatedProblemSlugs[]` (≥3 entries for SQL-lane articles).
4. **Per-article checklist enforced in the prompt:**
   - Title matches `# <Title>` H1 in content.
   - One TL;DR paragraph.
   - One `:::figure` or `:::mermaid` above the fold.
   - ≥4 H2 sub-sections in the mechanics block.
   - ≥4 `:::callout` pitfalls.
   - "When NOT to use" section present.
   - Worked example with realistic table names.
   - 1200–3000 words (4000 ceiling for deep topics).
   - SQL lane: `tagSlugs[]` ≥3, `relatedProblemSlugs[]` ≥3.
5. **Updated output contract.** The LLM's response is the `create_article` MCP call (or a `update_article` call when refreshing), not a markdown blob pasted into the admin UI. (This is the v0.5.1 reality; the current prompt still describes the old paste-into-UI flow.)

## Paired infrastructure fix (v0.5.0.2)

Independent of the curriculum content work but motivated by it:

**Tighten `actions/article-publish-validation.ts`** to verify `/learn/**` figure src paths exist on disk. Today the validator filters out `/learn/**` paths entirely from the Asset existence check, on the assumption that they are repo-committed static files. The author LLM exploited the loophole by inventing paths. Fix:

```ts
const localPaths = syntactic.figureUrls.filter((url) =>
  url.startsWith("/learn/")
)
for (const localPath of localPaths) {
  const onDisk = path.join(process.cwd(), "public", localPath)
  try {
    await fs.access(onDisk, fs.constants.R_OK)
  } catch {
    errors.push({
      directive: "figure",
      index: -1,
      message: `figure src "${localPath}" does not exist in public/`,
    })
  }
}
```

This makes the "no `/learn/img/*` in LLM output" prompt rule a defense-in-depth measure rather than the only safeguard.

## Done criteria (gate)

- [ ] Migration `add_topic_lane_and_display_order.sql` applied locally and in CI; backfill SQL also in the migration.
- [ ] `scripts/seed-curriculum-topics.ts` creates the 6 missing SQL-lane topic rows.
- [ ] `scripts/seed-curriculum-tags.ts` creates the ~28 concept tags (idempotent).
- [ ] MCP `create_topic` accepts `lane` + `displayOrder`. `list_topics` returns them. `update_topic` exists. Admin API has `PATCH /api/admin/topics/[slug]`.
- [ ] `/learn` index renders two ordered lane columns. Pixel-check via Vercel preview.
- [ ] `docs/superpowers/prompts/learn-v2-article-author.md` updated per the rules above. PR description shows the diff.
- [ ] `actions/article-publish-validation.ts` rejects `/learn/**` figure src whose file does not exist on disk. Test added to `scripts/test-article-publish-validation.ts`.
- [ ] **12 articles touched** (7 new + 5 refreshed). Each one:
  - Passes Layer 2 publish validation.
  - Has `hasVisualBlocks = true`.
  - Renders without console errors on Vercel preview.
  - SQL-lane: ≥3 `tagSlugs`, ≥3 `relatedProblemSlugs`.
- [ ] Browser smoke on prod: 10 topic pages + 12 articles render, mermaid renders, tags + related problems visible.
- [ ] PR(s) labelled `curriculum-v1` for cross-PR tracking.

## Success metrics (post-ship, non-gating)

- `/learn` → `/practice` click-through rate via `<RelatedProblemsPanel/>` (instrument once the v0.5.0.1 analytics CSP hotfix lands).
- Per-article scroll-depth / completion (existing Vercel Analytics).
- Tag-chip click distribution — informs which tags get the most engagement; drives v2 deepening decisions.
- Ratio of MCP-authored vs. hand-authored articles in the 90 days after the prompt update. Target: ≥80% of new articles MCP-authored.

## Out of scope for curriculum v1

- Per-topic article extensions (intro / mechanics / advanced split). Future v2 work, driven by engagement data.
- Tracks ↔ Articles bridge UX. Footer "Continue with the X Track" auto-suggest stays manual / out-of-scope.
- Article authoring WYSIWYG.
- Prerequisite gating between topics.
- Tool-specific content.
- Practice-problem retro-tagging (separate cycle).

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| LLM-authored articles all start to "sound the same" (template fatigue) | Author prompt explicitly varies opening hooks (question, surprising claim, scenario) and rotates worked-example domains (orders, events, sessions, ledgers). |
| The 7 new articles take longer than planned | Spine-first is the mitigation. Ship topics in order; each merged article is a complete unit. |
| Tag explosion (LLMs invent new slugs) | Admin API already validates that every `tagSlug` references an existing Tag. Slug invention fails publish. |
| `lane`/`displayOrder` schema migration breaks the `/learn` route in prod | Backfill the columns in the same migration; default values cover any post-migration row. |
| Refreshing the 5 existing articles silently breaks bookmarks | Slugs do not change in the refresh pass. URLs are preserved. |
| LLM keeps writing `/learn/img/*` paths despite the prompt update | Layer 2 validator existence-check (v0.5.0.2) rejects publish. Belt-and-suspenders. |

## Open questions

None at spec-approval time. Implementation may surface follow-ups; they go into the implementation plan, not this spec.

## References

- Learn v2 visual articles design: `docs/superpowers/specs/2026-05-20-learn-v2-visual-articles-design.md`
- Learn v2 launch handoff: `docs/superpowers/handoff/2026-05-21-learn-v2-launch-handoff.md`
- Current article authoring prompt (to be rewritten): `docs/superpowers/prompts/learn-v2-article-author.md`
- MCP article tools: `mcp-server/src/tools/articles.ts`
- Admin article API: `app/api/admin/articles/route.ts` and `app/api/admin/articles/[slug]/route.ts`
- Layer 2 publish validator (paired v0.5.0.2 fix target): `actions/article-publish-validation.ts`
