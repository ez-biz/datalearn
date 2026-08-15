// Path-matching for a single admin nav item, factored out of
// admin-nav-model.ts so a client component can import *only* this function.
//
// admin-nav-model.ts's activeAdminNavKey() closes over the module-level
// ADMIN_NAV const (group labels, every /admin/* href, badge keys,
// requiresDiscussionQueuePermission flags) — importing anything from that
// module pulls ADMIN_NAV into the importer's bundle, because webpack cannot
// tree-shake a function away from the module state its closure captures.
// AdminSidebarLink (components/layout/console/AdminSidebarLink.tsx) is a
// client component that renders on every page for signed-in ADMIN/MODERATOR
// users, so importing activeAdminNavKey there was shipping the full admin
// nav map to the browser — exactly what making ConsoleAdminSidebar a server
// component was meant to prevent. This module has no other exports and no
// module-level state, so it carries nothing else along with it.
//
// Pure: no React, no Next imports, no closures over external data.
export function matchesAdminPath(
    pathname: string,
    href: string,
    match: "exact" | "prefix"
): boolean {
    if (match === "exact") return pathname === href
    return pathname === href || pathname.startsWith(`${href}/`)
}
