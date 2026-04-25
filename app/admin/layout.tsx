import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { AdminNav } from "@/components/admin/AdminNav"

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
    if (!session?.user || session.user.role !== "ADMIN") {
        redirect("/")
    }

    return (
        <div className="flex flex-col flex-1">
            <AdminNav />
            {children}
        </div>
    )
}
