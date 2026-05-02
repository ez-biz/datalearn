import type { Metadata } from "next"
import type { ReactNode } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import {
    AlertCircle,
    ArrowRight,
    Database,
    Github,
    Play,
    ShieldCheck,
    TerminalSquare,
} from "lucide-react"
import { auth } from "@/lib/auth"
import {
    providerSignInPath,
    sanitizeAuthCallbackPath,
} from "@/lib/auth-redirect"
import { Card } from "@/components/ui/Card"
import { Logo } from "@/components/ui/Logo"

export const metadata: Metadata = {
    title: "Sign in",
    robots: { index: false, follow: false },
}

type SignInPageProps = {
    searchParams?: Promise<{
        callbackUrl?: string | string[]
        error?: string | string[]
    }>
}

function firstParam(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
    const params = (await searchParams) ?? {}
    const callbackUrl = sanitizeAuthCallbackPath(params.callbackUrl)
    const session = await auth()

    if (session?.user) {
        redirect(callbackUrl)
    }

    const showError = Boolean(firstParam(params.error))

    return (
        <main className="min-h-[calc(100dvh-4rem)] bg-background">
            <div className="mx-auto grid w-full max-w-7xl gap-7 px-4 py-6 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8 lg:py-14">
                <section className="order-2 min-w-0 lg:order-1">
                    <div className="mb-5 hidden items-center gap-2 text-xs font-medium uppercase text-muted-foreground sm:flex">
                        <span
                            aria-hidden="true"
                            className="h-2 w-2 rounded-full bg-primary"
                        />
                        Query practice workspace
                    </div>

                    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
                        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-muted px-4 py-3">
                            <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                                <TerminalSquare
                                    aria-hidden="true"
                                    className="h-4 w-4 shrink-0 text-primary"
                                />
                                <span className="truncate">
                                    training-session.sql
                                </span>
                            </div>
                            <span className="rounded-full border border-easy/30 bg-easy-bg px-2 py-1 text-xs font-medium text-easy-fg">
                                Ready
                            </span>
                        </div>

                        <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
                            <div className="border-b border-border p-4 lg:border-b-0 lg:border-r lg:border-border">
                                <pre className="overflow-x-auto rounded-md bg-background p-4 font-mono text-sm leading-6 text-foreground"><code>{`SELECT customer_id, SUM(amount) AS total_spend
FROM orders
WHERE status = 'paid'
GROUP BY customer_id
ORDER BY total_spend DESC
LIMIT 5;`}</code></pre>

                                <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                                    <Metric label="Accuracy" value="94%" />
                                    <Metric label="Streak" value="7 days" />
                                    <Metric label="Problems" value="38" />
                                </div>
                            </div>

                            <div className="p-4">
                                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                                    <Database
                                        aria-hidden="true"
                                        className="h-4 w-4 text-primary"
                                    />
                                    Result preview
                                </div>
                                <div className="space-y-2 font-mono text-xs">
                                    {[
                                        ["C-104", "18,420"],
                                        ["C-087", "15,980"],
                                        ["C-211", "13,775"],
                                    ].map(([customerId, spend]) => (
                                        <div
                                            key={customerId}
                                            className="flex justify-between gap-4 rounded-md border border-border bg-background px-3 py-2"
                                        >
                                            <span>{customerId}</span>
                                            <span className="text-foreground">
                                                {spend}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 flex items-center gap-2 rounded-md border border-easy/30 bg-easy-bg px-3 py-2 text-xs text-easy-fg">
                                    <Play
                                        aria-hidden="true"
                                        className="h-3.5 w-3.5 shrink-0"
                                    />
                                    Validation pipeline ready
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="order-1 flex items-center lg:order-2">
                    <Card className="w-full p-6 shadow-sm sm:p-7">
                        <div className="mb-8">
                            <Logo />
                            <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
                                Train like the query is going live.
                            </h1>
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                Sign in with your existing provider and
                                continue practicing where you left off.
                            </p>
                        </div>

                        {showError && (
                            <div
                                role="alert"
                                className="mb-4 flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-foreground"
                            >
                                <AlertCircle
                                    aria-hidden="true"
                                    className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
                                />
                                <p>
                                    Sign-in could not be completed. Try another
                                    provider or try again.
                                </p>
                            </div>
                        )}

                        <div className="space-y-3">
                            <ProviderLink
                                href={providerSignInPath("google", callbackUrl)}
                                label="Continue with Google"
                                marker="G"
                                primary
                            />
                            <ProviderLink
                                href={providerSignInPath("github", callbackUrl)}
                                label="Continue with GitHub"
                                icon={
                                    <Github
                                        aria-hidden="true"
                                        className="h-4 w-4"
                                    />
                                }
                            />
                        </div>

                        <div className="mt-6 flex items-start gap-2 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
                            <ShieldCheck
                                aria-hidden="true"
                                className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                            />
                            <p>
                                OAuth is handled by the provider. Data Learn
                                never asks for or stores provider passwords.
                            </p>
                        </div>

                        <Link
                            href="/"
                            className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            Back to home
                            <ArrowRight
                                aria-hidden="true"
                                className="h-3.5 w-3.5"
                            />
                        </Link>
                    </Card>
                </section>
            </div>
        </main>
    )
}

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-md border border-border bg-background px-3 py-2">
            <div className="text-muted-foreground">{label}</div>
            <div className="mt-1 font-mono font-semibold tabular-nums">
                {value}
            </div>
        </div>
    )
}

function ProviderLink({
    href,
    label,
    icon,
    marker,
    primary,
}: {
    href: string
    label: string
    icon?: ReactNode
    marker?: string
    primary?: boolean
}) {
    const className = primary
        ? "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-[background-color,box-shadow,scale] duration-150 hover:bg-primary-hover active:scale-[0.98]"
        : "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-muted px-4 text-sm font-semibold text-foreground transition-[background-color,border-color,scale] duration-150 hover:border-border-strong hover:bg-surface-elevated active:scale-[0.98]"

    return (
        <a href={href} className={className}>
            {icon}
            {marker && (
                <span
                    aria-hidden="true"
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-background text-xs font-bold text-foreground"
                >
                    {marker}
                </span>
            )}
            {label}
        </a>
    )
}
