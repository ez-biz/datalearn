"use server"

import { getNavPageLinks } from "@/lib/nav-links"

export async function getNavLinks() {
    // Delegates to the React-cached reader in lib/nav-links.ts so this call
    // and the Footer's share one query per request. getNavPageLinks never
    // throws, so `success` is always true; the shape is kept for callers.
    return { success: true, data: await getNavPageLinks() }
}
