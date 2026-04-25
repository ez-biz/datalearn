"use server"

import { unstable_cache } from 'next/cache'

const FEED_URL = "https://dataengineeringweekly.substack.com/feed"

function extractTag(xml: string, tag: string): string {
    const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
    return (match?.[1] || match?.[2] || "").trim()
}

const getCachedNews = unstable_cache(
    async () => {
        const res = await fetch(FEED_URL, { next: { revalidate: 3600 } })
        const xml = await res.text()

        const items = xml.split("<item>").slice(1, 6) // Top 5
        return items.map(item => ({
            title: extractTag(item, "title"),
            link: extractTag(item, "link"),
            pubDate: extractTag(item, "pubDate"),
            contentSnippet: extractTag(item, "description").replace(/<[^>]+>/g, "").slice(0, 200),
            source: "Data Engineering Weekly"
        }))
    },
    ['news-feed'],
    { revalidate: 3600 }
)

export async function getNews() {
    try {
        const data = await getCachedNews()
        return { success: true, data }
    } catch (error) {
        console.error("Failed to fetch news:", error)
        return { success: false, error: "Failed to fetch news" }
    }
}

