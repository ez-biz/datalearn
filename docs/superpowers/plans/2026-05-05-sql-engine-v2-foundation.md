# SQL Engine v2 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a shared browser SQL engine layer while preserving the existing DuckDB-WASM and PGlite workspace behavior.

**Architecture:** Add `lib/sql-engine/` for pure row normalization and browser engine session creation. Keep `useProblemDB` as the React lifecycle wrapper, and keep query safety enforced through the existing `checkReadOnlyQuery()` guard.

**Tech Stack:** Next.js 16 App Router, React client hook, DuckDB-WASM, PGlite, TypeScript, Node built-in test/assert.

---

### Task 1: Shared Row Normalization

**Files:**
- Create: `lib/sql-engine/normalize.ts`
- Create: `scripts/test-sql-engine-normalize.mjs`

- [ ] **Step 1: Write the failing normalization test**

Create `scripts/test-sql-engine-normalize.mjs` with explicit `.ts` imports so it can run in Node 25 without `tsx`:

```js
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    normalizeSqlCell,
    normalizeSqlRow,
    normalizeSqlRows,
} from "../lib/sql-engine/normalize.ts"

describe("SQL engine row normalization", () => {
    it("turns nullish values into null", () => {
        assert.equal(normalizeSqlCell(null), null)
        assert.equal(normalizeSqlCell(undefined), null)
    })

    it("serializes Date values as ISO strings", () => {
        assert.equal(
            normalizeSqlCell(new Date("2026-01-02T03:04:05.000Z")),
            "2026-01-02T03:04:05.000Z"
        )
    })

    it("keeps safe bigints numeric and unsafe bigints stringified", () => {
        assert.equal(normalizeSqlCell(42n), 42)
        assert.equal(
            normalizeSqlCell(BigInt(Number.MAX_SAFE_INTEGER) + 2n),
            "9007199254740993"
        )
    })

    it("normalizes every row cell without mutating the input", () => {
        const original = {
            id: 1n,
            created_at: new Date("2026-05-05T10:00:00.000Z"),
            missing: undefined,
        }
        const normalized = normalizeSqlRow(original)
        assert.deepEqual(normalized, {
            id: 1,
            created_at: "2026-05-05T10:00:00.000Z",
            missing: null,
        })
        assert.equal(typeof original.id, "bigint")
    })

    it("normalizes arrays of rows", () => {
        assert.deepEqual(normalizeSqlRows([{ id: 1n }, { id: 2n }]), [
            { id: 1 },
            { id: 2 },
        ])
    })
})
```

Run:

```bash
node --test scripts/test-sql-engine-normalize.mjs
```

Expected: fail with module not found for `lib/sql-engine/normalize.ts`.

- [ ] **Step 2: Implement normalization**

Create `lib/sql-engine/normalize.ts`:

```ts
export type SqlRow = Record<string, unknown>

export function normalizeSqlCell(value: unknown): unknown {
    if (value === null || value === undefined) return null

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString()
    }

    if (typeof value === "bigint") {
        if (
            value <= BigInt(Number.MAX_SAFE_INTEGER) &&
            value >= BigInt(Number.MIN_SAFE_INTEGER)
        ) {
            return Number(value)
        }
        return value.toString()
    }

    if (typeof value === "object" && value !== null) {
        const maybeJson = value as { toJSON?: () => unknown }
        if (typeof maybeJson.toJSON === "function") {
            return normalizeSqlCell(maybeJson.toJSON())
        }

        const rendered = String(value)
        if (rendered !== "[object Object]") return rendered
    }

    return value
}

export function normalizeSqlRow(row: SqlRow): SqlRow {
    return Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
            key,
            normalizeSqlCell(value),
        ])
    )
}

export function normalizeSqlRows(rows: SqlRow[]): SqlRow[] {
    return rows.map(normalizeSqlRow)
}
```

- [ ] **Step 3: Verify green**

Run:

```bash
node --test scripts/test-sql-engine-normalize.mjs
```

Expected: all tests pass.

### Task 2: Browser Engine Session Factory

**Files:**
- Create: `lib/sql-engine/browser-session.ts`
- Modify: `lib/use-problem-db.ts`

- [ ] **Step 1: Add the session interface and factory**

Create `lib/sql-engine/browser-session.ts` with:

```ts
import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm"
import type { PGlite } from "@electric-sql/pglite"
import { checkReadOnlyQuery } from "@/lib/sql-restrict"
import { normalizeSqlRows, type SqlRow } from "@/lib/sql-engine/normalize"
import type { Dialect } from "@/lib/use-problem-db"

export interface SqlEngineSession {
    dialect: Dialect
    runQuery(sql: string): Promise<SqlRow[]>
    dispose(): Promise<void>
}
```

Then add DuckDB/PGlite implementations inside the same file so the behavior is reviewable in one place.

- [ ] **Step 2: Move engine initialization out of the React hook**

Update `useProblemDB` to call `createSqlEngineSession({ dialect, schemaSql })`, keep only `ready`, `error`, and a `sessionRef`.

- [ ] **Step 3: Verify no behavior change**

Run:

```bash
npm run lint
node --input-type=module -e 'const { checkReadOnlyQuery } = await import("./lib/sql-restrict.ts"); const cases = [["SELECT 1", true], ["DROP TABLE users", false], ["WITH x AS (DELETE FROM users RETURNING *) SELECT * FROM x", false]]; for (const [sql, ok] of cases) { const result = checkReadOnlyQuery(sql); if (result.ok !== ok) throw new Error(sql); } console.log("sql guard smoke checks pass");'
```

Expected: lint exits 0 and smoke checks pass.

### Task 3: Documentation and Review

**Files:**
- Modify: `docs/TECHNICAL_DESIGN.md`
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Document SQL engine boundary**

Update the SQL execution section to mention `lib/sql-engine/` as the browser engine abstraction and `useProblemDB` as lifecycle-only.

- [ ] **Step 2: Document shipped foundation**

Add a short ROADMAP entry for SQL Engine v2 foundation once implementation passes verification.

- [ ] **Step 3: Final verification**

Run:

```bash
node --test scripts/test-sql-engine-normalize.mjs
npm run lint
git diff --check
```

Expected: tests pass, lint exits 0, no whitespace errors.
