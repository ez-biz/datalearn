import Link from "next/link"
import { SignInDialogButton } from "@/components/auth/SignInDialog"
import { Logo } from "@/components/ui/Logo"
import { getNavPageLinks } from "@/lib/nav-links"

/**
 * Below `lg` the console shell is a four-tab bar (Learn / Practice / Tracks /
 * You) with no sidebar and no rail, so this footer is the ONLY in-app route
 * to everything the tab bar leaves out. It therefore has to carry:
 *
 *  - Home (`/`) — the linked logo, matching the old Navbar's linked <Logo/>.
 *  - Contests (`/contests`) — a live route with no tab and no mobile link.
 *  - Admin-authored CMS pages — the old MobileNav listed every getNavLinks()
 *    page; the sidebar still does, but it is `lg:`-only.
 *
 * Adding a fifth tab is not an option (the 4-tab bar is a settled design
 * decision), so these live here. Keep this in sync with any new top-level
 * live route that the tab bar cannot fit.
 */
export async function Footer() {
    const pages = await getNavPageLinks()

    return (
        <footer className="border-t border-border bg-surface mt-auto">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-8">
                    <div className="col-span-2 sm:col-span-1">
                        <Link
                            href="/"
                            className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                            <Logo />
                        </Link>
                        <p className="mt-3 text-sm text-muted-foreground max-w-xs">
                            Practice SQL in your browser. Real problems, instant feedback.
                        </p>
                    </div>
                    <FooterColumn title="Product">
                        <FooterLink href="/">Home</FooterLink>
                        <FooterLink href="/practice">Practice problems</FooterLink>
                        <FooterLink href="/learn">Learning hub</FooterLink>
                        <FooterLink href="/learn/tracks">Tracks</FooterLink>
                        <FooterLink href="/contests">Contests</FooterLink>
                    </FooterColumn>
                    <FooterColumn title="Account">
                        <FooterLink href="/profile">Profile</FooterLink>
                        <li>
                            <SignInDialogButton className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                                Sign in
                            </SignInDialogButton>
                        </li>
                    </FooterColumn>
                    <FooterColumn title="Legal">
                        <FooterLink href="/privacy">Privacy policy</FooterLink>
                        <FooterLink href="/terms">Terms</FooterLink>
                    </FooterColumn>
                    {pages.length > 0 && (
                        <FooterColumn title="More">
                            {pages.map((page) => (
                                <FooterLink key={page.slug} href={`/${page.slug}`}>
                                    {page.title}
                                </FooterLink>
                            ))}
                        </FooterColumn>
                    )}
                </div>
                <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted-foreground">
                    <p>© {new Date().getFullYear()} Data Learn. All rights reserved.</p>
                    <p>
                        Powered by{" "}
                        <span className="font-medium text-foreground">DuckDB-WASM</span>
                        {" "}and{" "}
                        <span className="font-medium text-foreground">PGlite</span>
                        , in your browser.
                    </p>
                </div>
            </div>
        </footer>
    )
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h4 className="text-xs font-semibold tracking-wide uppercase text-foreground mb-3">
                {title}
            </h4>
            <ul className="space-y-2">{children}</ul>
        </div>
    )
}

function FooterLink({
    href,
    children,
    external,
}: {
    href: string
    children: React.ReactNode
    external?: boolean
}) {
    if (external) {
        return (
            <li>
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    {children}
                </a>
            </li>
        )
    }
    return (
        <li>
            <Link
                href={href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
                {children}
            </Link>
        </li>
    )
}
