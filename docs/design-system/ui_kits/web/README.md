# Data Learn — Web UI kit

Hi-fi recreation of the Data Learn web app, mirroring the structure of `datalearn/` (Next.js + Tailwind v4).

## Files

| File | What it is |
|---|---|
| `index.html` | Click-thru entry point with screen-tabs (Home → Practice list → Workspace → Learn) |
| `Primitives.jsx` | `Logo`, `Button`, `DifficultyPill`, `Tag`, `Card`, `Eyebrow`, `H1`/`H2`, `Lede`, `Kbd` |
| `Layout.jsx` | `Navbar` (sticky, blurred), `Footer` |
| `Home.jsx` | `HeroSection` (gradient halo + grid mask), `EditorPreviewCard`, `FeaturedProblems` |
| `Practice.jsx` | `ProblemPane` (description / schema / hints / history tabs), `WorkspacePane` (Monaco-style editor + result tabs), `CodeEditor`, `ResultTable`, `Verdict` |
| `Learn.jsx` | `LearnHub` (topic grid + article list) |

## Screens covered

1. **Home** — marketing hero with editor preview and featured problems
2. **Practice list** — filterable problem table with difficulty pills
3. **Problem workspace** — two-pane layout matching `app/practice/[slug]`
4. **Learn hub** — topic cards + article list

## What this kit is not

- Not real Next.js code; cosmetic React only.
- DuckDB-WASM execution is faked with a 700ms delay.
- Code editor is read-only highlighted text, not Monaco.

## Source map

Components are intentionally named to match `datalearn/` paths so designers can cross-reference:

- `Logo` ↔ `components/ui/Logo.tsx`
- `Button`/`Tag`/`DifficultyPill` ↔ `components/ui/`
- `Navbar`/`Footer` ↔ `components/layout/`
- `HeroSection`/`FeaturedProblems` ↔ `components/home/`
- `ProblemPane`/`WorkspacePane`/`ResultTable`/`Verdict` ↔ `components/practice/` + `components/sql/`
