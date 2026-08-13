"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { excludeLockedProblems } from "@/lib/contest-locks"
import { getTrackBySlugForViewer } from "@/lib/learn/tracks-read"
import {
    getTrackProgressForUser,
    type TrackProgress,
} from "@/lib/tracks"

export type { TrackDetail } from "@/lib/learn/tracks-read"

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
                    items: {
                        where: {
                            problem: excludeLockedProblems({
                                status: "PUBLISHED",
                            }),
                        },
                    },
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

/**
 * Same ADMIN/MODERATOR staff gate as the tracks index
 * (getTrackSummariesForUser in lib/learn/tracks-read.ts), the lesson reader
 * (actions/curriculum.ts's getTrackCurriculum) and the module screen — a
 * card on the index for a DRAFT/ARCHIVED track only renders a working title
 * link if this page honors the same preview gate those two screens do.
 *
 * Thin session-resolving wrapper — the real logic lives in
 * `lib/learn/tracks-read.ts` (not a server action, since it takes an
 * explicit allowDraft).
 */
export async function getTrackBySlug(slug: string) {
    // `auth()` throws synchronously (not a rejected promise) when called
    // outside a request scope — e.g. from a test harness — so this must be
    // a try/catch, not a `.catch()` chained onto the call. Matches the
    // established fail-closed pattern in actions/curriculum.ts's
    // getTrackCurriculum.
    let allowDraft = false
    try {
        const session = await auth()
        const role = session?.user?.role
        // Same staff gate as app/admin/layout.tsx, so draft preview and the
        // admin portal agree on who is staff.
        allowDraft = role === "ADMIN" || role === "MODERATOR"
    } catch {
        allowDraft = false
    }
    return getTrackBySlugForViewer(slug, allowDraft)
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
