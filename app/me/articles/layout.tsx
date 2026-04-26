import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export const metadata = {
    title: "My articles",
    robots: { index: false, follow: false },
}

/**
 * Gate the contributor area to CONTRIBUTOR or ADMIN. USER role is bounced.
 * Anonymous users get redirected through sign-in.
 */
export default async function MeArticlesLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()
    if (!session?.user?.id) {
        redirect("/api/auth/signin?callbackUrl=/me/articles")
    }
    if (
        session.user.role !== "CONTRIBUTOR" &&
        session.user.role !== "ADMIN"
    ) {
        redirect("/")
    }
    return <>{children}</>
}
