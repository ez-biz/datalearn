import type { Metadata } from "next"
import { BookText, Database, FileCode, FileText } from "lucide-react"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { createPage } from "@/actions/admin"
import { Container } from "@/components/ui/Container"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Field, Input, Textarea } from "@/components/ui/Input"
import { EmptyState } from "@/components/ui/EmptyState"

export const metadata: Metadata = {
    title: "Admin",
    robots: { index: false, follow: false },
}

export default async function AdminPage() {
    const session = await auth()
    if (!session?.user || session.user.role !== "ADMIN") {
        redirect("/")
    }

    const [pages, topics, sqlProblems] = await Promise.all([
        prisma.page.findMany({ orderBy: { title: "asc" } }),
        prisma.topic.findMany({
            include: { _count: { select: { articles: true } } },
            orderBy: { name: "asc" },
        }),
        prisma.sQLProblem.findMany({ orderBy: { title: "asc" } }),
    ])

    const articleCount = topics.reduce(
        (n: number, t: any) => n + (t._count?.articles ?? 0),
        0
    )

    return (
        <Container width="xl" className="py-10 sm:py-14">
            <header className="mb-8">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Admin</h1>
                <p className="mt-2 text-muted-foreground">
                    Content overview and quick actions.
                </p>
            </header>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                <StatCard icon={<BookText className="h-4 w-4" />} label="Topics" value={topics.length} />
                <StatCard icon={<FileText className="h-4 w-4" />} label="Articles" value={articleCount} />
                <StatCard icon={<Database className="h-4 w-4" />} label="SQL problems" value={sqlProblems.length} />
                <StatCard icon={<FileCode className="h-4 w-4" />} label="Pages" value={pages.length} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Create a page</CardTitle>
                        <CardDescription>
                            Markdown-backed dynamic page. It appears in the navbar once
                            active.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form action={createPage} className="space-y-4">
                            <Field label="Title" htmlFor="title" required>
                                <Input id="title" name="title" required placeholder="About" />
                            </Field>
                            <Field
                                label="Slug"
                                htmlFor="slug"
                                description="URL path. Lowercase, hyphenated."
                                required
                            >
                                <Input
                                    id="slug"
                                    name="slug"
                                    required
                                    placeholder="about"
                                    pattern="[a-z0-9-]+"
                                />
                            </Field>
                            <Field
                                label="Content"
                                htmlFor="content"
                                description="Markdown supported (GFM)."
                                required
                            >
                                <Textarea
                                    id="content"
                                    name="content"
                                    required
                                    rows={10}
                                    placeholder={"# About Data Learn\n\nA short description…"}
                                />
                            </Field>
                            <Button type="submit">Create page</Button>
                        </form>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Pages</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {pages.length === 0 ? (
                                <EmptyState
                                    icon={<FileCode className="h-5 w-5" />}
                                    title="No pages yet"
                                    description="Create one with the form on the left."
                                />
                            ) : (
                                <ul className="divide-y divide-border -mx-2">
                                    {pages.map((page: any) => (
                                        <li
                                            key={page.id}
                                            className="flex items-center justify-between gap-3 px-2 py-2.5"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">
                                                    {page.title}
                                                </p>
                                                <p className="text-xs text-muted-foreground font-mono truncate">
                                                    /{page.slug}
                                                </p>
                                            </div>
                                            <Badge
                                                variant={page.isActive ? "primary" : "secondary"}
                                            >
                                                {page.isActive ? "Active" : "Inactive"}
                                            </Badge>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Topics & articles</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {topics.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No topics yet.</p>
                            ) : (
                                <ul className="space-y-1.5 text-sm">
                                    {topics.map((t: any) => (
                                        <li
                                            key={t.id}
                                            className="flex items-center justify-between gap-3"
                                        >
                                            <span className="truncate">{t.name}</span>
                                            <span className="text-xs text-muted-foreground tabular-nums">
                                                {t._count.articles}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </Container>
    )
}

function StatCard({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode
    label: string
    value: number
}) {
    return (
        <Card>
            <CardContent className="p-5">
                <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                        {label}
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                        {icon}
                    </span>
                </div>
                <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
            </CardContent>
        </Card>
    )
}
