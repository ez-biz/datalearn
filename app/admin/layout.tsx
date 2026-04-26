import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
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

    const [openReportCount, articleQueueCount] = await Promise.all([
        prisma.problemReport.count({ where: { resolvedAt: null } }),
        prisma.article.count({ where: { status: "SUBMITTED" } }),
    ])

    return (
        <div className="flex flex-col flex-1">
            <AdminNav
                openReportCount={openReportCount}
                articleQueueCount={articleQueueCount}
            />
            {children}
        </div>
    )
}
