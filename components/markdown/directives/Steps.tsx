import { Children, isValidElement, type ReactElement, type ReactNode } from "react"

interface StepsProps {
    children?: ReactNode
}

export function Steps({ children }: StepsProps) {
    const orderedList = Children.toArray(children).find(
        (child) => isValidElement(child) && child.type === "ol"
    )
    const items =
        orderedList && isValidElement(orderedList)
            ? (Children.toArray((orderedList.props as { children?: ReactNode }).children).filter(
                  (child) => isValidElement(child) && child.type === "li"
              ) as ReactElement[])
            : []

    return (
        <div className="my-6 grid gap-5">
            {items.map((item, index) => (
                <div
                    key={index}
                    className="grid grid-cols-[3rem_1fr] items-start gap-5 rounded-lg border border-border bg-surface p-5"
                >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground tabular-nums">
                        {index + 1}
                    </div>
                    <div className="min-w-0 text-sm text-foreground">
                        {(item.props as { children?: ReactNode }).children}
                    </div>
                </div>
            ))}
        </div>
    )
}
