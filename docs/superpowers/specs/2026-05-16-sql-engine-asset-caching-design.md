# SQL Engine Asset Caching — Design

**Phase:** SQL Engine v2 — PR 3.3
**Status:** Design (investigation); implementation gated on the recommendation in this doc.
**Owner:** Anchit Gupta
**Date:** 2026-05-16
**Related:** PR 3.1 (warmup — shipped), PR 3.4 (bundle size investigation — closed)

## Goal

Make the DuckDB-WASM (~5 MB brotli) and PGlite (~3 MB) bundles **not transit the network** on the typical learner's second visit, and make first-visit transfer **start sooner** when we can predict it.

This is the third lever for the same cold-start problem PR 3.1 (warmup) and PR 3.4 (bundle slim-down) attacked:

| Lever | Attacks | Status |
|---|---|---|
| PR 3.1 — warmup | Latency between landing on `/practice` and `engine.init.ready` | Shipped (v0.4.7) |
| PR 3.4 — variant-swap | First-visit wire bytes | Investigated; not viable (brotli closes the gap to ~11%) |
| **PR 3.3 — asset cache (this doc)** | **Repeat-visit wire bytes** | **Design** |

## What "repeat visit" means in practice

The win we care about is: a learner who has loaded any `/practice/<slug>` page in the last week revisits the site, and the DuckDB-WASM bundle is **already on disk**, so `engine.init.ready` completes without a network fetch.

The browser HTTP cache already handles this in theory. jsDelivr serves `@duckdb/duckdb-wasm@1.33.1-dev45.0/dist/*.wasm` with `Cache-Control: public, max-age=31536000, immutable`. So why isn't this solved?

Three reasons it falls short:

1. **Browser cache eviction is opportunistic.** Chrome and Safari evict less-recently-used large entries (>5 MB wasm modules qualify) when disk pressure builds. The bundle gets re-downloaded even within max-age.
2. **Third-party cache partitioning.** All major browsers partition the HTTP cache by *top-level* origin since 2020-2022. The `cdn.jsdelivr.net` entry cached when the user visited *another* site that also uses `duckdb-wasm@1.33.1` doesn't help us — each top-level origin gets its own cache key.
3. **Cache-miss reporting is invisible.** We have no telemetry today on what fraction of `engine.init.ready` events are cold-from-network vs. warm-from-disk-cache. PR 3.1's telemetry harness captures elapsed time but not the underlying cause.

## Approaches considered

Four approaches, in increasing order of complexity:

### Approach A — Do nothing (rely on HTTP cache)

**Cost:** zero.

**Behavior:** First visit pays the bundle. Subsequent visits within max-age hit the HTTP cache. Eviction is browser-controlled.

**Verdict:** This is the current baseline. We don't have data on how often eviction actually fires for real users. We should measure before bypassing it.

### Approach B — `<link rel="preload">` for the bundle URLs

**Cost:** ~30 minutes of code. One `<link>` in `app/practice/layout.tsx`.

**Behavior:** Browser starts fetching the bundle as soon as the `/practice` route loads — earlier than PR 3.1's `useEffect`, which only fires after React mounts.

**Verdict:** Marginal extra win over PR 3.1. Only useful if we can resolve the bundle URL server-side, which means calling `getJsDelivrBundles()` from a server component (synchronous, package is import-safe). Worth doing as a small follow-up regardless of the larger PR 3.3 decision.

### Approach C — Self-host the WASM under our own origin

**Cost:** ~2 hours of code + ~5 MB added to the Vercel build artifact.

**Behavior:** Copy `node_modules/@duckdb/duckdb-wasm/dist/duckdb-eh.{wasm,worker.js}` into `public/_dl/sql-engine/` at build time. Override `getJsDelivrBundles()` to return our own URLs. Vercel serves with `Cache-Control: public, max-age=31536000, immutable` headers under our control.

**Benefits over A:**

- We control the headers (longer cache, deterministic).
- No third-party CDN dependency. jsDelivr availability incidents stop affecting us.
- Cache key is our origin, so a user visiting `learndatanow.com` benefits from any prior `learndatanow.com` visit (the partitioning issue still exists, but we're now on the win side of it for our own users).

**Benefits over D (SW):**

- No service worker to manage / debug / unregister.
- No risk of sticky broken-deploy state.
- Plain HTTP semantics; Network tab and DevTools just work.

**Costs:**

- Build artifact +5 MB. Vercel functions size cap doesn't apply to static assets, so this is fine, but it does increase deploy time slightly.
- We must remember to bump the bundle when upgrading `@duckdb/duckdb-wasm`. Easy enough — a `prebuild` script that copies from `node_modules/`.
- DuckDB-WASM's `selectBundle()` interface assumes URLs. We provide them. Trivial.

### Approach D — Service worker with versioned cache

**Cost:** ~4 hours of code + design risk.

**Behavior:** Register a service worker scoped to `/_dl/sql-engine/`. It caches the bundle on first fetch, serves from cache on every subsequent request. Cache name includes the build SHA so deploys invalidate cleanly.

**Benefits over C:**

- Survives HTTP cache eviction. A SW cache is treated as application data, not opportunistic cache, by most browsers.
- Programmatic eviction (we can clear it explicitly via the `?dl-sw=unregister` escape hatch).

**Costs:**

- **Sticky broken deploys.** This is the big one. A SW that caches a stale `index.html` or a broken JS chunk can lock users into a bad state until they manually clear site data. The fix surface area is large enough that several teams have ripped SWs out after deploy incidents.
- **Scope creep risk.** Once a SW exists, there's pressure to cache more things. Each addition is another deploy-stickiness vector.
- **Browser-tab inconsistency.** Two tabs of the same site can be running different SW versions for a window. Bug surface around this is real.
- **Detection harder.** "Why isn't my deploy live?" → "did the SW serve a stale cache?" is now a debugging step.

## Recommendation

**Phase 1 (this PR): Approach C + Approach B in a single PR.** Self-host the bundle, add `<link rel="preload">` on `/practice` routes. No service worker.

**Phase 2 (only if measurements demand it): Approach D.** Defer until we have telemetry showing that HTTP-cache eviction is materially hurting `engine.init.ready` for real users — measured via the new "cold-from-network" tag described below.

### Why this ordering

- Approach C alone solves the third-party CDN dependency, the header-control gap, and most of the cache-partitioning surface. It's strictly better than Approach A with no new deployment risk.
- Approach B is a small extension that's only meaningful once Approach C is in place (it's hard to safely preload third-party URLs without CORS attribute coordination; same-origin is straightforward).
- Approach D's stickiness risk outweighs its win unless we *know* HTTP-cache eviction is the bottleneck. We don't know that yet.

## Implementation plan (Phase 1)

### Files

```
public/_dl/sql-engine/
  duckdb-eh.wasm                       # copied from node_modules at build time
  duckdb-eh.worker.js                  # copied from node_modules at build time

scripts/copy-sql-engine-assets.ts      # NEW — prebuild step
package.json                           # NEW prebuild hook + script
lib/duckdb.ts                          # selectBundle → self-hosted URLs in prod
app/practice/layout.tsx                # NEW — <link rel="preload"> headers
lib/sql-engine/telemetry.ts            # NEW field: `bundleSource: "self" | "cdn"`
docs/DEPLOY.md                         # note the new public/_dl path
docs/superpowers/plans/2026-05-05-sql-engine-v2-roadmap.md  # mark PR 3.3 done
```

### Sketches

**`scripts/copy-sql-engine-assets.ts`** — runs as `prebuild` (after `prisma generate`, before `next build`):

```ts
import { copyFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"

const src = "node_modules/@duckdb/duckdb-wasm/dist"
const dest = "public/_dl/sql-engine"
const files = ["duckdb-eh.wasm", "duckdb-browser-eh.worker.js"]

mkdirSync(dest, { recursive: true })
for (const f of files) {
    copyFileSync(join(src, f), join(dest, f))
}
console.log(`[sql-engine] copied ${files.length} assets to ${dest}`)
```

**`lib/duckdb.ts`** — switch the bundle source. Keep jsDelivr as a fallback for dev / when the self-hosted copy is missing:

```ts
import * as duckdb from "@duckdb/duckdb-wasm"

function selfHostedBundle(): duckdb.DuckDBBundles | null {
    if (typeof window === "undefined") return null
    // Only the `eh` variant. We measured that `mvp` is +12% on the wire
    // and `coi` requires cross-origin isolation site-wide.
    return {
        eh: {
            mainModule: "/_dl/sql-engine/duckdb-eh.wasm",
            mainWorker: "/_dl/sql-engine/duckdb-browser-eh.worker.js",
        },
    }
}

export async function initDuckDB() {
    const bundles = selfHostedBundle() ?? duckdb.getJsDelivrBundles()
    const bundle = await duckdb.selectBundle(bundles)
    // ... rest unchanged
}
```

`selectBundle` will pick `eh` on any modern browser. On a very old browser that lacks WASM exception handling, it would have picked `mvp` from jsDelivr; with self-hosted-only we'd fail. Acceptable: we already drop `mvp` for our minimum-supported browser baseline. If we change our mind, ship `duckdb-mvp.wasm` too.

**`app/practice/layout.tsx`** — preload hint:

```tsx
import type { ReactNode } from "react"

export default function PracticeLayout({ children }: { children: ReactNode }) {
    return (
        <>
            <link
                rel="preload"
                href="/_dl/sql-engine/duckdb-eh.wasm"
                as="fetch"
                type="application/wasm"
                crossOrigin="anonymous"
            />
            <link
                rel="preload"
                href="/_dl/sql-engine/duckdb-browser-eh.worker.js"
                as="script"
            />
            {children}
        </>
    )
}
```

**Telemetry** — add a `bundleSource` field to `engine.init.ready` so we can split warm-cache-hit vs. cold-fetch:

```ts
type SqlEngineTelemetryEvent = {
    // ...existing fields...
    bundleSource?: "self" | "cdn" | "unknown"
}
```

`lib/duckdb.ts` records which path it took and threads it through to the telemetry session. Measurement of "what fraction of inits hit the disk cache" is then a follow-up by reading `engine.init.ready.elapsedMs` distribution: cold-from-network shows up as a long-tail spike.

## Decision criteria for Phase 2 (Service Worker)

We revisit Phase 2 (Approach D) only if **all** of these hold after one release window of post-Phase-1 production data:

1. Median `engine.init.ready.elapsedMs` on revisits is still >500ms.
2. The long tail of `engine.init.ready.elapsedMs` (p95) is >2s.
3. At least 10% of revisit sessions are inferred to be cold-cache (heuristic: `engine.init.ready.elapsedMs` distinct from the warmed-claim path).
4. We have a concrete reason to believe SW would help — e.g. evidence the long tail correlates with disk-pressure conditions (mobile Safari, low free disk).

If we get there, the Phase 2 spec is a separate doc.

## Risks

- **Bundle drift.** `prebuild` must run on every Vercel build. Vercel runs the `build` script, which we configure as `next build --webpack` — wrap it with `prebuild` so the copy step always fires. CI runs the same `npm run build`, so this is enforced.
- **Stale assets in `public/_dl/`.** A package upgrade that changes the wasm filename could leave the old file in the build artifact. Solution: `scripts/copy-sql-engine-assets.ts` first removes `public/_dl/sql-engine/` then copies fresh.
- **CSP / `Content-Type`.** Vercel serves `.wasm` with `application/wasm` by default. `.js` worker scripts are served as `application/javascript`. Verify in the Network tab; if Vercel does something weird, add `vercel.json` rewrites with explicit `Content-Type`.
- **CORS for preload.** Same-origin so this should be fine, but `crossOrigin="anonymous"` on the `<link rel="preload">` matches what `fetch(url, { mode: "cors" })` would do; verify the actual fetch matches the preload's cross-origin attribute, otherwise the preload doesn't count.

## Out of scope

- Caching MCP server bundles, admin UI assets, or other static files. This spec covers only the SQL engine WASM/JS pair.
- Phase 2 service worker. Tracked above as a follow-on conditional spec.
- Self-hosting PGlite. PR 3.2 (IndexedDB persistence) already amortizes its second-visit cost; the bundle download is no longer the binding constraint there.

## Verification (when Phase 1 lands)

- `npm run build` produces `.next/standalone/public/_dl/sql-engine/{duckdb-eh.wasm,duckdb-browser-eh.worker.js}`.
- `curl -I https://datalearn-iota.vercel.app/_dl/sql-engine/duckdb-eh.wasm` returns `Content-Type: application/wasm` and an immutable cache header.
- DevTools Network tab on a fresh `/practice/<slug>` cold load shows the wasm fetch hitting our origin, not jsDelivr.
- `engine.init.ready` telemetry events carry `bundleSource: "self"` post-deploy.
- Unit test for `selfHostedBundle()` returns null in node (SSR) and the right URLs in a synthetic-window environment.
