# Learn v2 — PR B: Directive Renderer + CSP

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the markdown directive renderer for five visual block types (`:::figure`, `:::mermaid`, `:::steps`, `:::side-by-side`, `:::callout`), plus the Mermaid sanitization pipeline and Content-Security-Policy middleware on `/learn/**`. Ships **dark**: legacy articles render identically, no article uses the new directives yet.

**Architecture:** Single PR off `main` (branch `feat/learn-v2-pr-b-directive-renderer`). Adds `remark-directive` to the existing `react-markdown` pipeline plus six React components. Mermaid lazy-loads on the client and sanitizes its output through DOMPurify before insertion. New CSP middleware injects nonces only on `/learn/**` paths so other routes are unperturbed. Adds the Prisma-free Layer 1 validator to `lib/admin-validation.ts` (preserves the MCP-importable contract); Layer 2 (Prisma-aware) lives in PR C, so this PR doesn't import it.

**Tech Stack:** Next.js 16 middleware + App Router, `react-markdown` (existing), `remark-directive` (new), `mermaid` v11 (new, lazy-loaded), `isomorphic-dompurify` (new), `next-themes` (existing).

**References:**
- Spec: `docs/superpowers/specs/2026-05-20-learn-v2-visual-articles-design.md`
  - "Directives" — exact syntax + attribute rules for each of the five.
  - "Renderer architecture" — component layout + sanitization.
  - "Content-Security-Policy (new in v1)" — directive set + nonce wiring.
  - "Publish-time validation" / Layer 1 — what `validateArticleDirectivesSyntactic` checks.
- Release version: **v0.4.14**.

---

## File map

**Create:**
- `components/markdown/directives/Figure.tsx`
- `components/markdown/directives/MermaidClient.tsx` (`"use client"`)
- `components/markdown/directives/Mermaid.tsx` (server, dynamic-imports `MermaidClient`)
- `components/markdown/directives/Steps.tsx`
- `components/markdown/directives/SideBySide.tsx`
- `components/markdown/directives/Callout.tsx`
- `lib/markdown/remark-block-directives.ts`
- `scripts/test-directive-renderer.ts`
- `scripts/test-mermaid-sanitization.ts`
- `scripts/test-article-publish-validation.ts`
- `scripts/check-mcp-bundle-isolation.ts`
- `tests/e2e/learn-csp.spec.ts`

**Modify:**
- `components/markdown/MarkdownRenderer.tsx` — wire `remark-directive` + the new component map.
- `lib/admin-validation.ts` — add Layer 1 (`validateArticleDirectivesSyntactic`). Stays Prisma-free.
- `middleware.ts` — inject CSP header on `/learn/**`.
- `next.config.ts` — add `*.vercel-storage.com` to `images.remotePatterns`.
- `package.json` — add deps + test scripts.

---

## Task 1: Worktree + branch setup

**Files:** none (git state)

- [ ] **Step 1: Create the worktree off main**

```bash
cd /Users/anchitgupta/Documents/Github/datalearn
git fetch origin main
git worktree add ../datalearn-pr-b -b feat/learn-v2-pr-b-directive-renderer origin/main
cd ../datalearn-pr-b
npm install
```

- [ ] **Step 2: Confirm clean tree**

```bash
git status && git log --oneline -1
```

Expected: branch is `feat/learn-v2-pr-b-directive-renderer`, HEAD matches `origin/main`.

---

## Task 2: Install renderer deps

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
npm install remark-directive mermaid@^11 isomorphic-dompurify
```

- [ ] **Step 2: Add test scripts under `scripts`**

```json
"test:directive-renderer": "tsx scripts/test-directive-renderer.ts",
"test:mermaid-sanitization": "tsx scripts/test-mermaid-sanitization.ts",
"test:article-publish-validation": "tsx scripts/test-article-publish-validation.ts",
"check:mcp-bundle-isolation": "tsx scripts/check-mcp-bundle-isolation.ts",
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): remark-directive, mermaid, isomorphic-dompurify"
```

---

## Task 3: `remark-block-directives` plugin

**Files:**
- Create: `lib/markdown/remark-block-directives.ts`

**What it does:** `remark-directive` emits `containerDirective` / `leafDirective` AST nodes. This plugin walks them and rewrites `data.hName` + `data.hProperties` so `react-markdown`'s `components` prop can dispatch to our React components by tag name.

- [ ] **Step 1: Implement**

```ts
// lib/markdown/remark-block-directives.ts
import type { Plugin } from "unified"
import type { Root } from "mdast"
import { visit } from "unist-util-visit"

const DIRECTIVE_TAG: Record<string, string> = {
  figure: "dl-figure",
  mermaid: "dl-mermaid",
  steps: "dl-steps",
  "side-by-side": "dl-side-by-side",
  callout: "dl-callout",
}

export const remarkBlockDirectives: Plugin<[], Root> = () => (tree) => {
  visit(tree, (node: any) => {
    if (node.type !== "containerDirective" && node.type !== "leafDirective") return
    const tag = DIRECTIVE_TAG[node.name]
    if (!tag) return
    const data = (node.data ??= {}) as Record<string, unknown>
    ;(data as any).hName = tag
    ;(data as any).hProperties = { ...((data as any).hProperties ?? {}), ...node.attributes }
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/markdown/remark-block-directives.ts
git commit -m "feat(markdown): remark plugin mapping directives to dl-* hast tags"
```

---

## Task 4: Figure directive component

**Files:**
- Create: `components/markdown/directives/Figure.tsx`

**Spec rules:** `src` required + structural allowlist (`*.vercel-storage.com` host or `/learn/` path); `alt` required; optional `caption`; if `caption` omitted, body becomes caption.

- [ ] **Step 1: Implement**

```tsx
// components/markdown/directives/Figure.tsx
import Image from "next/image"
import type { ReactNode } from "react"

interface FigureProps {
  src?: string
  alt?: string
  caption?: string
  children?: ReactNode
}

const RASTER_TYPES = /\.(png|jpe?g|webp|gif)(?:\?|$)/i

function isAllowedSrc(src?: string): boolean {
  if (!src) return false
  if (src.startsWith("/learn/")) return true
  try {
    const u = new URL(src)
    return u.protocol === "https:" && u.hostname.endsWith(".vercel-storage.com")
  } catch {
    return false
  }
}

export function Figure({ src, alt, caption, children }: FigureProps) {
  if (!isAllowedSrc(src) || !alt) {
    return <figure className="my-6 border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
      figure rejected: missing src or alt
    </figure>
  }
  const isRaster = RASTER_TYPES.test(src ?? "")
  return (
    <figure className="my-6 rounded-xl border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-center bg-surface-muted p-6">
        {isRaster ? (
          <Image
            src={src!}
            alt={alt}
            width={1200}
            height={600}
            className="max-w-full h-auto"
            sizes="(min-width: 1024px) 720px, 100vw"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className="max-w-full h-auto" />
        )}
      </div>
      <figcaption className="px-4 py-2.5 border-t border-border text-sm text-muted-foreground">
        {caption ?? children}
      </figcaption>
    </figure>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/markdown/directives/Figure.tsx
git commit -m "feat(markdown): :::figure directive component"
```

---

## Task 5: Callout directive component

**Files:**
- Create: `components/markdown/directives/Callout.tsx`

**Spec rule:** `kind` ∈ `tip | pitfall | note | warning`; default `note`.

- [ ] **Step 1: Implement**

```tsx
// components/markdown/directives/Callout.tsx
import type { ReactNode } from "react"

const KIND_STYLE: Record<string, string> = {
  tip:      "border-l-primary bg-primary/5 [&_.dl-callout-tag]:text-primary",
  pitfall:  "border-l-accent bg-accent/5 [&_.dl-callout-tag]:text-accent",
  warning:  "border-l-destructive bg-destructive/5 [&_.dl-callout-tag]:text-destructive",
  note:     "border-l-muted-foreground bg-muted [&_.dl-callout-tag]:text-muted-foreground",
}

const KIND_LABEL: Record<string, string> = {
  tip: "Tip",
  pitfall: "Pitfall",
  warning: "Warning",
  note: "Note",
}

interface CalloutProps {
  kind?: string
  children?: ReactNode
}

export function Callout({ kind, children }: CalloutProps) {
  const safeKind = (kind && KIND_STYLE[kind] ? kind : "note") as keyof typeof KIND_STYLE
  return (
    <aside className={`my-6 rounded-md border-l-[3px] px-4 py-3 ${KIND_STYLE[safeKind]}`}>
      <span className="dl-callout-tag mr-2 inline-block text-[11px] font-semibold uppercase tracking-wide">
        {KIND_LABEL[safeKind]}
      </span>
      <span>{children}</span>
    </aside>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/markdown/directives/Callout.tsx
git commit -m "feat(markdown): :::callout directive component"
```

---

## Task 6: SideBySide directive component

**Files:**
- Create: `components/markdown/directives/SideBySide.tsx`

**Spec rule:** body split on the first `---` thematic break; each half is a card; optional `kind="good-bad"` shows ✓/✗ icons.

- [ ] **Step 1: Implement**

`react-markdown` doesn't preserve sibling splits inside a directive — instead, treat the markdown engine's output: `:::side-by-side` body becomes a sequence of nodes interspersed with a `<hr>` for `---`. The renderer here is given that as `children`, walks it, and splits into two groups around the first `<hr>`.

```tsx
// components/markdown/directives/SideBySide.tsx
import { Children, isValidElement, type ReactNode } from "react"

interface SideBySideProps {
  kind?: string
  children?: ReactNode
}

function splitOnHr(children: ReactNode): [ReactNode[], ReactNode[]] {
  const arr = Children.toArray(children)
  const idx = arr.findIndex((c) => isValidElement(c) && c.type === "hr")
  if (idx === -1) return [arr, []]
  return [arr.slice(0, idx), arr.slice(idx + 1)]
}

export function SideBySide({ kind, children }: SideBySideProps) {
  const [left, right] = splitOnHr(children)
  const isGoodBad = kind === "good-bad"
  return (
    <div className="my-6 grid grid-cols-1 gap-4 md:grid-cols-2">
      <article
        className={`rounded-xl border border-border bg-surface p-5 ${
          isGoodBad ? "[&_h3]:before:content-['✗'] [&_h3]:before:mr-2 [&_h3]:before:text-destructive" : ""
        }`}
      >
        {left}
      </article>
      <article
        className={`rounded-xl border border-border bg-surface p-5 ${
          isGoodBad ? "[&_h3]:before:content-['✓'] [&_h3]:before:mr-2 [&_h3]:before:text-primary" : ""
        }`}
      >
        {right}
      </article>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/markdown/directives/SideBySide.tsx
git commit -m "feat(markdown): :::side-by-side directive component"
```

---

## Task 7: Steps directive component

**Files:**
- Create: `components/markdown/directives/Steps.tsx`

**Spec rule:** ordered list inside `:::steps`; each `<li>` becomes a numbered card; bolded first phrase = title; nested `:::mermaid` allowed; nested `:::steps` not.

- [ ] **Step 1: Implement**

```tsx
// components/markdown/directives/Steps.tsx
import { Children, isValidElement, cloneElement, type ReactNode } from "react"

interface StepsProps {
  children?: ReactNode
}

/**
 * react-markdown gives us an <ol> as the first child. Reach in, harvest
 * its <li> children, and re-render each as a numbered card.
 */
export function Steps({ children }: StepsProps) {
  const ol = Children.toArray(children).find(
    (c) => isValidElement(c) && c.type === "ol",
  )
  const items = ol && isValidElement(ol)
    ? (Children.toArray((ol.props as any).children).filter(
        (c) => isValidElement(c) && c.type === "li",
      ) as React.ReactElement[])
    : []

  return (
    <div className="my-6 grid gap-5">
      {items.map((li, i) => (
        <div
          key={i}
          className="grid grid-cols-[3rem_1fr] items-start gap-5 rounded-xl border border-border bg-surface p-5"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
            {i + 1}
          </div>
          <div className="text-sm text-foreground">{(li.props as any).children}</div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/markdown/directives/Steps.tsx
git commit -m "feat(markdown): :::steps directive component"
```

---

## Task 8: MermaidClient (sanitized client renderer)

**Files:**
- Create: `components/markdown/directives/MermaidClient.tsx`

**Spec safety pipeline:**
1. Mermaid config: `securityLevel: 'strict'`, `htmlLabels: false`.
2. DOMPurify on the rendered SVG before insertion. Allowlist: SVG profile, `FORBID_TAGS: ['script', 'foreignObject']`, `FORBID_ATTR: [/^on/i, 'href', 'xlink:href', 'style']`.

- [ ] **Step 1: Implement**

```tsx
// components/markdown/directives/MermaidClient.tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import DOMPurify from "isomorphic-dompurify"

const PURIFY_CONFIG: DOMPurify.Config = {
  USE_PROFILES: { svg: true, svgFilters: false },
  FORBID_TAGS: ["script", "foreignObject"],
  FORBID_ATTR: ["href", "xlink:href", "style"],
}

const ON_HANDLER_RE = /^on/i

export function MermaidClient({ source, idHint }: { source: string; idHint: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const mermaid = (await import("mermaid")).default
        mermaid.initialize({
          startOnLoad: false,
          theme: resolvedTheme === "dark" ? "dark" : "default",
          securityLevel: "strict",
          htmlLabels: false,
          flowchart: { htmlLabels: false },
        })
        const renderId = `mmd-${idHint}-${Math.random().toString(36).slice(2)}`
        const { svg } = await mermaid.render(renderId, source)
        if (cancelled || !ref.current) return
        const cleaned = DOMPurify.sanitize(svg, {
          ...PURIFY_CONFIG,
          // Additional sweep: drop any attribute name matching /^on/i that the
          // FORBID_ATTR exact-match list didn't catch.
          ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#)/i,
        })
        const tmp = document.createElement("div")
        tmp.innerHTML = cleaned
        tmp.querySelectorAll("*").forEach((el) => {
          for (const attr of Array.from(el.attributes)) {
            if (ON_HANDLER_RE.test(attr.name)) el.removeAttribute(attr.name)
          }
        })
        ref.current.innerHTML = tmp.innerHTML
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "render failed")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [source, resolvedTheme, idHint])

  if (error) {
    return (
      <div className="my-4 rounded-md border border-border bg-surface-muted p-3">
        <div className="mb-1 text-xs text-muted-foreground">
          Mermaid render failed: {error}
        </div>
        <pre className="overflow-auto rounded bg-code-bg p-3 text-xs text-code-fg">
          <code>{source}</code>
        </pre>
      </div>
    )
  }
  return <div ref={ref} className="dl-mermaid" />
}
```

- [ ] **Step 2: Commit**

```bash
git add components/markdown/directives/MermaidClient.tsx
git commit -m "feat(markdown): MermaidClient with strict + DOMPurify pipeline"
```

---

## Task 9: Mermaid wrapper (server-side directive)

**Files:**
- Create: `components/markdown/directives/Mermaid.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/markdown/directives/Mermaid.tsx
import dynamic from "next/dynamic"
import type { ReactNode } from "react"

const MermaidClient = dynamic(
  () => import("./MermaidClient").then((m) => m.MermaidClient),
  { ssr: false, loading: () => <div className="dl-mermaid-loading h-32" /> },
)

interface MermaidProps {
  alt?: string
  caption?: string
  children?: ReactNode
}

function extractText(children: ReactNode): string {
  // The body of :::mermaid is a paragraph of text after markdown parsing.
  // Walk the React children and concatenate text content.
  if (typeof children === "string") return children
  if (Array.isArray(children)) return children.map(extractText).join("")
  if (children && typeof children === "object" && "props" in (children as any)) {
    return extractText((children as any).props.children)
  }
  return ""
}

export function Mermaid({ alt, caption, children }: MermaidProps) {
  const source = extractText(children).trim()
  if (!alt) {
    return (
      <figure className="my-6 border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
        :::mermaid rejected: missing alt
      </figure>
    )
  }
  return (
    <figure
      className="my-6 rounded-xl border border-border bg-surface overflow-hidden"
      aria-label={alt}
    >
      <div className="flex items-center justify-center bg-surface-muted p-6">
        <MermaidClient source={source} idHint={alt.replace(/[^a-z0-9]/gi, "").slice(0, 16)} />
      </div>
      {caption && (
        <figcaption className="px-4 py-2.5 border-t border-border text-sm text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/markdown/directives/Mermaid.tsx
git commit -m "feat(markdown): :::mermaid directive wrapper with lazy client load"
```

---

## Task 10: Wire all directives into MarkdownRenderer

**Files:**
- Modify: `components/markdown/MarkdownRenderer.tsx`

- [ ] **Step 1: Read the current renderer**

```bash
cat components/markdown/MarkdownRenderer.tsx
```

- [ ] **Step 2: Add `remarkDirective` + `remarkBlockDirectives` to the plugin list and the component map**

Update the `remarkPlugins` and `components` props. Keep all existing component mappings.

```tsx
// in components/markdown/MarkdownRenderer.tsx
import remarkDirective from "remark-directive"
import { remarkBlockDirectives } from "@/lib/markdown/remark-block-directives"
import { Figure } from "./directives/Figure"
import { Mermaid } from "./directives/Mermaid"
import { Steps } from "./directives/Steps"
import { SideBySide } from "./directives/SideBySide"
import { Callout } from "./directives/Callout"

// inside the renderer body, in the existing ReactMarkdown call:
<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkDirective, remarkBlockDirectives]}
  rehypePlugins={[/* existing */]}
  components={{
    /* existing component mappings */,
    "dl-figure": Figure as any,
    "dl-mermaid": Mermaid as any,
    "dl-steps": Steps as any,
    "dl-side-by-side": SideBySide as any,
    "dl-callout": Callout as any,
  }}
>
  {/* existing */}
</ReactMarkdown>
```

(`as any` is needed because react-markdown's component-map types don't include custom hast tag names; the runtime dispatch is correct.)

- [ ] **Step 3: Build to confirm**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/markdown/MarkdownRenderer.tsx
git commit -m "feat(markdown): wire directive plugin + component map into renderer"
```

---

## Task 11: `next.config.ts` — allow Vercel Blob host

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Add to `images.remotePatterns`**

Find the existing `images:` block (create one if absent). Add:

```ts
images: {
  remotePatterns: [
    // ...existing
    { protocol: "https", hostname: "*.vercel-storage.com" },
    { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
  ],
},
```

- [ ] **Step 2: Commit**

```bash
git add next.config.ts
git commit -m "build(next): allow *.vercel-storage.com in image remotePatterns"
```

---

## Task 12: CSP middleware on `/learn/**`

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Inspect the existing middleware**

```bash
cat middleware.ts
```

Find the `matcher` config and the request-handling shape.

- [ ] **Step 2: Add CSP injection for `/learn/**` only**

```ts
// middleware.ts — preserve all existing logic, add the CSP branch.

const LEARN_CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'nonce-__NONCE__'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.vercel-storage.com https://*.public.blob.vercel-storage.com",
  "connect-src 'self'",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
]

function applyLearnCsp(response: NextResponse, nonce: string): void {
  const policy = LEARN_CSP_DIRECTIVES.map((d) => d.replace("__NONCE__", nonce)).join("; ")
  response.headers.set("Content-Security-Policy", policy)
  response.headers.set("x-csp-nonce", nonce) // App Router can read this to stamp <Script nonce={...}>
}

// inside the middleware function, after existing logic:
if (request.nextUrl.pathname.startsWith("/learn")) {
  const nonce = crypto.randomUUID().replace(/-/g, "")
  applyLearnCsp(response, nonce)
}
```

Update the `matcher` to include `/learn/:path*` if it isn't already covered.

- [ ] **Step 3: Build + smoke**

```bash
npm run build
npm run dev &
sleep 4
curl -sI http://localhost:3000/learn | grep -i "content-security-policy"
kill %1
```

Expected: a `Content-Security-Policy:` header on the `/learn` response.

- [ ] **Step 4: Commit**

```bash
git add middleware.ts
git commit -m "feat(middleware): CSP nonce + directive header on /learn/**"
```

---

## Task 13: CSP E2E test

**Files:**
- Create: `tests/e2e/learn-csp.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/learn-csp.spec.ts
import { test, expect } from "@playwright/test"

test.describe("CSP on /learn/**", () => {
  test("response carries the expected directive set", async ({ page }) => {
    const response = await page.goto("/learn")
    expect(response).not.toBeNull()
    const csp = response!.headers()["content-security-policy"]
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self' 'nonce-")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("img-src 'self' data: https://*.vercel-storage.com")
  })

  test("CSP header is absent on a non-/learn path", async ({ page }) => {
    const response = await page.goto("/practice")
    const csp = response?.headers()["content-security-policy"]
    expect(csp).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run it**

```bash
npx playwright test tests/e2e/learn-csp.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/learn-csp.spec.ts
git commit -m "test(e2e): CSP header presence on /learn/** only"
```

---

## Task 14: Layer 1 validator in `lib/admin-validation.ts`

**Files:**
- Modify: `lib/admin-validation.ts`

**Contract reminder (CLAUDE.md):** this file is Prisma-free and Next/server-free. Layer 1 stays here. Layer 2 (Prisma-aware) lives elsewhere — out of scope for PR B.

- [ ] **Step 1: Add the syntactic validator at the bottom of the file**

```ts
// lib/admin-validation.ts — append below existing exports

import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkDirective from "remark-directive"
import { visit } from "unist-util-visit"

const DIRECTIVE_NAMES = new Set(["figure", "mermaid", "steps", "side-by-side", "callout"])
const ALLOWED_CALLOUT_KINDS = new Set(["tip", "pitfall", "note", "warning"])

export type ArticleDirectiveError = {
  directive: string
  index: number
  message: string
}

export interface SyntacticResult {
  ok: boolean
  hasVisualBlocks: boolean
  figureUrls: string[]
  errors: ArticleDirectiveError[]
}

function isAllowedFigureSrc(src: string): boolean {
  if (src.startsWith("/learn/")) return true
  try {
    const u = new URL(src)
    return u.protocol === "https:" && u.hostname.endsWith(".vercel-storage.com")
  } catch {
    return false
  }
}

export function validateArticleDirectivesSyntactic(content: string): SyntacticResult {
  const errors: ArticleDirectiveError[] = []
  const figureUrls: string[] = []
  let hasVisualBlocks = false
  let directiveCount = 0

  const tree = unified()
    .use(remarkParse)
    .use(remarkDirective)
    .parse(content) as any

  visit(tree, (node: any) => {
    if (node.type !== "containerDirective" && node.type !== "leafDirective") return
    if (!DIRECTIVE_NAMES.has(node.name)) return
    hasVisualBlocks = true
    const idx = directiveCount++
    const attrs = node.attributes ?? {}

    if (node.name === "figure") {
      if (!attrs.src) {
        errors.push({ directive: "figure", index: idx, message: "src is required" })
      } else if (!isAllowedFigureSrc(attrs.src)) {
        errors.push({
          directive: "figure", index: idx,
          message: `src "${attrs.src}" is not in the allowlist (/learn/ or *.vercel-storage.com)`,
        })
      } else {
        figureUrls.push(attrs.src)
      }
      if (!attrs.alt || attrs.alt.trim() === "") {
        errors.push({ directive: "figure", index: idx, message: "alt is required and non-empty" })
      }
    }

    if (node.name === "mermaid") {
      if (!attrs.alt || attrs.alt.trim() === "") {
        errors.push({ directive: "mermaid", index: idx, message: "alt is required and non-empty" })
      }
    }

    if (node.name === "callout") {
      const kind = attrs.kind ?? "note"
      if (!ALLOWED_CALLOUT_KINDS.has(kind)) {
        errors.push({
          directive: "callout", index: idx,
          message: `kind "${kind}" must be one of ${[...ALLOWED_CALLOUT_KINDS].join(", ")}`,
        })
      }
    }

    if (node.name === "side-by-side") {
      // Count `thematicBreak` children — exactly one expected.
      const children = (node.children ?? []) as any[]
      const hrCount = children.filter((c) => c.type === "thematicBreak").length
      if (hrCount !== 1) {
        errors.push({
          directive: "side-by-side", index: idx,
          message: `body must contain exactly one '---' break, got ${hrCount}`,
        })
      }
    }
  })

  return { ok: errors.length === 0, hasVisualBlocks, figureUrls, errors }
}
```

- [ ] **Step 2: Confirm `lib/admin-validation.ts` still imports nothing Prisma/Next**

```bash
grep -E "@prisma/client|next/server|next/headers|next-auth|@/lib/prisma" lib/admin-validation.ts
```

Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add lib/admin-validation.ts
git commit -m "feat(validation): Layer 1 syntactic directive validator (Prisma-free)"
```

---

## Task 15: Test directive renderer end-to-end

**Files:**
- Create: `scripts/test-directive-renderer.ts`

**Strategy:** parse + run through the same `remark-directive` plugin chain the renderer uses, then assert the resulting AST has the expected `data.hName` tags. This validates the plugin without needing a React DOM.

- [ ] **Step 1: Write the test**

```ts
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkDirective from "remark-directive"
import { remarkBlockDirectives } from "../lib/markdown/remark-block-directives"
import { visit } from "unist-util-visit"
import assert from "node:assert/strict"

function run(md: string) {
  const tree = unified()
    .use(remarkParse)
    .use(remarkDirective)
    .use(remarkBlockDirectives)
    .parse(md) as any
  unified().use(remarkBlockDirectives).runSync(tree)
  return tree
}

function tagsIn(tree: any): string[] {
  const tags: string[] = []
  visit(tree, (node: any) => {
    const hName = node.data?.hName
    if (hName) tags.push(hName)
  })
  return tags
}

const cases: { name: string; md: string; expectTags: string[] }[] = [
  {
    name: "figure",
    md: `:::figure{src="/learn/x.svg" alt="hi"}\nbody\n:::`,
    expectTags: ["dl-figure"],
  },
  {
    name: "mermaid",
    md: `:::mermaid{alt="flow"}\nflowchart LR\n  A --> B\n:::`,
    expectTags: ["dl-mermaid"],
  },
  {
    name: "steps",
    md: `:::steps\n1. **First** body\n2. **Second** body\n:::`,
    expectTags: ["dl-steps"],
  },
  {
    name: "side-by-side",
    md: `:::side-by-side\n### A\nleft\n\n---\n\n### B\nright\n:::`,
    expectTags: ["dl-side-by-side"],
  },
  {
    name: "callout",
    md: `:::callout{kind="pitfall"}\nwatch out\n:::`,
    expectTags: ["dl-callout"],
  },
  {
    name: "all five together",
    md: `:::figure{src="/learn/a.svg" alt="a"}\nx\n:::\n\n:::mermaid{alt="b"}\nflowchart LR\n  A --> B\n:::\n\n:::steps\n1. **One** body\n:::\n\n:::side-by-side\nleft\n\n---\n\nright\n:::\n\n:::callout\nnote\n:::`,
    expectTags: ["dl-figure", "dl-mermaid", "dl-steps", "dl-side-by-side", "dl-callout"],
  },
]

for (const c of cases) {
  const tags = tagsIn(run(c.md))
  assert.deepEqual(tags, c.expectTags, `case "${c.name}": expected ${JSON.stringify(c.expectTags)}, got ${JSON.stringify(tags)}`)
}

// Legacy markdown still parses (no new tags).
const legacy = run(`# Heading\n\nParagraph with \`code\` and **bold**.`)
assert.deepEqual(tagsIn(legacy), [], "legacy markdown produces no dl-* tags")

console.log("test-directive-renderer PASS")
```

- [ ] **Step 2: Run it**

```bash
npm run test:directive-renderer
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/test-directive-renderer.ts
git commit -m "test(markdown): directive plugin emits expected hast tags"
```

---

## Task 16: Test Mermaid sanitization

**Files:**
- Create: `scripts/test-mermaid-sanitization.ts`

**Goal:** prove the sanitization sweep in `MermaidClient.tsx` strips known XSS vectors. Since `MermaidClient` is a client component that uses `window`/`document`, we exercise the DOMPurify config directly with the same options.

- [ ] **Step 1: Write the test**

```ts
import DOMPurify from "isomorphic-dompurify"
import assert from "node:assert/strict"

const PURIFY_CONFIG = {
  USE_PROFILES: { svg: true, svgFilters: false },
  FORBID_TAGS: ["script", "foreignObject"],
  FORBID_ATTR: ["href", "xlink:href", "style"],
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#)/i,
}

function purify(svg: string): string {
  // isomorphic-dompurify runs in node via jsdom; the call shape matches the browser API.
  return DOMPurify.sanitize(svg, PURIFY_CONFIG as any)
}

const cases: { name: string; in: string; mustNotContain: string[] }[] = [
  {
    name: "script tag stripped",
    in: `<svg><script>alert(1)</script><rect width="10" height="10"/></svg>`,
    mustNotContain: ["<script>", "alert(1)"],
  },
  {
    name: "onclick attribute stripped",
    in: `<svg><rect onclick="alert(1)" width="10" height="10"/></svg>`,
    mustNotContain: ["onclick", "alert(1)"],
  },
  {
    name: "foreignObject + iframe stripped",
    in: `<svg><foreignObject><iframe src="javascript:alert(1)"/></foreignObject></svg>`,
    mustNotContain: ["<foreignObject", "<iframe", "javascript:"],
  },
  {
    name: "xlink:href stripped",
    in: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><a xlink:href="javascript:alert(1)"><text>click</text></a></svg>`,
    mustNotContain: ["xlink:href", "javascript:"],
  },
  {
    name: "style attribute stripped",
    in: `<svg><rect style="background:url(javascript:alert(1))" width="10" height="10"/></svg>`,
    mustNotContain: ["style=", "javascript:"],
  },
]

for (const c of cases) {
  const out = purify(c.in)
  for (const banned of c.mustNotContain) {
    assert.ok(!out.includes(banned), `case "${c.name}": still contains ${banned}: ${out}`)
  }
}

// Benign should survive.
const ok = purify(`<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="red"/></svg>`)
assert.ok(ok.includes("<rect"), "benign rect survived")

console.log("test-mermaid-sanitization PASS")
```

- [ ] **Step 2: Run it**

```bash
npm run test:mermaid-sanitization
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/test-mermaid-sanitization.ts
git commit -m "test(markdown): DOMPurify config strips known SVG XSS vectors"
```

---

## Task 17: Test Layer 1 publish validation

**Files:**
- Create: `scripts/test-article-publish-validation.ts`

- [ ] **Step 1: Write the test**

```ts
import { validateArticleDirectivesSyntactic } from "../lib/admin-validation"
import assert from "node:assert/strict"

// Happy
const ok = validateArticleDirectivesSyntactic(
  `:::figure{src="/learn/a.svg" alt="a"}\nx\n:::\n\n:::callout{kind="tip"}\nhi\n:::`
)
assert.equal(ok.ok, true, JSON.stringify(ok.errors))
assert.equal(ok.hasVisualBlocks, true)
assert.deepEqual(ok.figureUrls, ["/learn/a.svg"])

// Missing alt on figure
const noAlt = validateArticleDirectivesSyntactic(`:::figure{src="/learn/a.svg"}\n:::`)
assert.equal(noAlt.ok, false)
assert.ok(noAlt.errors.some((e) => e.message.includes("alt is required")))

// External URL rejected
const ext = validateArticleDirectivesSyntactic(
  `:::figure{src="https://evil.com/x.png" alt="x"}\n:::`
)
assert.equal(ext.ok, false)
assert.ok(ext.errors.some((e) => e.message.includes("not in the allowlist")))

// Vercel Blob URL accepted
const blob = validateArticleDirectivesSyntactic(
  `:::figure{src="https://store.vercel-storage.com/learn/abc.svg" alt="x"}\n:::`
)
assert.equal(blob.ok, true)
assert.deepEqual(blob.figureUrls, ["https://store.vercel-storage.com/learn/abc.svg"])

// Mermaid without alt rejected
const mermNoAlt = validateArticleDirectivesSyntactic(`:::mermaid\nflowchart LR\nA-->B\n:::`)
assert.equal(mermNoAlt.ok, false)

// Callout bad kind
const badKind = validateArticleDirectivesSyntactic(`:::callout{kind="oops"}\nx\n:::`)
assert.equal(badKind.ok, false)

// Side-by-side without exactly one ---
const sbsNoBreak = validateArticleDirectivesSyntactic(`:::side-by-side\nleft\nright\n:::`)
assert.equal(sbsNoBreak.ok, false)
const sbsOneBreak = validateArticleDirectivesSyntactic(
  `:::side-by-side\nleft\n\n---\n\nright\n:::`
)
assert.equal(sbsOneBreak.ok, true, JSON.stringify(sbsOneBreak.errors))

// Legacy markdown
const legacy = validateArticleDirectivesSyntactic(`# Just a heading\n\nParagraph.`)
assert.equal(legacy.ok, true)
assert.equal(legacy.hasVisualBlocks, false)
assert.deepEqual(legacy.figureUrls, [])

console.log("test-article-publish-validation PASS")
```

- [ ] **Step 2: Run it**

```bash
npm run test:article-publish-validation
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/test-article-publish-validation.ts
git commit -m "test(validation): Layer 1 syntactic checks (alt/allowlist/kind/sbs)"
```

---

## Task 18: MCP bundle isolation check

**Files:**
- Create: `scripts/check-mcp-bundle-isolation.ts`

- [ ] **Step 1: Write the script**

```ts
import { build } from "esbuild"
import { resolve } from "node:path"

const ENTRY = resolve(process.cwd(), "mcp-server/src/index.ts")
const FORBIDDEN_PATTERNS: RegExp[] = [
  /^@prisma\/client/,
  /^next\/server$/,
  /^next\/headers$/,
  /lib\/prisma/,
  /actions\/article-publish-validation/,
]

async function main() {
  const result = await build({
    entryPoints: [ENTRY],
    bundle: true,
    platform: "node",
    write: false,
    metafile: true,
    format: "esm",
    logLevel: "silent",
  })
  const inputs = Object.keys(result.metafile!.inputs)
  const violations = inputs.filter((p) =>
    FORBIDDEN_PATTERNS.some((re) => re.test(p))
  )
  if (violations.length > 0) {
    console.error("MCP bundle isolation VIOLATED — forbidden modules in import graph:")
    for (const v of violations) console.error(`  - ${v}`)
    process.exit(1)
  }
  console.log(`check-mcp-bundle-isolation PASS (${inputs.length} modules scanned)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Run it**

```bash
npm run check:mcp-bundle-isolation
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/check-mcp-bundle-isolation.ts
git commit -m "test(mcp): bundle isolation — no Prisma/Next/server imports reachable"
```

---

## Task 19: Final integration check + push + open PR

- [ ] **Step 1: Run the full local suite**

```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' \
  npm run test:directive-renderer && \
  npm run test:mermaid-sanitization && \
  npm run test:article-publish-validation && \
  npm run check:mcp-bundle-isolation && \
  npx playwright test tests/e2e/learn-csp.spec.ts
```

Expected: all PASS.

- [ ] **Step 2: Type-check + build**

```bash
npx tsc --noEmit
npm run build
```

Expected: both succeed.

- [ ] **Step 3: Push + open PR**

```bash
git push -u origin feat/learn-v2-pr-b-directive-renderer
gh pr create --base main --title "feat: Learn v2 PR B — directive renderer + CSP" --body "$(cat <<'EOF'
## Summary

Markdown directive renderer for five visual block types + Mermaid sanitization + CSP middleware on `/learn/**`. Ships dark — no article uses directives yet (PR C wires authoring + seeds the reference lesson).

- `:::figure`, `:::mermaid`, `:::steps`, `:::side-by-side`, `:::callout` directives.
- Mermaid lazy-loaded, `securityLevel: 'strict'`, `htmlLabels: false`, DOMPurify sanitization on the output SVG (forbids `<script>`, `<foreignObject>`, event handlers, `href`/`xlink:href`/`style`).
- CSP nonce + directive set injected on `/learn/**` only. Other routes unperturbed.
- Layer 1 (`validateArticleDirectivesSyntactic`) added to `lib/admin-validation.ts` — Prisma-free, MCP-importable. CI gate: `check:mcp-bundle-isolation`.

Spec: `docs/superpowers/specs/2026-05-20-learn-v2-visual-articles-design.md`.
Plan: `docs/superpowers/plans/2026-05-21-learn-v2-pr-b-directive-renderer.md`.

## Verified

- [x] `npm run test:directive-renderer`
- [x] `npm run test:mermaid-sanitization`
- [x] `npm run test:article-publish-validation`
- [x] `npm run check:mcp-bundle-isolation`
- [x] `npx playwright test tests/e2e/learn-csp.spec.ts`
- [x] `npx tsc --noEmit` clean
- [x] `npm run build` (webpack) clean
- [x] `mcp-server/dist/index.js` rebuilds cleanly (no new top-level imports)

## Not yet verified

- [ ] CSP impact on the existing `/learn/[topicSlug]/[articleSlug]` page in a real browser (no directives used yet, should be a no-op).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Confirm CI is green; do NOT auto-merge.**

---

## Self-review checklist

- Spec sections covered: "Directives" (all five), "Renderer architecture", "Content-Security-Policy (new in v1)", Layer 1 validation in "Publish-time validation".
- No `:::svg` directive (deferred to v1.5).
- No Layer 2 validator (PR C).
- No publish-path wiring (PR C).
- No Asset table imports — uploads + Asset live in PR A.
- `lib/admin-validation.ts` contract preserved: no Prisma, no Next/server imports.
- `next.config.ts` `remotePatterns` allows Blob hostnames so `Figure` can use Next/Image.
- CSP middleware is scoped to `/learn/**` so `/practice`, `/admin`, etc., are unchanged.
