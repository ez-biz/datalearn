import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { computeCoverage, isWired, scriptNames } from "./check-ci-coverage"

describe("isWired", () => {
    it("matches an exact `npm run <name>` invocation", () => {
        assert.equal(isWired("test:contests", "run: npm run test:contests\n"), true)
    })

    it("does not treat a shorter script name as satisfied by a longer one that starts with it", () => {
        // Regression case: test:contest is a prefix of test:contests. A
        // naive `.includes("npm run test:contest")` check would wrongly
        // report test:contest as wired just because test:contests runs.
        const workflow = "run: npm run test:contests\n"
        assert.equal(isWired("test:contest", workflow), false)
        assert.equal(isWired("test:contests", workflow), true)
    })

    it("does not let a longer script name be satisfied by a shorter one it extends", () => {
        const workflow = "run: npm run test:contest\n"
        assert.equal(isWired("test:contests", workflow), false)
        assert.equal(isWired("test:contest", workflow), true)
    })

    it("matches when the invocation is followed by extra shell tokens", () => {
        assert.equal(
            isWired("test:article-publish-routes", "run: npm run test:article-publish-routes -- --foo\n"),
            true
        )
    })

    it("matches inside a multi-line `run: |` block", () => {
        const workflow = [
            "      - name: Grouped",
            "        run: |",
            "            npm run test:contest-locks",
            "            npm run test:contests",
            "",
        ].join("\n")
        assert.equal(isWired("test:contest-locks", workflow), true)
        assert.equal(isWired("test:contests", workflow), true)
    })

    it("does not match a script name mentioned only in a comment or step name, not a run line", () => {
        const workflow = "      - name: about test:contests\n        run: echo hi\n"
        assert.equal(isWired("test:contests", workflow), false)
    })
})

describe("scriptNames", () => {
    it("keeps only test:/check:/audit:/verify: prefixed scripts", () => {
        const pkg = JSON.stringify({
            scripts: {
                dev: "next dev",
                "test:foo": "tsx foo.ts",
                "check:bar": "tsx bar.ts",
                "audit:baz": "tsx baz.ts",
                "verify:qux": "tsx qux.ts",
                "seed:analyst-track": "tsx prisma/seed-analyst-track.ts",
                "build:contest-worker": "tsup ...",
            },
        })
        assert.deepEqual(scriptNames(pkg), [
            "test:foo",
            "check:bar",
            "audit:baz",
            "verify:qux",
        ])
    })
})

describe("computeCoverage", () => {
    it("flags a script that is neither wired nor allowlisted", () => {
        const result = computeCoverage(
            ["test:known", "test:orphan"],
            "run: npm run test:known\n",
            {}
        )
        assert.deepEqual(result.missing, ["test:orphan"])
        assert.deepEqual(result.wired, ["test:known"])
    })

    it("does not flag an allowlisted script as missing", () => {
        const result = computeCoverage(
            ["test:deliberately-skipped"],
            "",
            { "test:deliberately-skipped": "reason" }
        )
        assert.deepEqual(result.missing, [])
        assert.deepEqual(result.allowlisted, ["test:deliberately-skipped"])
    })

    it("flags a script that is both wired and allowlisted as redundant", () => {
        const result = computeCoverage(
            ["test:double-booked"],
            "run: npm run test:double-booked\n",
            { "test:double-booked": "reason" }
        )
        assert.deepEqual(result.redundant, ["test:double-booked"])
    })

    it("flags an allowlist entry with no matching package.json script as stale", () => {
        const result = computeCoverage(
            ["test:current"],
            "run: npm run test:current\n",
            { "test:renamed-away": "reason" }
        )
        assert.deepEqual(result.stale, ["test:renamed-away"])
    })

    it("the prefix regression also holds through computeCoverage", () => {
        const result = computeCoverage(
            ["test:contest", "test:contests"],
            "run: npm run test:contests\n",
            {}
        )
        assert.deepEqual(result.wired, ["test:contests"])
        assert.deepEqual(result.missing, ["test:contest"])
    })
})
