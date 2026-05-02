import Link from "next/link"
import { Github } from "lucide-react"
import { SignInDialogButton } from "@/components/auth/SignInDialog"
import { Logo } from "@/components/ui/Logo"

export function Footer() {
    return (
        <footer className="border-t border-border bg-surface mt-auto">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
                    <div className="col-span-2 sm:col-span-1">
                        <Logo />
                        <p className="mt-3 text-sm text-muted-foreground max-w-xs">
                            Practice SQL in your browser. Real problems, instant feedback.
                        </p>
                    </div>
                    <FooterColumn title="Product">
                        <FooterLink href="/practice">Practice problems</FooterLink>
                        <FooterLink href="/learn">Learning hub</FooterLink>
                    </FooterColumn>
                    <FooterColumn title="Account">
                        <FooterLink href="/profile">Profile</FooterLink>
                        <li>
                            <SignInDialogButton className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                                Sign in
                            </SignInDialogButton>
                        </li>
                    </FooterColumn>
                    <FooterColumn title="Project">
                        <FooterLink
                            href="https://github.com/ez-biz/datalearn"
                            external
                        >
                            <Github className="h-3.5 w-3.5" /> GitHub
                        </FooterLink>
                    </FooterColumn>
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
