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
    const role = session?.user?.role
    if (role !== "ADMIN" && role !== "MODERATOR") {
        redirect("/")
    }

    const discussionQueueCountPromise = prisma.discussionReport.count({
        where: { status: "OPEN" },
    })
    const [openReportCount, articleQueueCount, discussionQueueCount] =
        role === "ADMIN"
            ? await Promise.all([
                  prisma.problemReport.count({ where: { resolvedAt: null } }),
                  prisma.article.count({ where: { status: "SUBMITTED" } }),
                  discussionQueueCountPromise,
              ])
            : [0, 0, await discussionQueueCountPromise]

    return (
        <div className="flex flex-col flex-1">
            <AdminNav
                role={role}
                openReportCount={openReportCount}
                articleQueueCount={articleQueueCount}
                discussionQueueCount={discussionQueueCount}
            />
            {children}
        </div>
    )
}
