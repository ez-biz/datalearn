// Pure route predicate. No React, no Next imports — so it unit-tests
// alongside nav-model.ts without a DOM.

/**
 * Whether a path is a "focus mode" route — one that replaces the console
 * shell rather than sitting inside it.
 *
 * Two routes today: the lesson reader (/learn/tracks/<track>/<lesson>) and
 * first-run onboarding (/welcome). The track page one level up
 * (/learn/tracks/<track>) keeps the shell, so segment count is the
 * discriminator for the reader, not a prefix match. /welcome is a single
 * static segment — there is no /welcome/<step>, because the steps are client
 * state inside one page.
 */
export function isFocusRoute(pathname: string): boolean {
    const segments = pathname.split("/").filter(Boolean)

    if (segments.length === 1 && segments[0] === "welcome") return true

    return (
        segments.length === 4 &&
        segments[0] === "learn" &&
        segments[1] === "tracks"
    )
}

/**
 * Whether a path is an "app mode" route — one that sits inside the console
 * shell but behaves like an application view rather than a document: no
 * footer, and no page scroll at any width, because its inner panes own
 * their own scrolling.
 *
 * Today that is exactly the problem workspace: /practice/<slug>. The catalog
 * one level up (/practice) and its static /practice/tags route are ordinary
 * scrolling pages. Segment count narrows the match, then the static sibling
 * exclusion distinguishes the dynamic workspace route.
 *
 * INVARIANT: no path may satisfy both isAppRoute and isFocusRoute. Enforced
 * in scripts/test-console-nav.ts.
 */
export function isAppRoute(pathname: string): boolean {
    const segments = pathname.split("/").filter(Boolean)
    return (
        segments.length === 2 &&
        segments[0] === "practice" &&
        segments[1] !== "tags"
    )
}
