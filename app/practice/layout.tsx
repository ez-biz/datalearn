import type { ReactNode } from "react"

/**
 * Wraps every `/practice` route. Emits a `<link rel="preload">` hint for
 * the DuckDB-WASM worker script so the browser can begin fetching it in
 * parallel with the React tree.
 *
 * Only meaningful in production — the assets are served from
 * `public/_dl/sql-engine/` by the prebuild copy step. In dev the URLs
 * 404 and the preload is silently ignored by the browser.
 *
 * Do not preload the wasm directly here. The worker fetches it during
 * `db.instantiate()`, and a document-level fetch preload can race the
 * worker request in CI/Chromium cache writes.
 */
export default function PracticeLayout({ children }: { children: ReactNode }) {
    const enabled = process.env.NODE_ENV === "production"
    return (
        <>
            {enabled ? (
                <link
                    rel="preload"
                    href="/_dl/sql-engine/duckdb-browser-eh.worker.js"
                    as="fetch"
                    crossOrigin="anonymous"
                />
            ) : null}
            {children}
        </>
    )
}
