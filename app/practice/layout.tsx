import type { ReactNode } from "react"

/**
 * Wraps every `/practice` route. Emits `<link rel="preload">` hints for
 * the DuckDB-WASM bundle so the browser can begin fetching the wasm and
 * worker scripts in parallel with the React tree, beating the engine
 * warm-up `useEffect` (PR 3.1) to the punch on cold loads.
 *
 * Only meaningful in production — the assets are served from
 * `public/_dl/sql-engine/` by the prebuild copy step. In dev the URLs
 * 404 and the preload is silently ignored by the browser. See
 * `docs/superpowers/specs/2026-05-16-sql-engine-asset-caching-design.md`.
 */
export default function PracticeLayout({ children }: { children: ReactNode }) {
    const enabled = process.env.NODE_ENV === "production"
    return (
        <>
            {enabled ? (
                <>
                    <link
                        rel="preload"
                        href="/_dl/sql-engine/duckdb-eh.wasm"
                        as="fetch"
                        type="application/wasm"
                        crossOrigin="anonymous"
                    />
                    <link
                        rel="preload"
                        href="/_dl/sql-engine/duckdb-browser-eh.worker.js"
                        as="script"
                    />
                </>
            ) : null}
            {children}
        </>
    )
}
