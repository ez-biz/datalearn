"use server"

import Parser from 'rss-parser'
import { unstable_cache } from 'next/cache'

const parser = new Parser()
const FEED_URL = "https://dataengineeringweekly.substack.com/feed" // Example feed

const getCachedNews = unstable_cache(
    async () => {
        const feed = await parser.parseURL(FEED_URL)
        return feed.items.map(item => ({
            title: item.title,
            link: item.link,
            pubDate: item.pubDate,
            contentSnippet: item.contentSnippet,
            source: "Data Engineering Weekly"
        })).slice(0, 5) // Top 5 news
    },
    ['news-feed'],
    { revalidate: 3600 } // Cache for 1 hour
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

