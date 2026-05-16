# DuckDB-WASM Bundle Size Investigation

**Phase:** SQL Engine v2 — PR 3.4
**Status:** Investigated 2026-05-16 — **variant-swap not viable; pivoting lever to PR 3.1 (warm-up) and/or PR 3.3 (service-worker precache).** See "Measurements (2026-05-16)" and "Recommendation" sections below.
**Owner:** Anchit Gupta
**Date:** 2026-05-10 (spec) · 2026-05-16 (measurements + decision)

## Goal

Determine whether Data Learn can reduce its DuckDB-WASM cold-start payload below the current ~30 MB worst-case without losing the ability to execute every PUBLISHED DuckDB problem. The output of this investigation is a measurement table and a go/no-go recommendation; the actual switch (if warranted) ships as a separate PR.

## Current Baseline

`lib/duckdb.ts` calls `duckdb.getJsDelivrBundles()` and lets `duckdb.selectBundle()` pick a variant based on browser capability detection. The CDN is jsDelivr; we don't host the WASM ourselves. There is no telemetry today on which variant a given learner actually receives, only that the engine readied (`engine.init.ready` from the telemetry harness).

The `@duckdb/duckdb-wasm` package publishes three jsDelivr-hosted variants:

| Variant | Requires | Approx size | When `selectBundle()` picks it |
|---|---|---|---|
| `mvp` | Baseline WASM | largest of the three | Browser lacks WASM exception handling |
| `eh` | WASM exception handling | smaller | Modern Chromium/Firefox/Safari |
| `coi` | Cross-origin isolation (COOP/COEP) | smaller still, multi-threaded | Site is COI-enabled (we are not) |

The codebase's working assumption is that most learners get `eh`. We have no measurements to confirm.

## What We're Measuring

For each bundle variant published by `@duckdb/duckdb-wasm`:

1. **Wire-size of the WASM module** (gzip and br compressed, where the CDN serves them).
2. **Wire-size of the worker JS** that wraps it.
3. **Total cold-start transfer** the Network tab reports for a fresh page load on `/practice/<slug>` with that bundle forced.
4. **Pass-rate of `npm run audit:dialects`** when the engine is forced to that bundle. The DuckDB-Node audit path doesn't exercise the bundle directly, so we instead patch a script that drives the in-browser bundle against the same canonical solutions and asserts row equality.

## Methodology

### Step 1 — Inventory available variants

```bash
node -e "console.log(Object.keys(require('@duckdb/duckdb-wasm').getJsDelivrBundles()))"
```

Confirm the list matches the table above and check whether the version we ship has any additional shapes (`eh-mt`, `coi-mt`, etc.) we're missing.

### Step 2 — Measure transfer size per variant

For each variant `V`:

1. Override `selectBundle()` to force `V` (temporary local patch, not committed).
2. Open `https://datalearn-iota.vercel.app/practice/simple-select` in a clean profile.
3. Record from the Network tab:
   - Module URL + transfer size + decoded size
   - Worker URL + transfer size + decoded size
   - Time-to-first-query-ready from telemetry (`engine.firstQuery.ready` `elapsedMs`)
4. Repeat in three browsers: Chrome stable, Firefox stable, Safari (cleared cache between runs).

### Step 3 — Compatibility check per variant

For each variant `V`:

1. With `V` forced, run every PUBLISHED DuckDB problem's canonical solution against the bundle in a Playwright harness.
2. Compare each result with `expectedOutputs.DUCKDB` using the same `compareResults` validator the production submit path uses.
3. A variant is "compatible" only if every problem passes.

The `mvp` bundle is smaller in features but has no known SQL-syntax gaps for what we ship. The `eh` and `coi` variants should be supersets of `mvp`. We need data, not assumption.

### Step 4 — Self-hosting evaluation

Independently of variant choice, evaluate whether to stop loading from jsDelivr:

- **Pros**: HTTP cache-control under our own headers, no third-party CDN dependency, deterministic deploy versioning, faster repeat-load via Vercel's edge cache.
- **Cons**: bundle ships in our own deploy artifact, increasing build output. Vercel functions size limits don't apply to static assets, but build time and cold cache fill go up.

Decision input: measured per-variant transfer with current (jsDelivr) headers vs. simulated (Vercel headers, e.g. `Cache-Control: public, max-age=31536000, immutable`).

## Decision Criteria

We switch the default bundle (or self-host) only if **all** of the following are true:

1. The candidate reduces cold-start transfer by ≥ 25% for the typical learner browser (Chrome stable).
2. `npm run audit:dialects` passes against the candidate bundle.
3. The Playwright per-problem compatibility check passes for every PUBLISHED DuckDB problem.
4. The change is reversible via a single-line revert in `lib/duckdb.ts`.

Failing any criterion: the variant stays as-is and we document the measurement in this file.

## Out of Scope

- **PGlite bundle size.** PGlite's load cost is now amortized by IndexedDB persistence (PR 3.2). DuckDB-WASM has no equivalent persistence story, so its cold-start cost is the bigger win to pursue.
- **Service worker / asset precache.** Tracked separately as PR 3.3.
- **Engine warm-up.** Tracked separately as PR 3.1.
- **DuckDB extension stripping.** The package doesn't expose per-extension bundles today; revisit if `@duckdb/duckdb-wasm` adds them upstream.

## Risks

- **jsDelivr variability.** Compressed sizes the CDN reports can drift between visits as the CDN rotates compression. Pin the package version when measuring; record the exact CDN URL.
- **Browser-specific bundle assignments.** `selectBundle()` may serve different bundles to different browsers. Headline number ("we serve N MB") is meaningless without a per-browser breakdown.
- **Compatibility regression risk.** If we narrow the bundle and a future problem author uses a SQL feature only available in the wider variant, the audit catches it on PUBLISH but a stale DRAFT could surface the gap during authoring. Document the constraint in `docs/API.md` and `mcp-server/README.md` if we narrow.

## Deliverables

1. A measurements table appended to this doc once Steps 2 and 3 are complete.
2. A separate PR to switch the bundle and/or self-host, gated on the decision criteria above.
3. A roadmap update in `docs/superpowers/plans/2026-05-05-sql-engine-v2-roadmap.md` marking PR 3.4 either implemented (with the chosen variant) or deferred (with the reason).

## Verification (when measurements land)

- `npm run audit:dialects` against current DB.
- Playwright run of the per-problem DuckDB compatibility check.
- Manual: open three DuckDB problems in Chrome / Firefox / Safari with cleared caches; verify the recorded transfer sizes match the bundle that should have been served.

## Related Work

- PR 3.1 — Engine warm-up. Different lever for the same problem (cold start), starts the bundle download earlier rather than making it smaller.
- PR 3.2 — PGlite IndexedDB persistence. Closes the repeat-visit cost for Postgres mode; this PR closes the equivalent for DuckDB if a smaller bundle is viable.
- PR 3.3 — Service worker / asset precache. Caches the bundle locally; orthogonal to bundle size and gated behind its own design doc.

---

## Measurements (2026-05-16)

`@duckdb/duckdb-wasm@1.33.1-dev45.0`. Pre-compressed locally with `gzip -9` and `brotli -q 11`; the CDN serves brotli where supported.

**Step 1 — variants actually published to jsDelivr.** `getJsDelivrBundles()` returns **two**, not three:

```text
Available bundles: [ 'mvp', 'eh' ]
```

`coi` exists on disk in the package but is **not** exposed via `getJsDelivrBundles()`, so no learner today can be served `coi` even if their browser supports COOP/COEP. Reaching `coi` would require self-hosting AND enabling cross-origin isolation for the whole site — both meaningfully larger changes than this PR.

**Step 2 — wire-size per variant (local compression, jsDelivr URLs).**

| Variant | wasm raw | wasm gzip-9 | **wasm brotli-11** | worker gzip-9 | worker brotli-11 | **Wire total (br)** |
|---|---|---|---|---|---|---|
| `mvp` | 39.18 MB (41,086,840) | 8.71 MB (9,132,030) | **5.68 MB** (5,953,553) | 188 KB (193,052) | 156 KB (159,979) | **5.83 MB** |
| `eh`  | 34.08 MB (35,738,125) | 7.65 MB (8,016,608) | **5.05 MB** (5,293,795) | 184 KB (188,007) | 152 KB (155,859) | **5.20 MB** |
| `coi` (not via CDN) | 33.83 MB (35,477,476) | 7.71 MB (8,086,862) | 5.13 MB (5,376,804) | 200 KB (205,267) | 165 KB (169,398) | 5.29 MB |

**Differences relative to current default (`eh`):**

- `mvp` is **+12.1% larger** on the wire (br). Switching `mvp → eh` is the current default; reversing it is a loss.
- `coi` is **+1.7% larger** than `eh` on the wire and requires self-host + COI. Not a win on bytes.

**Steps 3 (Playwright compat check) and 4 (self-hosting evaluation) — not run.** The Step 2 numbers already rule out the variant-swap path by the decision criteria below; running Playwright against `mvp` would only confirm a regression we don't want to ship. Self-hosting is evaluated as a follow-up in the Recommendation section.

## Decision vs. criteria

| # | Criterion | Result | Notes |
|---|---|---|---|
| 1 | Reduces cold-start transfer ≥ 25% in Chrome stable | ❌ | Best alternative (`mvp`) is 12% *larger*; `coi` is also larger. The 25% gate is unachievable by variant swap. |
| 2 | `npm run audit:dialects` passes | n/a | Not exercised; criterion 1 fails first. |
| 3 | Playwright per-problem compat passes | n/a | Not exercised; criterion 1 fails first. |
| 4 | Reversible via 1-line revert in `lib/duckdb.ts` | ✅ | Would have been satisfied, but moot. |

**Verdict: variant-swap is not implementing.** The spec's framing assumed meaningful slack between bundles. Brotli closes that slack: the raw-byte gap (~5 MB between `mvp` and `eh`) collapses to ~0.6 MB after brotli, which is below the 25% threshold and far below the size of unrelated payload on a cold practice page.

## Recommendation

1. **Close out PR 3.4 as investigated-not-implementing.** This doc is the deliverable; no code change ships.
2. **Pivot the lever.** Two viable replacements for the same cold-start problem:
   - **PR 3.1 — Engine warm-up.** Kick the bundle fetch as soon as the learner lands on a practice route (or even on hover of a problem link from the list page), so the WASM is already in cache by the time `useProblemDB` runs. Telemetry harness is already in place to measure `engine.init.ready` deltas before/after.
   - **PR 3.3 — Service worker / asset precache.** Caches the bundle locally after first load, so repeat visits skip the wire entirely. Orthogonal to PR 3.1 and stackable.
3. **Self-hosting decision.** Independent of bundle size, self-hosting on Vercel gives us deterministic cache-control headers and removes the third-party CDN dependency. Defer this until either: (a) we observe a jsDelivr availability incident hitting real users, or (b) we ship the service worker precache (PR 3.3), at which point self-hosting becomes a precondition for confident cache management. Not blocking anything today.
4. **Document the finding loudly.** Roadmap update in `docs/superpowers/plans/2026-05-05-sql-engine-v2-roadmap.md` marks PR 3.4 ✅ investigated and deferred-from-implementation, with a forward link to PR 3.1 / 3.3.

## Reproduction

```bash
# Inventory
node -e "const d = require('@duckdb/duckdb-wasm'); console.log(Object.keys(d.getJsDelivrBundles()))"

# Sizes
cd node_modules/@duckdb/duckdb-wasm/dist/
for f in duckdb-{mvp,eh,coi}.wasm duckdb-browser-{mvp,eh,coi}.worker.js; do
  raw=$(wc -c < "$f" | tr -d ' ')
  gz=$(gzip -c -9 "$f" | wc -c | tr -d ' ')
  br=$(brotli -q 11 -c "$f" | wc -c | tr -d ' ')
  printf "%-45s raw=%10s gz=%10s br=%10s\n" "$f" "$raw" "$gz" "$br"
done
```

The numbers in the table above were captured from this exact command run on 2026-05-16 against `@duckdb/duckdb-wasm@1.33.1-dev45.0` (current `package-lock.json` lock).
