# Per-dialect solutions & expectedOutputs (Option 3)

> **Status**: shipped as `v0.4.2` (PR #65 + #66). The cleanup pass that drops legacy `solutionSql` / `expectedOutput` columns is a future patch release. The body below preserves the original `v0.5.0` / `v0.5.1` version targets for historical context — the release version differed because we treated this as a polish on top of `v0.4.1` rather than a feature minor bump.

## Goal

Move from "one canonical solution + one expectedOutput, hopefully portable" to "per-dialect canonical solution + per-dialect expectedOutput." Each engine in `dialects[]` gets its own first-class entry. Future engines (SQLite via sql.js, eventually MySQL when WASM lands) drop in cleanly.

## Non-goals

- Adding MySQL or SQLite engines themselves (separate work; this plan makes it possible, doesn't deliver it)
- Changing learner-side workspace beyond passing the selected dialect to validation
- New features — purely an architecture change

## Schema

`prisma/schema.prisma`:
- ADD `solutions Json @default("{}")` — `{ "DUCKDB": "SELECT …", "POSTGRES": "…" }`
- ADD `expectedOutputs Json @default("{}")` — same key shape, JSON-array string values
- KEEP `solutionSql String?`, `expectedOutput String` for the v0.5.0 release (back-compat)
- DROP both old columns in v0.5.1

Invariants enforced at the API/Zod layer:
- Every key in `solutions`/`expectedOutputs` must be a valid `Dialect`
- Every dialect listed in `dialects[]` must have a corresponding `solutions[d]` + `expectedOutputs[d]` (only enforced for `status: PUBLISHED`)
- Each `expectedOutputs[d]` must parse as a JSON array

## Sequencing

### Release v0.5.0 (additive)

1. Schema migration: add new columns
2. Backfill: copy `solutionSql` → `solutions[d]` and `expectedOutput` → `expectedOutputs[d]` for every dialect listed
3. Zod schemas accept both shapes; refine ensures consistency
4. API routes write to BOTH old and new columns; GET projection includes both
5. `validateSubmission(slug, userResult, dialect)` reads `expectedOutputs[dialect]` with fallback to `expectedOutput`
6. Workspace passes selected dialect to validation
7. Admin form: per-dialect tabs (auto-copy DUCKDB → POSTGRES on enable; PUBLISHED gate strictly enforced)
8. MCP tools: new shape on input/output; old shape accepted with a deprecation warning
9. Audit script: `audit-all-dialects.ts` covers per-dialect correctness + cross-dialect equivalence
10. Tag `v0.5.0`. Soak ~1 week.

### Release v0.5.1 (cleanup)

11. Drop `solutionSql`, `expectedOutput` columns
12. Remove backward-compat code paths
13. Strict Zod (no fallback)
14. Tag `v0.5.1`

## Decisions (defaults applied)

| Question | Decision |
|---|---|
| MCP back-compat window | Until v0.5.1; old shape accepted with deprecation warning, then rejected |
| Auto-copy when adding a dialect mid-edit | Yes — copy first available dialect's solution into the new slot |
| PUBLISHED gate | Strictly enforce — every listed dialect must have non-empty solution + expectedOutput |
| Field naming | `solutions` and `expectedOutputs` (plural) |
| MCP migration tool | None — change input shape only |

## Risks

| Risk | Mitigation |
|---|---|
| 11 of 23 seeded problems have NULL solutionSql | Backfill leaves `solutions[d] = ""`; PUBLISHED gate trips on those, but they're already PUBLISHED with NULL — handle by allowing empty values for already-PUBLISHED, only gate new transitions to PUBLISHED |
| Live submissions during transition | Backward-compat fallback in validateSubmission |
| MCP authoring breaks | Both shapes accepted; deprecation warning |
| Cross-dialect drift slips through | Audit script catches at publish time |
| Admin-form UI rebuild large | Splittable: per-dialect read-only first, then per-dialect input |

## Effort

~16–20 focused hours. ~1 week soak. Schema migration is additive, so safe to ship intermediate states.
