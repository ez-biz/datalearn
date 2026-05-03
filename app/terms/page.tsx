import type { Metadata } from "next"
import Link from "next/link"
import { Container } from "@/components/ui/Container"

export const metadata: Metadata = {
    title: "Terms",
    description: "Data Learn terms of service.",
}

const LAST_UPDATED = "May 3, 2026"

export default function TermsPage() {
    return (
        <Container width="md" className="py-10 sm:py-14">
            <header className="mb-8">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Legal
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                    Terms of Service
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Last updated: <span className="tabular-nums">{LAST_UPDATED}</span>
                </p>
            </header>

            <div className="prose prose-sm max-w-none text-foreground/90 dark:prose-invert">
                <p>
                    These Terms govern your use of Data Learn (the
                    &quot;Service&quot;), the SQL practice platform at{" "}
                    <a href="https://www.learndatanow.com">learndatanow.com</a>,
                    operated by Anchit Gupta (&quot;we&quot;, &quot;us&quot;).
                    By accessing or using the Service you accept these Terms
                    and the{" "}
                    <Link href="/privacy">Privacy Policy</Link>.
                </p>

                <h2>1. Use of the Service</h2>
                <p>
                    Data Learn is provided as-is for educational use. You may
                    use the Service for lawful purposes only.
                </p>

                <h2>2. Your account</h2>
                <p>
                    You&apos;re responsible for activity under your account.
                    Keep your OAuth provider credentials secure. If you
                    suspect unauthorized access, sign out everywhere and
                    contact{" "}
                    <a href="mailto:hello@learndatanow.com">
                    hello@learndatanow.com</a>. We may suspend accounts that
                    violate these Terms or threaten the integrity of the
                    Service.
                </p>

                <h2>3. Intellectual property — strict reservation of rights</h2>
                <p>
                    All source code, problem statements, schemas, expected
                    outputs, canonical solutions, articles, the Data·Learn
                    wordmark and logo glyph, the visual design system, the
                    overall product design, and any other content provided by
                    us are © 2026 Anchit Gupta and the Data Learn project.
                    All rights are reserved.
                </p>
                <p>
                    Without prior written permission you may not:
                </p>
                <ul>
                    <li>
                        Copy, fork, mirror, redistribute, sublicense, or sell
                        any portion of the Service or its underlying source
                        code, in source or compiled form.
                    </li>
                    <li>
                        Modify, adapt, translate, or create derivative works
                        based on the Service or its content.
                    </li>
                    <li>
                        Use the Service&apos;s content (problem statements,
                        schemas, expected outputs, articles, learner
                        submissions) in any commercial product, paid course,
                        book, video, or competing platform.
                    </li>
                    <li>
                        Train machine learning models, retrieval systems, or
                        any automated system on Data Learn content.
                    </li>
                    <li>
                        Use the &quot;Data Learn&quot; name, the Data·Learn
                        wordmark, the logo, or any confusingly similar mark
                        for any product, service, repository, social handle,
                        or community.
                    </li>
                </ul>
                <p>
                    The companion source repository at{" "}
                    <a
                        href="https://github.com/ez-biz/datalearn"
                        target="_blank"
                        rel="noreferrer"
                    >
                        github.com/ez-biz/datalearn
                    </a>{" "}
                    is published under a proprietary license — see{" "}
                    <a
                        href="https://github.com/ez-biz/datalearn/blob/production/LICENSE"
                        target="_blank"
                        rel="noreferrer"
                    >
                        LICENSE
                    </a>. Public visibility is for evaluation, bug reports,
                    and discussion only; it does not grant any usage rights
                    beyond those listed in the LICENSE.
                </p>

                <h2>4. No scraping, no automated harvesting</h2>
                <p>
                    Automated access to the Service is prohibited except via
                    the documented public APIs (
                    <code>/api/admin/*</code> with a valid Bearer key issued
                    to you, the official MCP server in{" "}
                    <code>mcp-server/</code>) used in good faith for authoring
                    or integrating with content you own. Specifically, you
                    may not:
                </p>
                <ul>
                    <li>
                        Run scrapers, headless browsers, or any other
                        programmatic agent to harvest problems, schemas,
                        expected outputs, articles, or user-submitted content
                        from the live site.
                    </li>
                    <li>
                        Bypass rate limits, authentication, or any other
                        access control.
                    </li>
                    <li>
                        Re-host or rebroadcast Service content through a
                        non-original interface.
                    </li>
                </ul>
                <p>
                    We reserve the right to block, ban, or pursue legal
                    remedies against any user or IP range engaged in the
                    above.
                </p>

                <h2>5. Your submissions</h2>
                <p>
                    SQL submissions you make to the Service remain yours. By
                    submitting, you grant Data Learn a non-exclusive,
                    worldwide, royalty-free license to store them, display
                    your submission history back to you, and use anonymized
                    aggregate metrics to improve the Service. We will not
                    publish individual submissions tied to your identity
                    without consent.
                </p>

                <h2>6. Acceptable use</h2>
                <p>
                    You agree not to use the Service to: harass other users;
                    transmit malware or unsafe SQL designed to attack a
                    third-party system; attempt to break the Service&apos;s
                    sandbox or escalate privileges; impersonate any person or
                    entity; submit content you don&apos;t have rights to.
                </p>

                <h2>7. Availability</h2>
                <p>
                    We aim for high uptime but make no SLA guarantees during
                    Beta. The Service may be intermittently unavailable due
                    to deploys, maintenance, or upstream provider outages.
                    We are not liable for any loss arising from
                    unavailability.
                </p>

                <h2>8. Termination</h2>
                <p>
                    You can delete your account at any time (see{" "}
                    <Link href="/privacy">Privacy Policy</Link>). We reserve
                    the right to suspend or terminate accounts that violate
                    these Terms, including for any of the prohibited uses
                    above, with or without notice.
                </p>

                <h2>9. Disclaimer of warranty</h2>
                <p>
                    THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS
                    AVAILABLE&quot;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
                    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
                    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
                    NON-INFRINGEMENT.
                </p>

                <h2>10. Limitation of liability</h2>
                <p>
                    TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL
                    DATA LEARN OR ITS OPERATORS BE LIABLE FOR ANY INDIRECT,
                    INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
                    OR ANY LOSS OF PROFITS OR REVENUES, ARISING OUT OF OR IN
                    CONNECTION WITH YOUR USE OF THE SERVICE.
                </p>

                <h2>11. Changes to these Terms</h2>
                <p>
                    We may update these Terms. Material changes will be
                    flagged via in-app notice. Continued use of the Service
                    after changes constitutes acceptance.
                </p>

                <h2>12. Governing law</h2>
                <p>
                    These Terms are governed by the laws of India. Any
                    dispute arising from or related to the Service shall be
                    subject to the exclusive jurisdiction of the courts
                    located in India.
                </p>

                <h2>13. Contact</h2>
                <p>
                    Licensing, takedown, support, or general inquiries:{" "}
                    <a href="mailto:hello@learndatanow.com">
                    hello@learndatanow.com</a>.
                </p>

                <hr />
                <p className="text-xs text-muted-foreground">
                    These Terms are provided as a good-faith template and are
                    not legal advice. If you require Terms of Service for
                    compliance purposes (e.g. paid users, EU/UK consumers,
                    California consumers, regulated industries), consult a
                    qualified attorney.
                </p>
            </div>
        </Container>
    )
}
