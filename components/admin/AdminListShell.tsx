import type { ReactNode } from "react"
import { Container } from "@/components/ui/Container"
import { Eyebrow } from "@/components/ui/Eyebrow"

interface AdminListShellProps {
    eyebrow: string
    title: string
    description?: ReactNode
    actions?: ReactNode
    children: ReactNode
}

export function AdminListShell({
    eyebrow,
    title,
    description,
    actions,
    children,
}: AdminListShellProps) {
    return (
        <Container width="2xl" className="py-10 sm:py-14">
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <Eyebrow variant="bracket" className="mb-1">
                        {eyebrow}
                    </Eyebrow>
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                        {title}
                    </h1>
                    {description && (
                        <div className="mt-1 max-w-2xl text-sm text-muted-foreground">
                            {description}
                        </div>
                    )}
                </div>
                {actions && <div className="shrink-0">{actions}</div>}
            </header>
            {children}
        </Container>
    )
}
