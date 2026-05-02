---
name: data-learn-design
description: Use this skill to generate well-branded interfaces and assets for Data Learn (a LeetCode-style SQL practice + learning platform), either for production or throwaway prototypes / mocks / decks. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping in the Data·Learn brand.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy
assets out and create static HTML files for the user to view. The fastest path:

1. `@import` `colors_and_type.css` to inherit every color, radius, shadow, and
   typography token (including `.h1`, `.lede`, `.eyebrow`, `.code`, `.kbd`).
2. Pull `assets/logo.svg` or `assets/logo-wordmark.svg` for any branded chrome.
3. Load Lucide from CDN (`<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js">`)
   and call `lucide.createIcons()` after render — never invent SVG icons.
4. Compose UI from `ui_kits/web/*.jsx` components (Button, Card, DifficultyPill,
   Navbar, Footer, ProblemPane, WorkspacePane, Verdict, ResultTable, etc.).

If working on production code (the `datalearn/` Next.js app), read the rules in
README.md to become an expert in designing with this brand — copy is direct
sentence-case, no emoji, em dashes welcome, "you" not "we", no exclamation
marks; visuals are flat surfaces with restrained shadow, brand-green primary,
amber accent, JetBrains Mono for anything data-shaped, Lucide icons only.

If the user invokes this skill without any other guidance, ask them what they
want to build or design (a slide, a marketing page, a new in-product screen,
a deck for a talk?), ask a few clarifying questions about audience and scope,
and act as an expert designer who outputs HTML artifacts _or_ production code,
depending on the need.
