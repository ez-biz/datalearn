"use server"

import { prisma } from "@/lib/prisma"
import { Topic, Article } from "@prisma/client"

export async function getTopics() {
    try {
        const topics = await prisma.topic.findMany({
            include: {
                _count: {
                    select: {
                        articles: {
                            where: { status: "PUBLISHED" },
                        },
                    },
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
                    where: { status: "PUBLISHED" },
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        summary: true,
                        readingMinutes: true,
                        createdAt: true,
                        tags: { select: { id: true, slug: true, name: true } },
                    },
                    orderBy: { createdAt: "asc" },
                }
            }
        })
        return { success: true, data: topic }
    } catch (error) {
        console.error("Failed to fetch topic:", error)
        return { success: false, error: "Failed to fetch topic" }
    }
}

/**
 * Public article fetch — only PUBLISHED articles are exposed by slug.
 * Drafts (and SUBMITTED, ARCHIVED) return null so user-facing pages 404.
 */
export async function getArticle(slug: string) {
    try {
        const article = await prisma.article.findFirst({
            where: { slug, status: "PUBLISHED" },
            include: {
                topic: true,
                tags: { select: { id: true, slug: true, name: true } },
                relatedProblems: {
                    where: { status: "PUBLISHED" },
                    select: {
                        id: true,
                        slug: true,
                        title: true,
                        difficulty: true,
                        description: true,
                    },
                    take: 6,
                },
                author: { select: { name: true, image: true } },
            }
        })
        return { success: true, data: article }
    } catch (error) {
        console.error("Failed to fetch article:", error)
        return { success: false, error: "Failed to fetch article" }
    }
}

/** Find the prev/next published article in the same topic by createdAt. */
export async function getArticleNeighbors(slug: string) {
    try {
        const current = await prisma.article.findFirst({
            where: { slug, status: "PUBLISHED" },
            select: { topicId: true, createdAt: true },
        })
        if (!current) return { prev: null, next: null }
        const [prev, next] = await Promise.all([
            prisma.article.findFirst({
                where: {
                    topicId: current.topicId,
                    status: "PUBLISHED",
                    createdAt: { lt: current.createdAt },
                },
                orderBy: { createdAt: "desc" },
                select: { slug: true, title: true },
            }),
            prisma.article.findFirst({
                where: {
                    topicId: current.topicId,
                    status: "PUBLISHED",
                    createdAt: { gt: current.createdAt },
                },
                orderBy: { createdAt: "asc" },
                select: { slug: true, title: true },
            }),
        ])
        return { prev, next }
    } catch (error) {
        console.error("Failed to fetch neighbors:", error)
        return { prev: null, next: null }
    }
}
