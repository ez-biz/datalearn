"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
    getTrackProgressForUser,
    type TrackProgress,
} from "@/lib/tracks"

export type PublicTrack = {
    id: string
    slug: string
    name: string
    summary: string
    difficulty: "EASY" | "MEDIUM" | "HARD" | "MIXED"
    status: "PUBLISHED"
    estimatedMinutes: number
    coverImageUrl: string | null
    itemCount: number
    createdAt: Date
    updatedAt: Date
}

export type TrackDetail = Omit<PublicTrack, "itemCount"> & {
    description: string
    items: Array<{
        id: string
        position: number
        problem: {
            id: string
            number: number
            slug: string
            title: string
            difficulty: "EASY" | "MEDIUM" | "HARD"
        }
    }>
}

export async function getPublishedTracks(): Promise<PublicTrack[]> {
    const tracks = await prisma.track.findMany({
        where: { status: "PUBLISHED" },
        orderBy: [{ createdAt: "desc" }, { name: "asc" }],
        select: {
            id: true,
            slug: true,
            name: true,
            summary: true,
            difficulty: true,
            status: true,
            estimatedMinutes: true,
            coverImageUrl: true,
            createdAt: true,
            updatedAt: true,
            _count: {
                select: {
                    items: { where: { problem: { status: "PUBLISHED" } } },
                },
            },
        },
    })

    return tracks.map((track) => ({
        id: track.id,
        slug: track.slug,
        name: track.name,
        summary: track.summary,
        difficulty: track.difficulty,
        status: "PUBLISHED",
        estimatedMinutes: track.estimatedMinutes,
        coverImageUrl: track.coverImageUrl,
        itemCount: track._count.items,
        createdAt: track.createdAt,
        updatedAt: track.updatedAt,
    }))
}

export async function getTrackBySlug(
    slug: string,
): Promise<TrackDetail | null> {
    const track = await prisma.track.findFirst({
        where: { slug, status: "PUBLISHED" },
        select: {
            id: true,
            slug: true,
            name: true,
            summary: true,
            description: true,
            difficulty: true,
            status: true,
            estimatedMinutes: true,
            coverImageUrl: true,
            createdAt: true,
            updatedAt: true,
            items: {
                where: { problem: { status: "PUBLISHED" } },
                orderBy: { position: "asc" },
                select: {
                    id: true,
                    position: true,
                    problem: {
                        select: {
                            id: true,
                            number: true,
                            slug: true,
                            title: true,
                            difficulty: true,
                        },
                    },
                },
            },
        },
    })
    if (!track) return null

    return {
        ...track,
        status: "PUBLISHED",
    }
}

export async function getTrackProgress(trackId: string): Promise<TrackProgress> {
    const userId = await getCurrentUserId()
    return getTrackProgressForUser(trackId, userId)
}

async function getCurrentUserId(): Promise<string | null> {
    try {
        const session = await auth()
        return session?.user?.id ?? null
    } catch {
        return null
    }
}
