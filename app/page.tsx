import Link from "next/link"
import {
    ArrowRight,
    BookOpen,
    Database,
    Gauge,
    Sparkles,
    Terminal,
    Zap,
} from "lucide-react"
import { Container } from "@/components/ui/Container"
import { LinkButton } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge, DifficultyBadge } from "@/components/ui/Badge"
import { getProblems } from "@/actions/problems"
import { getTopics } from "@/actions/content"

export default async function Home() {
    const [{ data: problems }, { data: topics }] = await Promise.all([
        getProblems(),
        getTopics(),
    ])

    const totalProblems = problems?.length ?? 0
    const totalTopics = topics?.length ?? 0
    const totalArticles =
        topics?.reduce((sum: number, t: any) => sum + (t._count?.articles ?? 0), 0) ?? 0
    const featuredProblems = (problems ?? []).slice(0, 5)

    return (
        <main className="flex-1">
            {/* Hero */}
            <section className="relative overflow-hidden border-b border-border">
                <div
                    aria-hidden
                    className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.08),_transparent_60%)]"
                />
                <div
                    aria-hidden
                    className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,hsl(var(--border)/0.6)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.6)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)] opacity-40"
                />
                <Container width="xl" className="py-20 sm:py-28">
                    <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
                        <div>
                            <Badge variant="primary" className="mb-5">
                                <Sparkles className="h-3 w-3" />
                                Beta · v0.2
                            </Badge>
                            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.05]">
                                Practice SQL the way{" "}
                                <span className="text-primary">engineers do.</span>
                            </h1>
                            <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
                                Real problems. Real schemas. A real database in your browser.
                                No sign-up, no setup — just write a query, run it, and get
                                instant validation.
                            </p>
                            <div className="mt-8 flex flex-col sm:flex-row gap-3">
                                <LinkButton href="/practice" size="lg">
                                    Start solving
                                    <ArrowRight className="h-4 w-4" />
                                </LinkButton>
                                <LinkButton href="/learn" size="lg" variant="outline">
                                    <BookOpen className="h-4 w-4" />
                                    Browse lessons
                                </LinkButton>
                            </div>
                            <dl className="mt-10 grid grid-cols-3 gap-6 max-w-md">
                                <Stat label="Problems" value={totalProblems} />
                                <Stat label="Topics" value={totalTopics} />
                                <Stat label="Articles" value={totalArticles} />
                            </dl>
                        </div>

                        {/* Editor preview */}
                        <div className="relative">
                            <div className="absolute -inset-4 -z-10 rounded-2xl bg-gradient-to-br from-primary/15 via-transparent to-accent/10 blur-2xl" />
                            <Card className="overflow-hidden shadow-2xl shadow-primary/5">
                                <div className="flex items-center gap-2 border-b border-border bg-surface-muted px-4 py-2.5">
                                    <span className="h-2.5 w-2.5 rounded-full bg-hard/70" />
                                    <span className="h-2.5 w-2.5 rounded-full bg-medium/70" />
                                    <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
                                    <span className="ml-3 text-xs font-mono text-muted-foreground">
                                        top-customers.sql
                                    </span>
                                </div>
                                <pre className="bg-surface px-5 py-5 text-[13px] leading-relaxed font-mono overflow-x-auto scrollbar-thin">
                                    <code>
                                        <span className="text-muted-foreground">{"-- Top 3 customers by revenue\n"}</span>
                                        <span className="text-primary">SELECT</span>{" c.name,\n"}
                                        {"       "}
                                        <span className="text-accent">SUM</span>
                                        {"(o.amount) "}
                                        <span className="text-primary">AS</span>
                                        {" total\n"}
                                        <span className="text-primary">FROM</span>{" customers c\n"}
                                        <span className="text-primary">JOIN</span>{" orders o "}
                                        <span className="text-primary">ON</span>
                                        {" o.customer_id = c.customer_id\n"}
                                        <span className="text-primary">GROUP BY</span>{" c.name\n"}
                                        <span className="text-primary">ORDER BY</span>{" total "}
                                        <span className="text-primary">DESC</span>
                                        {"\n"}
                                        <span className="text-primary">LIMIT</span>{" 3;"}
                                    </code>
                                </pre>
                                <div className="border-t border-border bg-surface-muted/50 px-5 py-3 flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                        3 rows · 0.04s
                                    </span>
                                    <Badge variant="primary">
                                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                        Correct
                                    </Badge>
                                </div>
                                <div className="border-t border-border">
                                    <table className="w-full text-[13px]">
                                        <thead className="bg-surface-muted/40">
                                            <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                                                <th className="px-4 py-2 font-medium">name</th>
                                                <th className="px-4 py-2 font-medium tabular-nums text-right">
                                                    total
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border font-mono">
                                            <tr>
                                                <td className="px-4 py-2">Alice Chen</td>
                                                <td className="px-4 py-2 tabular-nums text-right">
                                                    8,420.50
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2">Bob Kumar</td>
                                                <td className="px-4 py-2 tabular-nums text-right">
                                                    6,135.00
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2">Carla Diaz</td>
                                                <td className="px-4 py-2 tabular-nums text-right">
                                                    5,210.75
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        </div>
                    </div>
                </Container>
            </section>

            {/* Feature pillars */}
            <section className="border-b border-border bg-surface">
                <Container width="xl" className="py-16 sm:py-20">
                    <div className="grid sm:grid-cols-3 gap-8">
                        <Pillar
                            icon={<Zap className="h-5 w-5" />}
                            title="In-browser execution"
                            body="DuckDB-WASM runs your queries client-side. Zero server round-trips, zero waiting."
                        />
                        <Pillar
                            icon={<Gauge className="h-5 w-5" />}
                            title="Instant validation"
                            body="Every problem ships with expected results. We check ordering, types, and floating-point tolerance."
                        />
                        <Pillar
                            icon={<Database className="h-5 w-5" />}
                            title="Real schemas"
                            body="Curated datasets across e-commerce, HR, and SaaS workflows — not toy tables."
                        />
                    </div>
                </Container>
            </section>

            {/* Featured problems */}
            <section className="border-b border-border">
                <Container width="xl" className="py-16 sm:py-20">
                    <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
                        <div>
                            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                                Featured problems
                            </h2>
                            <p className="mt-1.5 text-muted-foreground">
                                Start with the basics or jump into joins, aggregates, and window
                                functions.
                            </p>
                        </div>
                        <Link
                            href="/practice"
                            className="text-sm font-medium text-primary hover:text-primary-hover inline-flex items-center gap-1"
                        >
                            View all <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                    <Card className="divide-y divide-border overflow-hidden">
                        {featuredProblems.length === 0 ? (
                            <div className="p-10 text-center text-sm text-muted-foreground">
                                No problems yet. Check back soon.
                            </div>
                        ) : (
                            featuredProblems.map((p: any, i: number) => (
                                <Link
                                    key={p.id}
                                    href={`/practice/${p.slug}`}
                                    className="flex items-center gap-4 p-4 sm:px-6 hover:bg-surface-muted/60 transition-colors group"
                                >
                                    <span className="hidden sm:inline-block w-8 text-xs tabular-nums text-muted-foreground">
                                        {String(i + 1).padStart(2, "0")}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                                            {p.title}
                                        </h3>
                                        <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                                            {p.description}
                                        </p>
                                    </div>
                                    <DifficultyBadge difficulty={p.difficulty} />
                                    <ArrowRight className="hidden sm:block h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-[color,translate] duration-150" />
                                </Link>
                            ))
                        )}
                    </Card>
                </Container>
            </section>

            {/* CTA */}
            <section className="bg-surface">
                <Container width="xl" className="py-16 sm:py-20">
                    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-surface to-accent/5">
                        <div
                            aria-hidden
                            className="absolute right-0 top-0 -translate-y-1/3 translate-x-1/3 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
                        />
                        <CardContent className="relative p-10 sm:p-14 text-center">
                            <Terminal className="h-8 w-8 mx-auto text-primary mb-4" />
                            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                                Ready to write your first query?
                            </h2>
                            <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
                                Open a problem, write SQL in the editor, hit Run. That&apos;s it.
                                No environment to install.
                            </p>
                            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                                <LinkButton href="/practice" size="lg">
                                    Browse problems
                                    <ArrowRight className="h-4 w-4" />
                                </LinkButton>
                                <LinkButton href="/learn" size="lg" variant="ghost">
                                    Read the lessons
                                </LinkButton>
                            </div>
                        </CardContent>
                    </Card>
                </Container>
            </section>
        </main>
    )
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                {label}
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
        </div>
    )
}

function Pillar({
    icon,
    title,
    body,
}: {
    icon: React.ReactNode
    title: string
    body: string
}) {
    return (
        <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {icon}
            </div>
            <h3 className="mt-4 text-base font-semibold">{title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{body}</p>
        </div>
    )
}
