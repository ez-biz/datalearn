"use server"

import type { TrackStatus } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { excludeLockedProblems } from "@/lib/contest-locks"
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

export type TrackDetail = Omit<PublicTrack, "itemCount" | "status"> & {
    /**
     * Only ever anything but PUBLISHED for a staff viewer — getTrackBySlug's
     * where-clause filters unpublished tracks out for everyone else, same
     * as lib/curriculum-read.ts's TrackCurriculum.status. The page uses it
     * to show its "Draft — not visible to learners" banner.
     */
    status: TrackStatus
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
 * `allowDraft` mirrors getTrackCurriculumForUser's (lib/curriculum-read.ts)
 * and the module screen's ADMIN/MODERATOR staff gate: a DRAFT/ARCHIVED
 * track is invisible to learners (404), but staff can preview it. Callers
 * that don't pass it get the learner-only, PUBLISHED-only behavior this
 * function always had.
 *
 * This gate exists specifically so the tracks index and the detail page
 * agree on who can open a track: getTrackSummariesForUser
 * (lib/learn/tracks-read.ts) renders a card for a DRAFT track to a staff
 * viewer, and without this param that card's title link 404s here even
 * though the lesson reader and module screen both honor staff preview for
 * the same track.
 */
export async function getTrackBySlug(
    slug: string,
    allowDraft = false,
): Promise<TrackDetail | null> {
    const track = await prisma.track.findFirst({
        where: { slug, ...(allowDraft ? {} : { status: "PUBLISHED" }) },
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
                where: {
                    problem: excludeLockedProblems({ status: "PUBLISHED" }),
                },
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

    return track
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
