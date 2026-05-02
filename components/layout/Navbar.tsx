import Link from "next/link"
import { CalendarCheck2, PenSquare, Shield } from "lucide-react"
import { getExistingDailyStatusForCurrentUser } from "@/actions/daily"
import { getNavLinks } from "@/actions/nav"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SignInDialogButton } from "@/components/auth/SignInDialog"
import { Logo } from "@/components/ui/Logo"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { NavLink } from "./NavLink"
import { MobileNav } from "./MobileNav"
import { UserMenu } from "./UserMenu"

export async function Navbar() {
    const { data: pages } = await getNavLinks()
    const session = await auth()
    const isAdmin = session?.user?.role === "ADMIN"
    const isContributor = session?.user?.role === "CONTRIBUTOR"

    // Fetch the small data the UserMenu needs only for logged-in requests.
    let menuStats: { solved: number; total: number; dailySolved: boolean } | null = null
    if (session?.user?.id) {
        const [solvedRows, total, dailyStatus] = await Promise.all([
            prisma.submission.findMany({
                where: { userId: session.user.id, status: "ACCEPTED" },
                select: { problemId: true },
                distinct: ["problemId"],
            }),
            prisma.sQLProblem.count({ where: { status: "PUBLISHED" } }),
            getExistingDailyStatusForCurrentUser(),
        ])
        menuStats = {
            solved: solvedRows.length,
            total,
            dailySolved: dailyStatus.solvedToday,
        }
    }

    const navItems = [
        { href: "/learn", label: "Learn" },
        { href: "/practice", label: "Practice" },
        ...(pages?.map((p: { slug: string; title: string }) => ({
            href: `/${p.slug}`,
            label: p.title,
        })) ?? []),
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
                            dailySolved={menuStats?.dailySolved ?? false}
                        />
                    ) : (
                        <SignInDialogButton className="ml-1 inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm transition-[background-color,box-shadow,scale,opacity] duration-150 hover:bg-primary-hover active:scale-[0.96]">
                            Sign in
                        </SignInDialogButton>
                    )}
                    <MobileNav
                        items={navItems}
                        extra={
                            session?.user ? (
                                <div className="space-y-2">
                                    <Link
                                        href="/daily"
                                        className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium hover:bg-surface-muted"
                                    >
                                        <CalendarCheck2 className="h-4 w-4" />
                                        Daily problem
                                        {menuStats?.dailySolved && (
                                            <span className="ml-auto text-xs text-easy-fg">
                                                Solved
                                            </span>
                                        )}
                                    </Link>
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
                                <SignInDialogButton
                                    className="block w-full rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
                                    panelLabel="Sign in from navigation"
                                >
                                    Sign in
                                </SignInDialogButton>
                            )
                        }
                    />
                </div>
            </div>
        </header>
    )
}
