# Article Reader — reading-experience spec

> **Captured:** 2026-06-15 · **Inspiration:** datavidhya.com Learn articles (e.g. `/learn/ai-for-data-engineering/ai-foundations/ai-de-landscape/`), rendered + measured via Chrome DevTools.
> **Goal:** make Data Learn's Learn articles read as calm/premium as the reference. We already share the foundation — **Inter + JetBrains Mono via `next/font`** and **`@tailwindcss/typography`** (their article is literally `prose prose-neutral`), so this is mostly token tuning + a sticky TOC, not a rebuild.

## The core insight — why the reference reads well

A deliberately **low-harshness** stack:
- **Body text weight 500 (medium), not 400.**
- **Soft slate body color** (`#454F5B`), not near-black.
- **Off-white page background** (`#FAFAFA`), not pure white.
- **Generous 1.75 line-height**, comfortable 20px paragraph spacing.
- **Tight heading tracking** (-0.025em) at semibold (600), with large top margins on H2 for clear section breaks.

That blend is the "feel." Replicating it is the single highest-impact, lowest-effort change.

## Measured type scale → Data Learn `prose` overrides

| Element | Reference (measured) | Data Learn target |
|---|---|---|
| Body | Inter 16px / **1.75** (28px), **weight 500**, `#454F5B`, mb 20px | prose body → `font-medium`, `line-height: 1.75`, body color a step softer than `--foreground` |
| Page bg | `#FAFAFA` off-white | article surface slightly off pure-white (light) |
| H1 | ~40px / 1.25, **600**, tracking **-0.025em**, mb 16px | `text-4xl font-semibold tracking-tight` |
| H2 | 20px / 1.33, 600, tracking -0.025em, **mt 36px** / mb 24px | large top margin = section breaks |
| H3 | 16px / 1.6, 600, mt 32px / mb 16px | `text-base font-semibold` |
| Links | `#0050FF`, **no underline**, weight 500 | map to `--primary`; underline on hover only |
| Inline code | JetBrains Mono **0.85em**, bg gray @50% alpha, **padding 2px 6px, radius 6px** | pill background + padding on `:not(pre) > code` |
| Measure | content column **~848px (~90ch)** — wide/airy | **tighten to ~720–780px (~75ch)** for readability, or match for the exact look |

All colors must go through Data Learn HSL tokens in `app/globals.css` (light + dark), never hardcoded hex — the reference values above are targets to translate.

## Layout — three columns

- **Left rail (sticky):** curriculum nav for the Track (nested modules, lock icons on premium/locked lessons, search, social links pinned to bottom). Maps to **Tracks (V9)** — turns a Track into a "course" reading shell.
- **Center:** the article, constrained + centered. Under the H1: a **meta row** — clock + "N min read" · level/difficulty pill · "N completed" avatars · ★ rating. Optional **"Listen to this article" (AI narration)** card.
- **Right rail (sticky):** **"On This Page" TOC with active-section highlight** (current heading tracked on scroll via IntersectionObserver) + **reading-progress %** and a thin top progress bar. Premium CTA card above it.

## Loading polish (the "app-like" feel)

Next.js client-side routing: clicking a lesson swaps the article **instantly, no full reload**.
- Route-group **`loading.tsx`** skeletons for the article shell (title, meta, paragraph lines, TOC).
- **`<Suspense>`** streaming for slower below-the-fold content.
- **`<Link prefetch>`** on the curriculum nav so adjacent lessons are warm.
- Thin **top reading-progress bar**; optimized `next/font` (already in place).

## What we already have vs. gaps

**Shipped** (Learn CMS v1 + v0.5.0 visual articles): TOC, prev/next, reading-time, and directive blocks — `figure`, `mermaid`, `steps`, `side-by-side`, **`callout`**.

**Gaps to build (priority order):**
1. **Typography tuning** (table above) — start here; highest impact, lowest effort.
2. **Right-rail sticky TOC** with active-section + reading-progress %.
3. **Left curriculum rail** for Track reading shell (V9).
4. New inline blocks: **Quick Check** (inline MCQ), **Try This** (exercise), **Key Takeaways** box, **interview-tier** guidance.
5. **`loading.tsx`** skeletons + nav prefetch.

## Phasing
- **Phase 1 (this pass):** typography tuning in `app/globals.css` prose tokens + sticky TOC-with-progress in the article reader. No schema changes.
- **Phase 2:** left curriculum rail tied to Tracks (V9); `loading.tsx` skeletons.
- **Phase 3:** new directive blocks (Quick Check / Try This / Key Takeaways / interview-tier) — extend the directive renderer + its tests.
