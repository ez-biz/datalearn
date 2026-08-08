import { getExistingDailyStatusForCurrentUser } from "@/actions/daily"
import { getNavLinks } from "@/actions/nav"
import { getTrackCurriculum } from "@/actions/curriculum"
import { auth } from "@/lib/auth"
import { excludeLockedProblems } from "@/lib/contest-locks"
import { prisma } from "@/lib/prisma"
import { FEATURED_TRACK_SLUG } from "@/lib/curriculum-featured"
import { SignInDialogButton } from "@/components/auth/SignInDialog"
import { Footer } from "@/components/layout/Footer"
import { UserMenu } from "@/components/layout/UserMenu"
import { cookies } from "next/headers"
import { ConsoleChrome } from "./ConsoleChrome"
import { MobileSignInMenu } from "./MobileSignInMenu"
import { parseSidebarState, SIDEBAR_COOKIE } from "./sidebar-cookie"
import type { TrackProgress } from "./ConsoleSidebar"

export async function ConsoleShell({ children }: { children: React.ReactNode }) {
    // getTrackCurriculum has no dependency on the session or menuStats below
    // it — it re-resolves auth() internally (actions/curriculum.ts) — so it
    // belongs in this first batch rather than after it. `.catch(() => null)`
    // is deliberate: it keeps a curriculum failure from rejecting the whole
    // Promise.all (which would also take out pages/session/cookies), and
    // preserves the "never break navigation" semantics of the old try/catch.
    const [{ data: pages }, session, cookieStore, curriculum] = await Promise.all([
        getNavLinks(),
        auth(),
        cookies(),
        getTrackCurriculum(FEATURED_TRACK_SLUG).catch(() => null),
    ])

    const initialState = parseSidebarState(cookieStore.get(SIDEBAR_COOKIE)?.value)

    const trackProgress: TrackProgress | null = curriculum
        ? { name: curriculum.name, percent: curriculum.rollup.percent }
        : null

    let menuStats: { solved: number; total: number; dailySolved: boolean } | null = null
    if (session?.user?.id) {
        const [solvedRows, total, dailyStatus] = await Promise.all([
            prisma.submission.findMany({
                where: { userId: session.user.id, status: "ACCEPTED" },
                select: { problemId: true },
                distinct: ["problemId"],
            }),
            prisma.sQLProblem.count({
                where: excludeLockedProblems({ status: "PUBLISHED" }),
            }),
            getExistingDailyStatusForCurrentUser(),
        ])
        menuStats = {
            solved: solvedRows.length,
            total,
            dailySolved: dailyStatus.solvedToday,
        }
    }

    // UserMenu is the sole reviewed account surface — the sidebar header,
    // the collapsed rail's footer avatar, and the mobile "You" tab each get
    // their own instance (independent open/close state, different anchor
    // placement) rather than a second implementation.
    function accountMenu(placement: "header" | "rail" | "tabbar") {
        if (!session?.user) return null
        return (
            <UserMenu
                name={session.user.name ?? null}
                email={session.user.email ?? null}
                image={session.user.image ?? null}
                role={session.user.role ?? "USER"}
                solved={menuStats?.solved ?? 0}
                total={menuStats?.total ?? 0}
                dailySolved={menuStats?.dailySolved ?? false}
                placement={placement}
                size={placement === "rail" ? "sm" : "md"}
            />
        )
    }

    const headerSlot = accountMenu("header") ?? (
        <SignInDialogButton className="inline-flex h-8 w-full items-center justify-center rounded-[5px] bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary-hover">
            Sign in
        </SignInDialogButton>
    )

    // Mobile has neither a sidebar nor a rail, so this popover (theme toggle
    // + sign in) is what makes the theme toggle reachable for signed-out
    // phone visitors — see MobileSignInMenu for the full rationale. Its root
    // element is h-full w-full, matching ACCOUNT_CELL in MobileTabBar.tsx so
    // the control still fills the "You" cell edge to edge.
    const signInSlot = <MobileSignInMenu />

    // ConsoleChrome owns the scroll column, <main> and the footer, because it
    // is the only one of the two that can read the pathname and so decide
    // whether the route is a focus route. It is a client component, though,
    // and Footer is an async server component — so the element is created here
    // and passed down as a slot rather than imported over there. Footer's data
    // read (getNavPageLinks) is React-`cache`d and already warm from
    // getNavLinks() above, so this costs no extra query.
    return (
        <ConsoleChrome
            initialState={initialState}
            signedIn={Boolean(session?.user)}
            trackProgress={trackProgress}
            pageLinks={pages ?? []}
            headerSlot={headerSlot}
            railAccountSlot={accountMenu("rail")}
            tabBarAccountSlot={accountMenu("tabbar")}
            signInSlot={signInSlot}
            footerSlot={<Footer />}
        >
            {children}
        </ConsoleChrome>
    )
}
