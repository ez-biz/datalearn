import Link from "next/link"
import Image from "next/image"
import { PenSquare, Shield } from "lucide-react"
import { getNavLinks } from "@/actions/nav"
import { auth } from "@/lib/auth"
import { Logo } from "@/components/ui/Logo"
import { LinkButton } from "@/components/ui/Button"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { NavLink } from "./NavLink"
import { MobileNav } from "./MobileNav"

export async function Navbar() {
    const { data: pages } = await getNavLinks()
    const session = await auth()
    const isAdmin = session?.user?.role === "ADMIN"
    const isContributor = session?.user?.role === "CONTRIBUTOR"

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
                        <>
                            {(isContributor || isAdmin) && (
                                <Link
                                    href="/me/articles"
                                    className="hidden sm:inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                                >
                                    <PenSquare className="h-3.5 w-3.5" />
                                    My articles
                                </Link>
                            )}
                            {isAdmin && (
                                <Link
                                    href="/admin"
                                    className="hidden sm:inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 transition-colors"
                                >
                                    <Shield className="h-3.5 w-3.5" />
                                    Admin
                                </Link>
                            )}
                            <Link
                                href="/profile"
                                className="ml-1 rounded-full ring-2 ring-transparent hover:ring-primary/30 transition-all"
                                aria-label="Profile"
                            >
                                {session.user.image ? (
                                    <Image
                                        src={session.user.image}
                                        alt={session.user.name ?? "Profile"}
                                        width={32}
                                        height={32}
                                        className="h-8 w-8 rounded-full object-cover"
                                    />
                                ) : (
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                                        {(session.user.name ?? session.user.email ?? "?")
                                            .charAt(0)
                                            .toUpperCase()}
                                    </span>
                                )}
                            </Link>
                        </>
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
