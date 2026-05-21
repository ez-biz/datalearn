import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkDirective from "remark-directive"
import { visit } from "unist-util-visit"
import assert from "node:assert/strict"
import { remarkBlockDirectives } from "../lib/markdown/remark-block-directives"

function run(markdown: string) {
    const processor = unified()
        .use(remarkParse)
        .use(remarkDirective)
        .use(remarkBlockDirectives)
    const tree = processor.parse(markdown)
    return processor.runSync(tree)
}

function tagsIn(tree: unknown): string[] {
    const tags: string[] = []
    visit(tree, (node: any) => {
        const hName = node.data?.hName
        if (hName) tags.push(hName)
    })
    return tags
}

const cases: { name: string; markdown: string; expectTags: string[] }[] = [
    {
        name: "figure",
        markdown: `:::figure{src="/learn/x.svg" alt="hi"}\nbody\n:::`,
        expectTags: ["dl-figure"],
    },
    {
        name: "mermaid",
        markdown: `:::mermaid{alt="flow"}\nflowchart LR\n  A --> B\n:::`,
        expectTags: ["dl-mermaid"],
    },
    {
        name: "steps",
        markdown: `:::steps\n1. **First** body\n2. **Second** body\n:::`,
        expectTags: ["dl-steps"],
    },
    {
        name: "side-by-side",
        markdown: `:::side-by-side\n### A\nleft\n\n---\n\n### B\nright\n:::`,
        expectTags: ["dl-side-by-side"],
    },
    {
        name: "callout",
        markdown: `:::callout{kind="pitfall"}\nwatch out\n:::`,
        expectTags: ["dl-callout"],
    },
    {
        name: "all five together",
        markdown: `:::figure{src="/learn/a.svg" alt="a"}\nx\n:::\n\n:::mermaid{alt="b"}\nflowchart LR\n  A --> B\n:::\n\n:::steps\n1. **One** body\n:::\n\n:::side-by-side\nleft\n\n---\n\nright\n:::\n\n:::callout\nnote\n:::`,
        expectTags: [
            "dl-figure",
            "dl-mermaid",
            "dl-steps",
            "dl-side-by-side",
            "dl-callout",
        ],
    },
]

for (const testCase of cases) {
    const tags = tagsIn(run(testCase.markdown))
    assert.deepEqual(
        tags,
        testCase.expectTags,
        `case "${testCase.name}": expected ${JSON.stringify(
            testCase.expectTags
        )}, got ${JSON.stringify(tags)}`
    )
}

const legacy = run("# Heading\n\nParagraph with `code` and **bold**.")
assert.deepEqual(tagsIn(legacy), [], "legacy markdown produces no dl-* tags")

console.log("test-directive-renderer PASS")
