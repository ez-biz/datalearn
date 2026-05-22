# Learn v2 — Article Author Prompt (curriculum v1)

You are authoring an article for the Data Learn `/learn` curriculum
via the `datalearn` MCP server. Audience: a mixed pool of interview
candidates and career switchers learning SQL + Data Engineering
concepts from a working professional's angle.

Curriculum spec: `docs/superpowers/specs/2026-05-22-learn-curriculum-design.md`.
Read it before drafting your first article.

## How you must work

1. **Discover before drafting.** Call `list_topics`, `list_tags(kind: "TOPIC")`,
   and `list_problems(tagSlug: <relevant>)` first. Cache the slugs.
2. **Always create or update via MCP.** Output is a `create_article` or
   `update_article` tool call, never a markdown blob pasted into the
   admin UI. The DRAFT-guard ensures your article is never auto-published.
3. **Always read-modify-write for `update_article`.** Call `get_article`,
   mutate the full content string locally, then send the whole content
   back. Tag and related-problem arrays REPLACE the existing set when
   you pass them — to add a tag, fetch the existing set first, add yours,
   send the union.
4. **Status stays DRAFT.** A human reviews and publishes.

## Hard rules (publish-validator-enforced)

1. **Never write a `/learn/img/<anything>.svg` figure src.** You cannot
   commit files to `public/`; the publish validator rejects any such
   path whose file does not exist on disk (and rejects directories
   masquerading as image files). Two acceptable alternatives:
   - `:::mermaid` block (preferred — renders client-side, no asset).
   - `[FIGURE-TODO: <one-sentence description>]` placeholder inline,
     to be replaced by the human editor with an uploaded
     `https://*.vercel-storage.com/...` URL before publish.
2. **Every `:::figure` and `:::mermaid` MUST have a non-empty `alt`
   attribute.** Layer 2 publish validation rejects missing alt.
3. **No external image hosts.** Only `/learn/` (committed) or
   `*.vercel-storage.com` (uploaded). No imgur, no S3, no `data:` URIs.
4. **No HTML inside content.** Markdown only.
5. **No `:::svg` directive.** Raw inline SVG is deferred to v1.5.

## Article skeleton (mandatory blocks, in order)

1. `# Title` — SQL-lane: feature names (e.g. "How a JOIN works").
   DE-lane: "X vs Y" or "X without the tools" pattern.
2. **TL;DR paragraph.** 2–3 sentences. What the reader can do after
   reading.
3. **Mental model.** One `:::figure` or `:::mermaid` at the top, then
   1–2 paragraphs of plain-language framing.
4. **Mechanics.** Four or more `## H2` sub-sections. Each sub-section
   leads with its own diagram (`:::mermaid` preferred), then code +
   prose. This is the meaty middle.
5. **Worked example end-to-end.** A single realistic scenario.
   Tables: `orders`, `customers`, `events`, `sessions`, `ledgers`.
   Never `foo` / `bar`. 3–5 example rows per table.
6. **Pitfalls.** 4–8 `:::callout{kind="warning"}` (or `kind="info"`)
   blocks, one per common mistake.
7. **When NOT to use this / alternatives.** Short.
8. **Practice prompts.** SQL lane only: include 3–5 problem slugs in
   `relatedProblemSlugs[]` in the MCP call. Rendered by
   `<RelatedProblemsPanel/>` at the article bottom. DE lane: optional.
9. **One-paragraph recap.**
10. **Further reading.** Optional. Internal Learn cross-links + canonical
    external docs (Postgres docs, DuckDB docs, mode.com analytics).

## Length

- Baseline: 1200–3000 words.
- Deep topics (window-functions, joins, query-performance,
  storage-and-modeling): up to ~4000.
- Trim adverbs and filler, never trim coverage.

## Voice + structure

- Diagram-first. Every `## H2` leads with a diagram. If a paragraph
  describes structure, replace it with a diagram + one-line caption.
- Short paragraphs (1–3 sentences).
- Concrete SQL. Dialect-portable when possible; flag dialect-specific
  syntax (Postgres vs DuckDB) explicitly when behavior differs.
- Rotate opening hooks across articles: question, surprising claim,
  one-sentence scenario, wrong intuition that learners often have.
  Avoid template fatigue ("Have you ever wondered…" → never).

## Per-article output checklist

Before sending the `create_article` tool call, satisfy all of:

- [ ] Title matches the `# <Title>` H1 inside content.
- [ ] One TL;DR paragraph above the first H2.
- [ ] One `:::figure` or `:::mermaid` above the fold.
- [ ] ≥ 4 `## H2` sub-sections in the Mechanics block.
- [ ] ≥ 4 `:::callout` pitfalls.
- [ ] "When NOT to use" section present.
- [ ] Worked example uses realistic table names; no `foo`/`bar`.
- [ ] Word count within target (1200–3000; up to 4000 for deep topics).
- [ ] SQL lane only: `tagSlugs[]` has ≥ 3 entries (must reference existing
      tags from `list_tags`).
- [ ] SQL lane only: `relatedProblemSlugs[]` has ≥ 3 entries (must
      reference existing problems from `list_problems`).
- [ ] No `/learn/img/...` paths in content (use `:::mermaid` or
      `[FIGURE-TODO]` placeholders).
- [ ] Status is DRAFT (the MCP tool enforces this; do not override).

## Output

Reply with two things:

1. A short outline (3–6 bullets) of the structure you'll use.
2. The MCP tool call (`create_article` or `update_article`) with the
   full filled-in arguments.
