export type Row = Record<string, unknown>

export type ValidationResult =
    | { ok: true }
    | {
          ok: false
          reason: string
          diff?: {
              userKeys?: string[]
              expectedKeys?: string[]
              firstMismatch?: { index: number; user: Row; expected: Row }
          }
      }

const EPSILON = 1e-9

function isRowArray(value: unknown): value is Row[] {
    if (!Array.isArray(value)) return false
    return value.every(
        (r) => r !== null && typeof r === 'object' && !Array.isArray(r)
    )
}

function sameKeySet(a: Row, b: Row): boolean {
    const ak = Object.keys(a)
    const bk = Object.keys(b)
    if (ak.length !== bk.length) return false
    const bSet = new Set(bk)
    return ak.every((k) => bSet.has(k))
}

function normalizeCell(v: unknown): unknown {
    if (v === null || v === undefined) return null
    if (typeof v === 'string') {
        const trimmed = v.trim()
        if (trimmed === '') return ''
        if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
            const asNum = Number(trimmed)
            if (!Number.isNaN(asNum)) return asNum
        }
        return trimmed
    }
    if (typeof v === 'bigint') {
        if (
            v <= BigInt(Number.MAX_SAFE_INTEGER) &&
            v >= BigInt(Number.MIN_SAFE_INTEGER)
        ) {
            return Number(v)
        }
        return v.toString()
    }
    // Date objects must be handled BEFORE the generic toString() path
    // below — Date.toString() returns the locale string ("Sun Jan 15 2023
    // 05:30:00 GMT+0530…"), not ISO. PGlite returns Date instances for
    // DATE / TIMESTAMP columns, so without this branch every cross-dialect
    // date comparison would silently fail.
    if (v instanceof Date) {
        return Number.isNaN(v.getTime()) ? null : v.toISOString()
    }
    if (typeof v === 'object' && v !== null && 'toString' in v) {
        return (v as { toString(): string }).toString()
    }
    return v
}

/**
 * Coerce a cell to a canonical ISO 8601 datetime string when it
 * plausibly represents a date or timestamp; otherwise return null.
 *
 * Bridges cross-dialect date serialization:
 * - DuckDB-WASM emits dates as epoch milliseconds (number)
 * - PGlite emits dates as ISO 8601 strings
 * - Native Postgres clients (e.g. node-pg) sometimes emit `Date` objects
 *
 * Same `expectedOutput` JSON should match a learner's query regardless
 * of which engine they ran it in. Without this, capturing
 * `expectedOutput` in one engine breaks the other.
 *
 * Conservative on what counts as a "date" — only ISO-shaped strings
 * (`YYYY-MM-DD…`) and numbers in a plausible epoch range
 * (year 2000 to year 3000, both seconds and ms units) qualify. A
 * number like `1` won't be misread as 1970.
 */
function toIsoIfDate(v: unknown): string | null {
    if (v instanceof Date) {
        return Number.isNaN(v.getTime()) ? null : v.toISOString()
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
        // Year 2000 (946684800) to year 3000 (32503680000) in seconds,
        // or the same range in milliseconds.
        if (v >= 946_684_800_000 && v <= 32_503_680_000_000) {
            return new Date(v).toISOString()
        }
        if (v >= 946_684_800 && v <= 32_503_680_000) {
            return new Date(v * 1000).toISOString()
        }
        return null
    }
    if (typeof v === 'string') {
        // ISO 8601 date or datetime — leading YYYY-MM-DD with optional
        // T or space separator. Reject otherwise to keep regular strings
        // (UUIDs, names) out of the date path.
        if (/^\d{4}-\d{2}-\d{2}([T ]|$)/.test(v)) {
            const d = new Date(v)
            if (!Number.isNaN(d.getTime())) return d.toISOString()
        }
    }
    return null
}

function cellEqual(a: unknown, b: unknown): boolean {
    const na = normalizeCell(a)
    const nb = normalizeCell(b)
    if (na === null && nb === null) return true
    if (na === null || nb === null) return false
    if (typeof na === 'number' && typeof nb === 'number') {
        if (Number.isNaN(na) && Number.isNaN(nb)) return true
        return Math.abs(na - nb) < EPSILON
    }
    if (typeof na === 'number' && typeof nb === 'string') {
        const nbAsNum = Number(nb)
        if (!Number.isNaN(nbAsNum)) return Math.abs(na - nbAsNum) < EPSILON
    }
    if (typeof nb === 'number' && typeof na === 'string') {
        const naAsNum = Number(na)
        if (!Number.isNaN(naAsNum)) return Math.abs(naAsNum - nb) < EPSILON
    }
    if (na === nb) return true
    // Last-resort fallback: cross-dialect date equivalence. Run AFTER
    // exact-match so non-date strings/numbers compare unchanged.
    const aIso = toIsoIfDate(na)
    const bIso = toIsoIfDate(nb)
    if (aIso !== null && bIso !== null && aIso === bIso) return true
    return false
}

function rowEqual(a: Row, b: Row): boolean {
    for (const key of Object.keys(a)) {
        if (!cellEqual(a[key], b[key])) return false
    }
    return true
}

function canonicalCell(v: unknown): unknown {
    const n = normalizeCell(v)
    // Date-like values canonicalize to ISO 8601 so unordered comparison
    // matches whatever cellEqual matches (DuckDB epoch ms, PGlite ISO
    // string, and native Date objects all collapse to one form).
    const iso = toIsoIfDate(n)
    if (iso !== null) return iso
    // Numbers get rounded to a stable precision so that values within
    // EPSILON canonicalize to the same string (otherwise unordered
    // comparison via JSON.stringify would treat 0.3 and 0.30000000000000004
    // as different rows even though cellEqual considers them equal).
    if (typeof n === 'number' && Number.isFinite(n)) {
        return Math.round(n * 1e9) / 1e9
    }
    return n
}

function canonicalRowString(r: Row): string {
    const keys = Object.keys(r).sort()
    return JSON.stringify(keys.map((k) => [k, canonicalCell(r[k])]))
}

export function compareResults(
    user: unknown,
    expected: unknown,
    opts: { ordered: boolean }
): ValidationResult {
    if (!isRowArray(user)) {
        return { ok: false, reason: 'Your result is not an array of rows.' }
    }
    if (!isRowArray(expected)) {
        return {
            ok: false,
            reason: 'Expected output is malformed. Report this problem.',
        }
    }

    if (user.length === 0 && expected.length === 0) {
        return { ok: true }
    }

    if (user.length !== expected.length) {
        return {
            ok: false,
            reason: `Row count mismatch — got ${user.length}, expected ${expected.length}.`,
        }
    }

    const userKeys = Object.keys(user[0] ?? {})
    const expectedKeys = Object.keys(expected[0] ?? {})
    if (!sameKeySet(user[0] ?? {}, expected[0] ?? {})) {
        return {
            ok: false,
            reason: `Column mismatch — got [${userKeys.join(',')}], expected [${expectedKeys.join(',')}].`,
            diff: { userKeys, expectedKeys },
        }
    }

    if (opts.ordered) {
        for (let i = 0; i < expected.length; i++) {
            if (!rowEqual(user[i], expected[i])) {
                return {
                    ok: false,
                    reason: `Row ${i + 1} differs from expected.`,
                    diff: {
                        firstMismatch: {
                            index: i,
                            user: user[i],
                            expected: expected[i],
                        },
                    },
                }
            }
        }
        return { ok: true }
    }

    const userCanon = user.map(canonicalRowString).sort()
    const expectedCanon = expected.map(canonicalRowString).sort()
    for (let i = 0; i < userCanon.length; i++) {
        if (userCanon[i] !== expectedCanon[i]) {
            return {
                ok: false,
                reason:
                    'Rows do not match (order-insensitive). Check values and row count (duplicates are counted).',
            }
        }
    }
    return { ok: true }
}
