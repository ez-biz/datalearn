// Pure route predicate. No React, no Next imports — so it unit-tests
// alongside nav-model.ts without a DOM.

/**
 * Whether a path is a "focus mode" route — one that replaces the console
 * shell rather than sitting inside it.
 *
 * Today that is exactly the lesson reader: /learn/tracks/<track>/<lesson>.
 * The track page one level up (/learn/tracks/<track>) keeps the shell, so
 * segment count is the discriminator, not a prefix match.
 */
export function isFocusRoute(pathname: string): boolean {
    const segments = pathname.split("/").filter(Boolean)
    return (
        segments.length === 4 &&
        segments[0] === "learn" &&
        segments[1] === "tracks"
    )
}
