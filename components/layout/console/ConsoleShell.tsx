import { getExistingDailyStatusForCurrentUser } from "@/actions/daily"
import { getNavLinks } from "@/actions/nav"
import { getTrackCurriculum } from "@/actions/curriculum"
import { auth } from "@/lib/auth"
import { excludeLockedProblems } from "@/lib/contest-locks"
import { prisma } from "@/lib/prisma"
import { FEATURED_TRACK_SLUG } from "@/lib/curriculum-featured"
import { SignInDialogButton } from "@/components/auth/SignInDialog"
import { UserMenu } from "@/components/layout/UserMenu"
import { cookies } from "next/headers"
import { ConsoleChrome } from "./ConsoleChrome"
import { parseSidebarState, SIDEBAR_COOKIE } from "./sidebar-cookie"
import type { TrackProgress } from "./ConsoleSidebar"

function initialsOf(name: string | null, email: string | null): string | null {
    const source = name?.trim() || email?.trim()
    if (!source) return null
    const parts = source.split(/[\s@.]+/).filter(Boolean)
    return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join("")
}

export async function ConsoleShell({ children }: { children: React.ReactNode }) {
    const [{ data: pages }, session, cookieStore] = await Promise.all([
        getNavLinks(),
        auth(),
        cookies(),
    ])

    const initialState = parseSidebarState(cookieStore.get(SIDEBAR_COOKIE)?.value)

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

    // The featured track ships DRAFT, so this returns null and the progress
    // block renders nothing. Wrapped so a curriculum failure can never take
    // down navigation.
    let trackProgress: TrackProgress | null = null
    try {
        const curriculum = await getTrackCurriculum(FEATURED_TRACK_SLUG)
        if (curriculum) {
            trackProgress = {
                name: curriculum.name,
                percent: curriculum.rollup.percent,
            }
        }
    } catch {
        trackProgress = null
    }

    const headerSlot = session?.user ? (
        <UserMenu
            name={session.user.name ?? null}
            email={session.user.email ?? null}
            image={session.user.image ?? null}
            role={session.user.role ?? "USER"}
            solved={menuStats?.solved ?? 0}
            total={menuStats?.total ?? 0}
            dailySolved={menuStats?.dailySolved ?? false}
        />
    ) : (
        <SignInDialogButton className="inline-flex h-8 w-full items-center justify-center rounded-[5px] bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary-hover">
            Sign in
        </SignInDialogButton>
    )

    // MobileTabBar wraps this in a 56px-tall, flex-1-wide cell (the same box
    // every other tab occupies) but only makes `signInSlot` itself the tap
    // target — it does not add an interactive wrapper. The other three tabs
    // are <Link>s that carry the cell's own padding, so their whole
    // border-box (padding included) is clickable. SignInDialogButton renders
    // a single <button> nested inside that wrapper div instead, so a plain
    // `h-full w-full` would only reach the div's content box and leave the
    // div's vertical `py-2` as dead space top and bottom. `-my-2` cancels
    // that padding and `calc(100%+1rem)` adds it back into the button's own
    // height, so the button's border-box covers the entire cell edge to
    // edge, matching the sibling tabs' hit area exactly.
    const signInSlot = (
        <SignInDialogButton
            className="-my-2 flex h-[calc(100%+1rem)] w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-text-dim"
            panelLabel="Sign in from navigation"
        >
            Sign in
        </SignInDialogButton>
    )

    return (
        <ConsoleChrome
            initialState={initialState}
            initials={initialsOf(session?.user?.name ?? null, session?.user?.email ?? null)}
            signedIn={Boolean(session?.user)}
            trackProgress={trackProgress}
            pageLinks={pages ?? []}
            headerSlot={headerSlot}
            signInSlot={signInSlot}
        >
            {children}
        </ConsoleChrome>
    )
}
