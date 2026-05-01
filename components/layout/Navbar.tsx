import Link from "next/link"
import { PenSquare, Shield } from "lucide-react"
import { getNavLinks } from "@/actions/nav"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Logo } from "@/components/ui/Logo"
import { LinkButton } from "@/components/ui/Button"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { NavLink } from "./NavLink"
import { MobileNav } from "./MobileNav"
import { UserMenu } from "./UserMenu"

export async function Navbar() {
    const { data: pages } = await getNavLinks()
    const session = await auth()
    const isAdmin = session?.user?.role === "ADMIN"
    const isContributor = session?.user?.role === "CONTRIBUTOR"

    // Fetch the small data the UserMenu needs (solved count + total problems)
    // when there's a session. Two cheap queries that run only for logged-in
    // requests — anonymous traffic pays nothing.
    let menuStats: { solved: number; total: number } | null = null
    if (session?.user?.id) {
        const [solvedRows, total] = await Promise.all([
            prisma.submission.findMany({
                where: { userId: session.user.id, status: "ACCEPTED" },
                select: { problemId: true },
                distinct: ["problemId"],
            }),
            prisma.sQLProblem.count({ where: { status: "PUBLISHED" } }),
        ])
        menuStats = { solved: solvedRows.length, total }
    }

    const navItems = [
        { href: "/learn", label: "Learn" },
        { href: "/practice", label: "Practice" },
        ...(pages?.map((p: any) => ({ href: `/${p.slug}`, label: p.title })) ?? []),
    ]

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
            <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
                <Link
                    href="/"
                    className="flex items-center transition-opacity hover:opacity-80"
                    aria-label="Data Learn home"
                >
                    <Logo />
                </Link>

                <nav className="hidden md:flex items-center gap-1 ml-4">
                    {navItems.map((item) => (
                        <NavLink key={item.href} href={item.href}>
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="ml-auto flex items-center gap-1">
                    <ThemeToggle />
                    {session?.user ? (
                        <UserMenu
                            name={session.user.name ?? null}
                            email={session.user.email ?? null}
                            image={session.user.image ?? null}
                            role={session.user.role ?? "USER"}
                            solved={menuStats?.solved ?? 0}
                            total={menuStats?.total ?? 0}
                        />
                    ) : (
                        <LinkButton href="/api/auth/signin" size="sm" className="ml-1">
                            Sign in
                        </LinkButton>
                    )}
                    <MobileNav
                        items={navItems}
                        extra={
                            session?.user ? (
                                <div className="space-y-2">
                                    <Link
                                        href="/profile"
                                        className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-surface-muted"
                                    >
                                        Profile
                                    </Link>
                                    {(isContributor || isAdmin) && (
                                        <Link
                                            href="/me/articles"
                                            className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10"
                                        >
                                            <PenSquare className="h-4 w-4" />
                                            My articles
                                        </Link>
                                    )}
                                    {isAdmin && (
                                        <Link
                                            href="/admin"
                                            className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-accent hover:bg-accent/10"
                                        >
                                            <Shield className="h-4 w-4" />
                                            Admin
                                        </Link>
                                    )}
                                </div>
                            ) : (
                                <Link
                                    href="/api/auth/signin"
                                    className="block w-full rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary-hover"
                                >
                                    Sign in
                                </Link>
                            )
                        }
                    />
                </div>
            </div>
        </header>
    )
}
