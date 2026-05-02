import type { Metadata } from "next"
import Link from "next/link"
import { Container } from "@/components/ui/Container"

export const metadata: Metadata = {
    title: "Terms",
    description: "Data Learn terms of service.",
}

const LAST_UPDATED = "May 2, 2026"

export default function TermsPage() {
    return (
        <Container width="md" className="py-10 sm:py-14">
            <header className="mb-8">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Legal
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                    Terms
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Last updated: <span className="tabular-nums">{LAST_UPDATED}</span>
                </p>
            </header>

            <div className="prose prose-sm max-w-none text-foreground/90 dark:prose-invert">
                <p>
                    This is a placeholder Terms of Service. Replace this content
                    with real legal language before going live with paying
                    users or marketing the product publicly. Consider engaging
                    a lawyer.
                </p>

                <h2>Use of the service</h2>
                <p>
                    Data Learn is provided as-is for educational use. You agree
                    to use it for lawful purposes only — no reverse-engineering
                    the in-browser engines for commercial redistribution, no
                    automated scraping, no submitting content that infringes
                    on third-party rights.
                </p>

                <h2>Your account</h2>
                <p>
                    You&apos;re responsible for actions taken under your
                    account. Keep your OAuth provider credentials secure. If
                    you suspect unauthorized access, sign out everywhere and
                    contact us.
                </p>

                <h2>User-submitted content</h2>
                <p>
                    SQL submissions remain yours. By submitting, you grant Data
                    Learn a non-exclusive license to store them and display
                    your submission history back to you. We won&apos;t share
                    individual submissions with third parties.
                </p>

                <h2>Availability</h2>
                <p>
                    We aim for high uptime but make no SLA guarantees during
                    Beta. Service may be intermittently unavailable due to
                    deploys, maintenance, or upstream provider outages.
                </p>

                <h2>Termination</h2>
                <p>
                    You can delete your account at any time (see{" "}
                    <Link href="/privacy">Privacy policy</Link>). We reserve the
                    right to suspend accounts that violate these terms.
                </p>

                <h2>Contact</h2>
                <p>
                    Questions? Reach out at{" "}
                    <a href="mailto:hello@learndatanow.com">hello@learndatanow.com</a>.
                </p>
            </div>
        </Container>
    )
}
