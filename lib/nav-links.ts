import { cache } from "react"
import { prisma } from "@/lib/prisma"

export interface NavPageLink {
    slug: string
    title: string
}

/**
 * Admin-authored CMS pages that belong in navigation.
 *
 * Wrapped in React's `cache` so the two server components that need it in
 * the same render — ConsoleShell (sidebar footer group, `lg`+ only) and
 * Footer (the only place these links are reachable below `lg`) — share a
 * single query per request instead of issuing two identical ones.
 *
 * Never throws: navigation must render even if the Page table is
 * unreachable, so a failure degrades to "no CMS links" rather than taking
 * out the whole shell.
 */
export const getNavPageLinks = cache(async (): Promise<NavPageLink[]> => {
    try {
        return await prisma.page.findMany({
            where: { isActive: true },
            select: { title: true, slug: true },
            orderBy: { createdAt: "asc" },
        })
    } catch {
        return []
    }
})
