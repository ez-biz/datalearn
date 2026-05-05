import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { userHasDiscussionPermission } from "@/lib/discussions/permissions"
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
    const user = session?.user
    const role = user?.role
    if (!user || (role !== "ADMIN" && role !== "MODERATOR")) {
        redirect("/")
    }

    const canViewDiscussionQueue =
        role === "ADMIN" ||
        (role === "MODERATOR" &&
            (await userHasDiscussionPermission(
                { id: user.id, role },
                "VIEW_DISCUSSION_QUEUE"
            )))
    const discussionQueueCountPromise = canViewDiscussionQueue
        ? prisma.discussionReport.count({ where: { status: "OPEN" } })
        : Promise.resolve(0)
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
                canViewDiscussionQueue={canViewDiscussionQueue}
                {...(canViewDiscussionQueue ? { discussionQueueCount } : {})}
            />
            {children}
        </div>
    )
}
