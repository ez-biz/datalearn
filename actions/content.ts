"use server"

import { prisma } from "@/lib/prisma"
import { Topic, Article } from "@prisma/client"

export async function getTopics() {
    try {
        const topics = await prisma.topic.findMany({
            include: {
                _count: {
                    select: { articles: true },
                },
            },
            orderBy: {
                name: 'asc'
            }
        })
        return { success: true, data: topics }
    } catch (error) {
        console.error("Failed to fetch topics:", error)
        return { success: false, error: "Failed to fetch topics" }
    }
}

export async function getTopic(slug: string) {
    try {
        const topic = await prisma.topic.findUnique({
            where: { slug },
            include: {
                articles: {
                    where: { published: true },
                    select: { id: true, title: true, slug: true, createdAt: true }
                }
            }
        })
        return { success: true, data: topic }
    } catch (error) {
        console.error("Failed to fetch topic:", error)
        return { success: false, error: "Failed to fetch topic" }
    }
}

export async function getArticle(slug: string) {
    try {
        const article = await prisma.article.findUnique({
            where: { slug },
            include: {
                topic: true
            }
        })
        return { success: true, data: article }
    } catch (error) {
        console.error("Failed to fetch article:", error)
        return { success: false, error: "Failed to fetch article" }
    }
}
