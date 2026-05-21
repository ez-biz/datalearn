import type { Root } from "mdast"
import type { Plugin } from "unified"
import { visit } from "unist-util-visit"

const DIRECTIVE_TAG: Record<string, string> = {
    figure: "dl-figure",
    mermaid: "dl-mermaid",
    steps: "dl-steps",
    "side-by-side": "dl-side-by-side",
    callout: "dl-callout",
}

export const remarkBlockDirectives: Plugin<[], Root> = () => {
    return (tree) => {
        visit(tree, (node: any) => {
            if (
                node.type !== "containerDirective" &&
                node.type !== "leafDirective"
            ) {
                return
            }

            const tag = DIRECTIVE_TAG[node.name]
            if (!tag) return

            const data = (node.data ??= {}) as Record<string, unknown>
            data.hName = tag
            data.hProperties = {
                ...((data.hProperties as Record<string, unknown> | undefined) ?? {}),
                ...(node.attributes ?? {}),
            }
        })
    }
}
