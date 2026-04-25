import { getNews } from "@/actions/news"
import Link from "next/link"

export async function NewsFeed() {
    const { data: news, error } = await getNews()

    if (error || !news) {
        return <div className="text-red-500 text-sm">Failed to load news.</div>
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center">
                <span className="mr-2">📰</span> Latest Data News
            </h2>
            <div className="space-y-4">
                {news.map((item: any, i: number) => (
                    <div key={i} className="border-b last:border-0 pb-4 last:pb-0">
                        <Link
                            href={item.link || "#"}
                            target="_blank"
                            className="font-semibold text-blue-700 hover:underline block"
                        >
                            {item.title}
                        </Link>
                        <p className="text-xs text-gray-500 mt-1">
                            {new Date(item.pubDate).toLocaleDateString()} • {item.source}
                        </p>
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                            {item.contentSnippet}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    )
}
