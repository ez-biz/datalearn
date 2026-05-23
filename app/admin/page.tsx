import type { Metadata } from "next"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { AdminDashboard } from "@/components/admin/AdminDashboard"
import { Container } from "@/components/ui/Container"

export const metadata: Metadata = {
    title: "Admin",
    robots: { index: false, follow: false },
}

export default async function AdminPage() {
    await requireAdminPage()

    return (
        <Container width="2xl" className="py-10 sm:py-14">
            <AdminDashboard />
        </Container>
    )
}
