import type { Metadata } from "next"
import Link from "next/link"
import { Container } from "@/components/ui/Container"

export const metadata: Metadata = {
    title: "Privacy policy",
    description: "How Data Learn handles your data.",
}

const LAST_UPDATED = "May 2, 2026"

export default function PrivacyPage() {
    return (
        <Container width="md" className="py-10 sm:py-14">
            <header className="mb-8">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Legal
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                    Privacy policy
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Last updated: <span className="tabular-nums">{LAST_UPDATED}</span>
                </p>
            </header>

            <div className="prose prose-sm max-w-none text-foreground/90 dark:prose-invert">
                <p>
                    This is a placeholder privacy policy. Replace this content
                    before going live with paying users or marketing the
                    product publicly.
                </p>

                <h2>What we collect</h2>
                <ul>
                    <li>
                        <strong>Account info</strong> — name, email, and
                        avatar from your OAuth provider (GitHub or Google).
                    </li>
                    <li>
                        <strong>Submissions</strong> — the SQL you write,
                        whether it produced the expected output, and when you
                        submitted it. Stored to track your progress.
                    </li>
                    <li>
                        <strong>Lists</strong> — any custom problem lists you
                        create.
                    </li>
                </ul>

                <h2>What we don&apos;t collect</h2>
                <ul>
                    <li>
                        SQL queries are executed in your browser via WebAssembly.
                        Run-only queries (the Run button) never leave your
                        device. Only Submitted queries are stored, so we can
                        replay your history.
                    </li>
                    <li>
                        We don&apos;t track you across the web. No third-party
                        analytics beyond Vercel&apos;s built-in deployment metrics.
                    </li>
                </ul>

                <h2>Account deletion</h2>
                <p>
                    You can request account deletion by emailing the address in
                    the Terms. We&apos;ll delete your account and all
                    associated data within 30 days.
                </p>

                <h2>Contact</h2>
                <p>
                    Questions about this policy? See the email in our{" "}
                    <Link href="/terms">Terms</Link>.
                </p>
            </div>
        </Container>
    )
}
