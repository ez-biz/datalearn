import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
    mkdirSync,
    mkdtempSync,
    rmSync,
    writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { describe, it } from "node:test"
import {
    findUnmappedUtilities,
    themeInlineNames,
} from "./check-theme-utilities"

const CSS = `
@theme inline {
  --color-background: hsl(var(--background));
  --color-primary: hsl(var(--primary));
}
`
const GUARD = resolve("scripts/check-theme-utilities.ts")

describe("theme utility mapping guard", () => {
    it("reports an unknown colour utility with its file and line", () => {
        const result = findUnmappedUtilities(
            themeInlineNames(CSS),
            [{
                path: "fixture.tsx",
                source: 'const node = <div className="bg-definitely-not-a-token" />',
            }],
        )

        assert.equal(result.candidateCount, 1)
        assert.deepEqual(result.findings, [
            "fixture.tsx:1  bg-definitely-not-a-token",
        ])
    })

    it("accepts mapped tokens through directional and offset utilities", () => {
        const result = findUnmappedUtilities(
            themeInlineNames(CSS),
            [{
                path: "mapped.tsx",
                source: [
                    "export const Mapped = () => (",
                    '  <div className="bg-primary border-l-primary ring-offset-background bg-transparent text-sm border-dashed border-l-transparent border-l-2" />',
                    ")",
                ].join("\n"),
            }],
        )

        assert.equal(result.candidateCount, 3)
        assert.deepEqual(result.findings, [])
    })

    it(
        "fails through the CLI when the filesystem tree contains an unmapped utility",
        () => {
            const root = mkdtempSync(join(tmpdir(), "datalearn-theme-utilities-"))
            try {
                for (const dir of ["app", "components", "lib"]) {
                    mkdirSync(join(root, dir), { recursive: true })
                }
                writeFileSync(join(root, "app/globals.css"), CSS)
                writeFileSync(
                    join(root, "components/Fixture.tsx"),
                    'export const Fixture = () => <div className="bg-cli-fixture-missing" />',
                )

                const child = spawnSync(
                    process.execPath,
                    ["--import", "tsx", GUARD, "--root", root],
                    { cwd: process.cwd(), encoding: "utf8" },
                )

                assert.equal(child.status, 1, child.stderr)
                assert.match(
                    child.stderr,
                    /components\/Fixture\.tsx:1  bg-cli-fixture-missing/,
                )
            } finally {
                rmSync(root, { recursive: true, force: true })
            }
        },
    )

    it("ignores comments and prose strings outside class-bearing expressions", () => {
        const result = findUnmappedUtilities(
            themeInlineNames(CSS),
            [{
                path: "noise.tsx",
                source: [
                    "// Remove bg-comment-stale after the migration.",
                    'const note = "Do not use bg-prose-stale in new UI"',
                    'export const Node = () => <div className="bg-primary" />',
                ].join("\n"),
            }],
        )

        assert.equal(result.candidateCount, 1)
        assert.deepEqual(result.findings, [])
    })

    it(
        "ignores arbitrary transition properties but rejects the same text as a class",
        () => {
            const result = findUnmappedUtilities(
                themeInlineNames(CSS),
                [{
                    path: "tokens.tsx",
                    source: 'export const Node = () => <div className="transition-[border-color] border-color" />',
                }],
            )

            assert.equal(result.candidateCount, 1)
            assert.deepEqual(result.findings, ["tokens.tsx:1  border-color"])
        },
    )

    it("rejects a stylesheet without an @theme inline block", () => {
        assert.throws(
            () => themeInlineNames(":root { --primary: 0 0% 0%; }"),
            /no @theme inline block found/,
        )
    })
})
