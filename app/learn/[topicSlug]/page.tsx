import Link from "next/link"
import { getTopic } from "@/actions/content"
import { notFound } from "next/navigation"

type Props = {
    params: Promise<{ topicSlug: string }>
}

export default async function TopicPage({ params }: Props) {
    const { topicSlug } = await params
    const { data: topic, error } = await getTopic(topicSlug)

    if (error || !topic) {
        notFound()
    }

    return (
        <div className="container mx-auto p-8">
            <div className="mb-8">
                <Link href="/learn" className="text-blue-600 hover:underline mb-4 inline-block">&larr; Back to Topics</Link>
                <h1 className="text-4xl font-bold">{topic.name}</h1>
                <p className="text-xl text-gray-600 mt-2">{topic.description}</p>
            </div>

            <div className="bg-white rounded-lg border divide-y">
                {topic.articles.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No articles found in this topic yet.</div>
                ) : (
                    topic.articles.map((article: any) => (
                        <Link
                            key={article.id}
                            href={`/learn/${topicSlug}/${article.slug}`}
                            className="block p-6 hover:bg-gray-50 transition-colors"
                        >
                            <h2 className="text-xl font-semibold mb-1">{article.title}</h2>
                            <div className="flex items-center text-sm text-gray-500">
                                <span>{new Date(article.createdAt).toLocaleDateString()}</span>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    )
}
