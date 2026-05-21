import assert from "node:assert/strict"
import DOMPurify from "isomorphic-dompurify"

const PURIFY_CONFIG = {
    USE_PROFILES: { svg: true, svgFilters: false },
    FORBID_TAGS: ["script", "foreignObject"],
    FORBID_ATTR: ["href", "xlink:href", "style"],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#)/i,
}

function purify(svg: string): string {
    return DOMPurify.sanitize(svg, PURIFY_CONFIG)
}

const cases: { name: string; input: string; mustNotContain: string[] }[] = [
    {
        name: "script tag stripped",
        input: `<svg><script>alert(1)</script><rect width="10" height="10"/></svg>`,
        mustNotContain: ["<script>", "alert(1)"],
    },
    {
        name: "onclick attribute stripped",
        input: `<svg><rect onclick="alert(1)" width="10" height="10"/></svg>`,
        mustNotContain: ["onclick", "alert(1)"],
    },
    {
        name: "foreignObject stripped",
        input: `<svg><foreignObject><iframe src="javascript:alert(1)"/></foreignObject></svg>`,
        mustNotContain: ["<foreignObject", "<iframe", "javascript:"],
    },
    {
        name: "xlink:href stripped",
        input: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><a xlink:href="javascript:alert(1)"><text>click</text></a></svg>`,
        mustNotContain: ["xlink:href", "javascript:"],
    },
    {
        name: "style attribute stripped",
        input: `<svg><rect style="background:url(javascript:alert(1))" width="10" height="10"/></svg>`,
        mustNotContain: ["style=", "javascript:"],
    },
]

for (const testCase of cases) {
    const output = purify(testCase.input)
    for (const banned of testCase.mustNotContain) {
        assert.ok(
            !output.includes(banned),
            `case "${testCase.name}": still contains ${banned}: ${output}`
        )
    }
}

const benign = purify(
    `<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="red"/></svg>`
)
assert.ok(benign.includes("<rect"), "benign rect survived")

console.log("test-mermaid-sanitization PASS")
