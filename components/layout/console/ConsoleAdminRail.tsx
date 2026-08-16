// Server component: the icon-only admin nav rendered inside the collapsed
// rail on /admin/* routes. Mirrors how ConsoleRail relates to ConsoleSidebar
// for the learner nav — same reuse of visibleAdminNav, same "no ADMIN_NAV in
// a client bundle" discipline as ConsoleAdminSidebar (see that file's header
// comment). Deliberately NOT "use client" for the same reason.
//
// Flat, unlabeled icon list — like ConsoleRail, the rail drops the group
// headings the expanded sidebar shows; there isn't room for them at 56px
// wide, and the icon + title tooltip carries the item identity instead.
import { visibleAdminNav, type AdminNavViewer } from "@/lib/admin/admin-nav-model"
import { AdminRailLink } from "./AdminRailLink"

interface ConsoleAdminRailProps {
    viewer: AdminNavViewer
}

export function ConsoleAdminRail({ viewer }: ConsoleAdminRailProps) {
    const groups = visibleAdminNav(viewer)

    return (
        <nav aria-label="Admin" className="flex flex-col items-center gap-0.5">
            {groups.map((group) =>
                group.items.map((item) => (
                    <AdminRailLink
                        key={item.key}
                        href={item.href}
                        match={item.match ?? "prefix"}
                        label={item.label}
                        icon={<item.icon className="h-[17px] w-[17px]" aria-hidden />}
                    />
                )),
            )}
        </nav>
    )
}
