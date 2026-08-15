import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

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

    // The shell (ConsoleShell → ConsoleChrome) already provides the frame —
    // header, admin sidebar, #app-scroll, <main>, footer. This layout's only
    // remaining job is the auth guard above; it renders no chrome of its own.
    // (Belt-and-suspenders: middleware.ts already gates /admin/* at the edge
    // before this ever runs. This check stays as defense in depth.)
    return children
}
