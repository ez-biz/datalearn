import Link from "next/link"
import { getTopics } from "@/actions/content"

export default async function LearnPage() {
    const { data: topics, error } = await getTopics()

    if (error || !topics) {
        return <div>Failed to load topics</div>
    }

    return (
        <div className="container mx-auto p-8">
            <h1 className="text-4xl font-bold mb-8">Learning Hub</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {topics.map((topic: any) => (
                    <Link
                        key={topic.id}
                        href={`/learn/${topic.slug}`}
                        className="block p-6 bg-white rounded-lg border hover:shadow-lg transition-shadow"
                    >
                        <h2 className="text-2xl font-semibold mb-2">{topic.name}</h2>
                        <p className="text-gray-600 mb-4">{topic.description}</p>
                        <span className="text-sm text-blue-600 font-medium">
                            {topic._count.articles} Articles
                        </span>
                    </Link>
                ))}
            </div>
        </div>
    )
}
