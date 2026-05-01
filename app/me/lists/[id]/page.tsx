import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { Container } from "@/components/ui/Container"
import { getList } from "@/actions/lists"
import { ListDetail } from "@/components/lists/ListDetail"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
    const { id } = await params
    const list = await getList(id)
    return { title: list?.name ?? "List" }
}

export default async function ListDetailPage({ params }: Props) {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id)
        redirect(`/api/auth/signin?callbackUrl=/me/lists/${id}`)

    const list = await getList(id)
    if (!list) notFound()

    return (
        <Container width="lg" className="py-10">
            <Link
                href="/me/lists"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
                <ChevronLeft className="h-3.5 w-3.5" />
                All lists
            </Link>
            <ListDetail list={list} />
        </Container>
    )
}
