// Guard: every test:/check:/audit:/verify: script in package.json must
// either run in .github/workflows/test.yml or be listed in ALLOWLIST below
// with a reason.
//
// Why this exists: a 2026-08 audit found 34 of 77 such scripts had never
// once run in CI -- flagged during SP4, flagged again during SP6, never
// closed, because nobody could tell which omissions were deliberate. This
// guard makes that drift a CI failure instead of a rediscoverable mystery.
//
// A script name must match as a *whole* `npm run <name>` invocation, not as
// a substring of a longer script name -- `test:contest` must not be
// satisfied by a workflow line that only runs `test:contests`. See
// isWired() and scripts/test-check-ci-coverage.ts for the boundary case.
//
// Run: npm run check:ci-coverage

import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

const PACKAGE_JSON = "package.json"
const WORKFLOW = ".github/workflows/test.yml"
const SCRIPT_PREFIX_RE = /^(test|check|audit|verify):/

/**
 * Scripts deliberately excluded from CI. Every entry needs a reason a
 * reader can act on without archaeology -- "why not" and "what would have
 * to change for this to be wired in."
 *
 * An entry here must NOT also be wired into the workflow (computeCoverage
 * flags that as `redundant` -- pick one), and must correspond to a real
 * package.json script (a rename or removal without updating this list
 * shows up as `stale`).
 */
export const ALLOWLIST: Record<string, string> = {
    "audit:tags:prod": [
        "Runs scripts/audit-tags-prod.sh, which points at the production",
        "database on purpose (it's the whole point of the script). Must",
        "never run in CI. Use audit:tags (already wired) for the CI-safe,",
        "local-database version of the same audit.",
    ].join(" "),

    "test:e2e:ui": [
        "Playwright's interactive UI mode (`playwright test --ui`). It opens",
        "a UI and waits on it -- there is no headless exit, so it would hang",
        "a CI runner until the job timeout killed it. test:e2e (already",
        "wired) is the headless equivalent used in CI.",
    ].join(" "),

    "audit:dialects": [
        "Byte-identical to audit:dialects:ci -- both run",
        "`tsx scripts/audit-all-dialects.ts` with no argument or environment",
        "difference between them. audit:dialects:ci is already wired as the",
        "\"Audit SQL dialect outputs\" step; audit:dialects is kept only as a",
        "shorter local-dev alias. Wiring both would duplicate the same work",
        "for zero additional coverage. If the two scripts ever diverge,",
        "audit:dialects needs its own CI step and this entry should go.",
    ].join(" "),
}

export interface CoverageResult {
    total: number
    wired: string[]
    allowlisted: string[]
    missing: string[]
    redundant: string[]
    stale: string[]
}

export function scriptNames(packageJsonText: string): string[] {
    const pkg = JSON.parse(packageJsonText) as {
        scripts?: Record<string, string>
    }
    return Object.keys(pkg.scripts ?? {}).filter((name) =>
        SCRIPT_PREFIX_RE.test(name)
    )
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * True when `name` appears as a whole `npm run <name>` invocation somewhere
 * in the workflow text. The lookahead requires the match not be followed by
 * another script-name character, so `npm run test:contest` never counts as
 * satisfying `test:contests` (or vice versa) just because one is a prefix
 * of the other.
 */
export function isWired(name: string, workflowText: string): boolean {
    const pattern = new RegExp(`npm run ${escapeRegExp(name)}(?![\\w:-])`)
    return pattern.test(workflowText)
}

export function computeCoverage(
    names: string[],
    workflowText: string,
    allowlist: Record<string, string>
): CoverageResult {
    const nameSet = new Set(names)
    const wired: string[] = []
    const missing: string[] = []
    const redundant: string[] = []

    for (const name of names) {
        const wiredHere = isWired(name, workflowText)
        const allowlisted = name in allowlist
        if (wiredHere) wired.push(name)
        if (wiredHere && allowlisted) redundant.push(name)
        if (!wiredHere && !allowlisted) missing.push(name)
    }

    const allowlisted = Object.keys(allowlist).filter((name) =>
        nameSet.has(name)
    )
    const stale = Object.keys(allowlist).filter((name) => !nameSet.has(name))

    return { total: names.length, wired, allowlisted, missing, redundant, stale }
}

function main(): number {
    const packageJsonText = readFileSync(
        resolve(process.cwd(), PACKAGE_JSON),
        "utf8"
    )
    const workflowText = readFileSync(resolve(process.cwd(), WORKFLOW), "utf8")
    const names = scriptNames(packageJsonText)
    const result = computeCoverage(names, workflowText, ALLOWLIST)

    let ok = true

    if (result.missing.length > 0) {
        ok = false
        console.error(
            "The following scripts run neither in CI nor appear in the allowlist:"
        )
        for (const name of result.missing) console.error(`  - ${name}`)
        console.error(
            "\nEither wire it into .github/workflows/test.yml or add it to " +
                "ALLOWLIST in scripts/check-ci-coverage.ts with a reason."
        )
    }

    if (result.redundant.length > 0) {
        ok = false
        console.error(
            "\nThe following scripts are both wired into CI and listed in the " +
                "allowlist -- pick one:"
        )
        for (const name of result.redundant) console.error(`  - ${name}`)
    }

    if (result.stale.length > 0) {
        ok = false
        console.error(
            "\nThe following allowlist entries no longer match a package.json " +
                "script (rename/removal drift) -- remove or update them:"
        )
        for (const name of result.stale) console.error(`  - ${name}`)
    }

    if (ok) {
        console.log(
            `check-ci-coverage PASS: ${result.total} scripts tracked ` +
                `(${result.wired.length} wired in CI, ${result.allowlisted.length} allowlisted)`
        )
    }

    return ok ? 0 : 1
}

const entry = process.argv[1]
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
    process.exitCode = main()
}
