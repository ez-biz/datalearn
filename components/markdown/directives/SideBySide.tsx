import { Check, X } from "lucide-react"
import { Children, isValidElement, type ReactNode } from "react"

interface SideBySideProps {
    kind?: string
    children?: ReactNode
}

function splitOnHr(children: ReactNode): [ReactNode[], ReactNode[]] {
    const nodes = Children.toArray(children)
    const index = nodes.findIndex(
        (child) => isValidElement(child) && child.type === "hr"
    )
    if (index === -1) return [nodes, []]
    return [nodes.slice(0, index), nodes.slice(index + 1)]
}

export function SideBySide({ kind, children }: SideBySideProps) {
    const [left, right] = splitOnHr(children)
    const isGoodBad = kind === "good-bad"

    return (
        <div className="my-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <article className="rounded-lg border border-border bg-surface p-5">
                {isGoodBad && (
                    <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                        <X aria-hidden="true" size={16} />
                    </div>
                )}
                {left}
            </article>
            <article className="rounded-lg border border-border bg-surface p-5">
                {isGoodBad && (
                    <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Check aria-hidden="true" size={16} />
                    </div>
                )}
                {right}
            </article>
        </div>
    )
}
