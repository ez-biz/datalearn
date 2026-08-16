import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { AdminQuickActions } from "@/components/admin/AdminQuickActions"
import { Container } from "@/components/ui/Container"

export const metadata = {
    title: "Admin",
    robots: { index: false, follow: false },
}

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()
    const user = session?.user
    const role = user?.role
    if (!user || (role !== "ADMIN" && role !== "MODERATOR")) {
        redirect("/")
    }

    // The shell (ConsoleChrome) already provides the frame — header, admin
    // sidebar, #app-scroll, <main>, footer — so this layout adds no <main>
    // or <header> landmark of its own (ARIA forbids `banner` inside `main`,
    // and ConsoleChrome already owns the page's one <main>). Its two jobs:
    // the auth guard above (belt-and-suspenders — middleware.ts already
    // gates /admin/* at the edge), and rendering the quick-action bar here
    // rather than inside AdminDashboard, so its Alt+<letter> shortcuts are
    // live on every /admin/* screen, not only the Overview page that used
    // to render them inline.
    //
    // ADMIN-only, matching ADMIN_NAV (lib/admin/admin-nav-model.ts): all
    // four shortcuts create content — problems, articles, tracks, contests —
    // and every one of those nav items is hidden from moderators (none of
    // them sets requiresDiscussionQueuePermission, the only way a MODERATOR
    // gets past isItemVisible's role check). Showing the same shortcuts to
    // a moderator would dangle an affordance they cannot use; the
    // destination pages redirect them home, but the bar shouldn't advertise
    // actions its viewer can't take.
    return (
        <>
            {role === "ADMIN" && (
                <div className="border-b border-border">
                    <Container width="2xl" className="flex justify-end py-3">
                        <AdminQuickActions />
                    </Container>
                </div>
            )}
            {children}
        </>
    )
}
