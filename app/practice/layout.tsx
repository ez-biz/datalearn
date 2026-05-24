import type { ReactNode } from "react"

/**
 * Keep `/practice` routes free of document-level DuckDB preload hints.
 * The worker is loaded from inside DuckDB's worker bootstrap, and Chromium
 * does not treat that worker-context request as consuming a page preload.
 */
export default function PracticeLayout({ children }: { children: ReactNode }) {
    return <>{children}</>
}
