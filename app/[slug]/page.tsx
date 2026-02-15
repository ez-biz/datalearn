import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Props = {
    params: Promise<{ slug: string }>
}

export default async function DynamicPage({ params }: Props) {
    const { slug } = await params
    const page = await prisma.page.findUnique({
        where: { slug }
    })

    if (!page || !page.isActive) {
        notFound()
    }

    return (
        <div className="container mx-auto p-8 max-w-4xl">
            <h1 className="text-4xl font-bold mb-8">{page.title}</h1>
            <div className="prose lg:prose-xl dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {page.content || ""}
                </ReactMarkdown>
            </div>
        </div>
    )
}
