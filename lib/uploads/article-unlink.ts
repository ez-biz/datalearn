import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkStringify from "remark-stringify"
import remarkDirective from "remark-directive"
import { SKIP, visit } from "unist-util-visit"
import type { Node } from "unist"

const VISUAL_DIRECTIVES = new Set([
    "figure",
    "mermaid",
    "steps",
    "side-by-side",
    "callout",
])

export function stripFigureByUrl(content: string, targetUrl: string): string {
    const processor = unified().use(remarkParse).use(remarkDirective)
    const tree = processor.parse(content) as Node

    visit(tree, (node: any, index, parent) => {
        if (
            node.type === "containerDirective" &&
            node.name === "figure" &&
            node.attributes?.src === targetUrl &&
            parent &&
            typeof index === "number"
        ) {
            ;(parent as any).children.splice(index, 1)
            return [SKIP, index]
        }
    })

    return unified()
        .use(remarkStringify)
        .use(remarkDirective)
        .stringify(tree as any)
}

export function hasAnyVisualDirectives(content: string): boolean {
    const tree = unified().use(remarkParse).use(remarkDirective).parse(content) as Node
    let found = false
    visit(tree, (node: any) => {
        if (
            (node.type === "containerDirective" || node.type === "leafDirective") &&
            VISUAL_DIRECTIVES.has(node.name)
        ) {
            found = true
            return SKIP
        }
    })
    return found
}
