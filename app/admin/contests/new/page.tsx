import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { AdminListShell } from "@/components/admin/AdminListShell"
import { ContestForm } from "@/components/contests/admin/ContestForm"

export const metadata = {
    title: "New contest",
    robots: { index: false, follow: false },
}

export default async function NewContestPage() {
    await requireAdminPage()

    return (
        <AdminListShell
            eyebrow="NEW CONTEST"
            title="New contest"
            description={
                <>
                    Submitted via{" "}
                    <code className="font-mono text-xs">
                        POST /api/admin/contests
                    </code>
                </>
            }
            actions={<BackLink href="/admin/contests" label="Back to contests" />}
        >
            <ContestForm mode={{ kind: "create" }} />
        </AdminListShell>
    )
}

function BackLink({ href, label }: { href: string; label: string }) {
    return (
        <Link
            href={href}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
            <ChevronLeft className="h-3.5 w-3.5" />
            {label}
        </Link>
    )
}
