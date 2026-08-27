import { FunnelBar } from "@/components/admin/analytics/FunnelBar"
import { StatTile } from "@/components/admin/analytics/StatTile"
import { Eyebrow } from "@/components/ui/Eyebrow"
import { getOnboardingCounts } from "@/lib/analytics/analytics-read"
import {
    buildOnboardingFunnel,
    skipRate,
} from "@/lib/analytics/onboarding-funnel"

/**
 * Self-fetching, like PlatformSection and ContentSection — the analytics page
 * has no shared read to join. Each section owns its own query so one slow
 * section cannot delay the others.
 */
export async function OnboardingSection() {
    const counts = await getOnboardingCounts()
    const steps = buildOnboardingFunnel(counts)
    const skipped = skipRate(counts)

    return (
        <section className="mt-12">
            <Eyebrow variant="bracket" className="mb-1">
                ONBOARDING
            </Eyebrow>
            <h2 className="text-lg font-semibold tracking-tight">First-run flow</h2>
            <p className="mt-1 text-sm text-muted-foreground">
                Accounts created since onboarding shipped. Users from before that
                are excluded — they were backfilled as already onboarded and would
                otherwise sink every rate permanently.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <StatTile
                    label="Skip rate"
                    value={
                        skipped === null
                            ? "Nobody has finished onboarding yet"
                            : `${Math.round(skipped * 100)}%`
                    }
                    // Rising is bad: MetricCard hardcodes up=green, which is
                    // exactly why this renders through StatTile.
                    polarity="up-bad"
                    footnote="Finished without answering the level question"
                />
                <StatTile
                    label="Answered the level question"
                    value={counts.answered.toLocaleString()}
                    footnote={`of ${counts.signedUp.toLocaleString()} accounts in the cohort`}
                />
            </div>

            <div className="mt-6">
                <FunnelBar
                    steps={steps}
                    emptyMessage="Nobody has signed up since onboarding launched."
                />
            </div>
        </section>
    )
}
