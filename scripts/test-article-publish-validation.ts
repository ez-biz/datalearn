import assert from "node:assert/strict"
import { validateArticleDirectivesSyntactic } from "../lib/admin-validation"

const ok = validateArticleDirectivesSyntactic(
    `:::figure{src="/learn/a.svg" alt="a"}\nx\n:::\n\n:::callout{kind="tip"}\nhi\n:::`
)
assert.equal(ok.ok, true, JSON.stringify(ok.errors))
assert.equal(ok.hasVisualBlocks, true)
assert.deepEqual(ok.figureUrls, ["/learn/a.svg"])

const noAlt = validateArticleDirectivesSyntactic(
    `:::figure{src="/learn/a.svg"}\n:::`
)
assert.equal(noAlt.ok, false)
assert.ok(
    noAlt.errors.some((error) => error.message.includes("alt is required"))
)

const external = validateArticleDirectivesSyntactic(
    `:::figure{src="https://evil.com/x.png" alt="x"}\n:::`
)
assert.equal(external.ok, false)
assert.ok(
    external.errors.some((error) =>
        error.message.includes("not in the allowlist")
    )
)

const blob = validateArticleDirectivesSyntactic(
    `:::figure{src="https://store.vercel-storage.com/learn/abc.svg" alt="x"}\n:::`
)
assert.equal(blob.ok, true, JSON.stringify(blob.errors))
assert.deepEqual(blob.figureUrls, [
    "https://store.vercel-storage.com/learn/abc.svg",
])

const mermaidNoAlt = validateArticleDirectivesSyntactic(
    `:::mermaid\nflowchart LR\nA-->B\n:::`
)
assert.equal(mermaidNoAlt.ok, false)
assert.ok(
    mermaidNoAlt.errors.some(
        (error) =>
            error.directive === "mermaid" &&
            error.message.includes("alt is required")
    )
)

const badKind = validateArticleDirectivesSyntactic(
    `:::callout{kind="oops"}\nx\n:::`
)
assert.equal(badKind.ok, false)
assert.ok(
    badKind.errors.some(
        (error) =>
            error.directive === "callout" &&
            error.message.includes("must be one of")
    )
)

const sideBySideNoBreak = validateArticleDirectivesSyntactic(
    `:::side-by-side\nleft\nright\n:::`
)
assert.equal(sideBySideNoBreak.ok, false)
assert.ok(
    sideBySideNoBreak.errors.some(
        (error) =>
            error.directive === "side-by-side" &&
            error.message.includes("exactly one")
    )
)

const sideBySideOneBreak = validateArticleDirectivesSyntactic(
    `:::side-by-side\nleft\n\n---\n\nright\n:::`
)
assert.equal(sideBySideOneBreak.ok, true, JSON.stringify(sideBySideOneBreak.errors))

const legacy = validateArticleDirectivesSyntactic("# Just a heading\n\nParagraph.")
assert.equal(legacy.ok, true)
assert.equal(legacy.hasVisualBlocks, false)
assert.deepEqual(legacy.figureUrls, [])

console.log("test-article-publish-validation PASS")
