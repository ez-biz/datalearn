import assert from "node:assert/strict"
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
                    'className="bg-primary border-l-primary ring-offset-background"',
                    'className="bg-transparent text-sm border-dashed border-l-transparent border-l-2"',
                ].join("\n"),
            }],
        )

        assert.equal(result.candidateCount, 8)
        assert.deepEqual(result.findings, [])
    })

    it("rejects a stylesheet without an @theme inline block", () => {
        assert.throws(
            () => themeInlineNames(":root { --primary: 0 0% 0%; }"),
            /no @theme inline block found/,
        )
    })
})
