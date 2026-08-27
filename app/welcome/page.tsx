import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { signInPath } from "@/lib/auth-redirect"
import { getTrackCurriculum } from "@/actions/curriculum"
import { FEATURED_TRACK_SLUG } from "@/lib/curriculum-featured"
import { Logo } from "@/components/ui/Logo"
import { WelcomeFlow } from "@/components/welcome/WelcomeFlow"
import type { ModuleLike, SqlLevel } from "@/lib/onboarding/entry-point"

export const metadata: Metadata = {
    title: "Welcome",
    robots: { index: false, follow: false },
}

function firstNameOf(name: string | null): string | null {
    if (!name) return null
    const first = name.trim().split(/\s+/)[0]
    return first.length > 0 ? first : null
}

/**
 * First-run onboarding. A focus route: `ConsoleChrome` renders only
 * #app-scroll for it, so this page supplies its own <header> and <main> AS
 * SIBLINGS — ARIA forbids the `banner` landmark inside `main`, the same
 * constraint the lesson reader lives under.
 *
 * Only app/page.tsx redirects INTO this route, and this route only redirects
 * OUT when onboarding is already complete. The two conditions are exact
 * complements, so a redirect loop is structurally impossible rather than
 * defended against.
 */
export default async function WelcomePage() {
    const session = await auth()
    if (!session?.user?.id) redirect(signInPath("/welcome"))
    if (session.user.onboardingCompleted) redirect("/")

    const [user, curriculum] = await Promise.all([
        prisma.user.findUnique({
            where: { id: session.user.id },
            select: { sqlLevel: true, name: true },
        }),
        getTrackCurriculum(FEATURED_TRACK_SLUG),
    ])

    // Structural mapping, not a cast: entry-point.ts stays Prisma-free by
    // accepting the shape it needs rather than importing CurriculumModule.
    const modules: ModuleLike[] = (curriculum?.modules ?? []).map((module) => ({
        slug: module.slug,
        name: module.name,
        position: module.position,
        lessons: module.lessons.map((lesson) => ({
            slug: lesson.slug,
            title: lesson.title,
            readingMinutes: lesson.readingMinutes,
        })),
    }))

    return (
        <>
            <header className="border-b border-border">
                <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-4">
                    <Logo />
                </div>
            </header>
            <main id="main-content" className="px-4 py-12 sm:py-16">
                <WelcomeFlow
                    firstName={firstNameOf(user?.name ?? session.user.name ?? null)}
                    initialLevel={(user?.sqlLevel as SqlLevel | null) ?? null}
                    trackSlug={curriculum?.slug ?? null}
                    trackName={curriculum?.name ?? null}
                    modules={modules}
                />
            </main>
        </>
    )
}
