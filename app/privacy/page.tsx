import type { Metadata } from "next"
import Link from "next/link"
import { Container } from "@/components/ui/Container"

export const metadata: Metadata = {
    title: "Privacy policy",
    description: "How Data Learn handles your data.",
}

const LAST_UPDATED = "May 3, 2026"

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
                    This policy describes what Data Learn (the &quot;Service&quot;,
                    operated by Anchit Gupta) collects, how it&apos;s used, and
                    your rights. By using Data Learn you agree to this policy
                    and the{" "}
                    <Link href="/terms">Terms of Service</Link>.
                </p>

                <h2>What we collect</h2>
                <ul>
                    <li>
                        <strong>Account info</strong> — name, email, and avatar
                        from your OAuth provider (GitHub or Google) when you
                        sign in.
                    </li>
                    <li>
                        <strong>Submissions</strong> — the SQL you submit (not
                        the queries you only Run), whether it matched the
                        expected output, and the timestamp. Stored to track
                        your progress and surface your submission history.
                    </li>
                    <li>
                        <strong>Lists</strong> — any custom problem lists you
                        create, including names and contents.
                    </li>
                    <li>
                        <strong>Operational logs</strong> — basic request
                        metadata (IP, user agent, route, status code) at the
                        Vercel and Neon layers, retained for diagnostic and
                        abuse-prevention purposes.
                    </li>
                </ul>

                <h2>What we don&apos;t collect</h2>
                <ul>
                    <li>
                        SQL queries you only <em>Run</em> (without Submit)
                        execute entirely in your browser via WebAssembly. They
                        never leave your device.
                    </li>
                    <li>
                        We don&apos;t place third-party advertising trackers,
                        marketing pixels, or cross-site analytics. Vercel
                        Analytics measures aggregate page views and Web Vitals;
                        no personally identifying profile is built.
                    </li>
                </ul>

                <h2>How we use your data</h2>
                <ul>
                    <li>
                        To operate the Service: authenticate you, render your
                        progress, validate submissions, surface your custom
                        lists.
                    </li>
                    <li>
                        To diagnose issues and prevent abuse (rate limiting,
                        error reporting).
                    </li>
                    <li>
                        We do <strong>not</strong> sell your data.
                    </li>
                </ul>

                <h2>Account deletion</h2>
                <p>
                    Email <a href="mailto:hello@learndatanow.com">
                    hello@learndatanow.com</a> from your account&apos;s
                    registered address to request deletion. We&apos;ll erase
                    your account and all associated submissions, lists, and
                    profile data within 30 days. Aggregate usage metrics that
                    can&apos;t be tied back to you may be retained.
                </p>

                <h2>Cookies and storage</h2>
                <p>
                    We use first-party cookies for session authentication
                    (NextAuth) and localStorage for client-side conveniences
                    (your draft SQL, your selected dialect, theme preference).
                    No tracking cookies.
                </p>

                <h2>Data location</h2>
                <p>
                    User data is stored on Neon (PostgreSQL, US-East region by
                    default). The application is served from Vercel&apos;s
                    global edge network. By using the Service you consent to
                    your data being processed in these locations.
                </p>

                <h2>Data security</h2>
                <p>
                    Data Learn is in active development as a personal project.
                    While we follow common security practices (TLS, hashed
                    Bearer keys, signed sessions, parameterized queries), no
                    online service is fully secure. Don&apos;t submit
                    confidential or regulated data to the Service.
                </p>

                <h2>Children</h2>
                <p>
                    Data Learn is not directed at children under 13 and does
                    not knowingly collect data from them. If you believe a
                    child has provided data, contact{" "}
                    <a href="mailto:hello@learndatanow.com">
                    hello@learndatanow.com</a> for removal.
                </p>

                <h2>Changes to this policy</h2>
                <p>
                    We may update this policy. The &quot;Last updated&quot;
                    date above reflects the most recent change. Material
                    changes will be flagged in the changelog or via in-app
                    notice.
                </p>

                <h2>Contact</h2>
                <p>
                    Questions, deletion requests, or DMCA notices:{" "}
                    <a href="mailto:hello@learndatanow.com">
                    hello@learndatanow.com</a>.
                </p>

                <hr />
                <p className="text-xs text-muted-foreground">
                    This policy is provided as a good-faith summary of current
                    practices. It is not a substitute for legal advice. If you
                    require a fully reviewed privacy policy for compliance
                    purposes, consult a qualified attorney.
                </p>
            </div>
        </Container>
    )
}
