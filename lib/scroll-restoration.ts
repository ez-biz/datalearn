// Pure decision logic for MainScrollRestoration
// (components/layout/console/MainScrollRestoration.tsx). No React, no DOM —
// kept dependency-free so it can be unit-tested outside a browser harness.

/**
 * Whether a `popstate` event represents a real cross-route navigation this
 * component needs to act on. `popstate` also fires for same-pathname history
 * entries (e.g. Back after clicking a `#anchor` hash link), and those must
 * NOT be classified as a pop: doing so would leave a stale "this is a pop"
 * flag armed with nothing to reset it (no pathname change means the
 * effect keyed on `[pathname]` never re-runs), so the *next* ordinary push
 * navigation would be misread as a pop and jump to a stale saved position.
 *
 * `window.location.pathname` is already updated by the browser by the time
 * `popstate` dispatches, so comparing it against the pathname this component
 * is currently rendering is enough to tell the two cases apart.
 */
export function isCrossRoutePop(renderedPathname: string, locationPathname: string): boolean {
    return renderedPathname !== locationPathname
}

/**
 * Scroll offset to apply once a route has (re)rendered: the last saved
 * position for a real pop, or the top of the page for an ordinary push —
 * matching normal navigation UX (a fresh link click always starts at top,
 * even if that URL was visited before).
 */
export function resolveRestoreScrollTop(isPop: boolean, savedPosition: number | undefined): number {
    return isPop ? (savedPosition ?? 0) : 0
}
