"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

// Caps so v1 surfaces never need pagination. Adjust later if usage warrants.
const MAX_LISTS_PER_USER = 100
const MAX_ITEMS_PER_LIST = 1000

const NameSchema = z.string().trim().min(1).max(80)
const DescriptionSchema = z.string().trim().max(500).optional()

export type ListResult<T = void> =
    | (T extends void ? { ok: true } : { ok: true; data: T })
    | { ok: false; error: string }

async function requireUserId(): Promise<string | null> {
    const session = await auth()
    return session?.user?.id ?? null
}

export type ListSummary = {
    id: string
    name: string
    description: string | null
    itemCount: number
    updatedAt: Date
}

export async function getMyLists(): Promise<ListSummary[]> {
    const userId = await requireUserId()
    if (!userId) return []
    try {
        const rows = await prisma.problemList.findMany({
            where: { ownerId: userId },
            orderBy: { updatedAt: "desc" },
            select: {
                id: true,
                name: true,
                description: true,
                updatedAt: true,
                _count: { select: { items: true } },
            },
        })
        return rows.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            itemCount: r._count.items,
            updatedAt: r.updatedAt,
        }))
    } catch (e) {
        console.error("getMyLists failed:", e)
        return []
    }
}

export type ListWithItems = {
    id: string
    name: string
    description: string | null
    createdAt: Date
    updatedAt: Date
    items: Array<{
        problemId: string
        position: number
        addedAt: Date
        /** Most recent ACCEPTED submission for this user+problem; null if never solved. */
        lastSolvedAt: Date | null
        problem: {
            number: number
            slug: string
            title: string
            difficulty: "EASY" | "MEDIUM" | "HARD"
            status: "DRAFT" | "BETA" | "PUBLISHED" | "ARCHIVED"
        }
    }>
}

export async function getList(listId: string): Promise<ListWithItems | null> {
    const userId = await requireUserId()
    if (!userId) return null
    try {
        const row = await prisma.problemList.findFirst({
            where: { id: listId, ownerId: userId },
            select: {
                id: true,
                name: true,
                description: true,
                createdAt: true,
                updatedAt: true,
                items: {
                    orderBy: { position: "asc" },
                    select: {
                        problemId: true,
                        position: true,
                        addedAt: true,
                        problem: {
                            select: {
                                number: true,
                                slug: true,
                                title: true,
                                difficulty: true,
                                status: true,
                            },
                        },
                    },
                },
            },
        })
        if (!row) return null

        // One indexed query for last-solved per problem in this list.
        // Uses Submission(userId, status) + (userId, problemId, createdAt)
        // indexes — cheap even for the 1000-item cap.
        const problemIds = row.items.map((i) => i.problemId)
        const lastSolvedRows = problemIds.length
            ? await prisma.submission.groupBy({
                  by: ["problemId"],
                  where: {
                      userId,
                      status: "ACCEPTED",
                      problemId: { in: problemIds },
                  },
                  _max: { createdAt: true },
              })
            : []
        const lastSolvedById = new Map(
            lastSolvedRows.map((r) => [r.problemId, r._max.createdAt ?? null])
        )

        return {
            ...row,
            items: row.items.map((it) => ({
                ...it,
                lastSolvedAt: lastSolvedById.get(it.problemId) ?? null,
            })),
        } as ListWithItems
    } catch (e) {
        console.error("getList failed:", e)
        return null
    }
}

/**
 * Returns the IDs of lists this user owns that already contain the
 * given problem. Used by the "Add to list" popover to render checked
 * state without a per-list query.
 */
export async function getListIdsContainingProblem(
    problemId: string
): Promise<string[]> {
    const userId = await requireUserId()
    if (!userId) return []
    try {
        const rows = await prisma.problemListItem.findMany({
            where: {
                problemId,
                list: { ownerId: userId },
            },
            select: { listId: true },
        })
        return rows.map((r) => r.listId)
    } catch (e) {
        console.error("getListIdsContainingProblem failed:", e)
        return []
    }
}

export async function createList(
    input: unknown
): Promise<ListResult<{ id: string }>> {
    const userId = await requireUserId()
    if (!userId) return { ok: false, error: "Sign in to create a list." }
    const parsed = z
        .object({ name: NameSchema, description: DescriptionSchema })
        .safeParse(input)
    if (!parsed.success) {
        return { ok: false, error: "Please give the list a name (1-80 chars)." }
    }

    try {
        const count = await prisma.problemList.count({ where: { ownerId: userId } })
        if (count >= MAX_LISTS_PER_USER) {
            return {
                ok: false,
                error: `You can have at most ${MAX_LISTS_PER_USER} lists. Delete one to make room.`,
            }
        }
        const created = await prisma.problemList.create({
            data: {
                ownerId: userId,
                name: parsed.data.name,
                description: parsed.data.description ?? null,
            },
            select: { id: true },
        })
        revalidatePath("/me/lists")
        return { ok: true, data: { id: created.id } }
    } catch (e) {
        console.error("createList failed:", e)
        return { ok: false, error: "Failed to create list." }
    }
}

export async function renameList(
    listId: string,
    input: unknown
): Promise<ListResult> {
    const userId = await requireUserId()
    if (!userId) return { ok: false, error: "Sign in." }
    const parsed = z
        .object({ name: NameSchema, description: DescriptionSchema })
        .safeParse(input)
    if (!parsed.success) {
        return { ok: false, error: "Please give the list a name (1-80 chars)." }
    }
    try {
        const result = await prisma.problemList.updateMany({
            where: { id: listId, ownerId: userId },
            data: {
                name: parsed.data.name,
                description: parsed.data.description ?? null,
            },
        })
        if (result.count === 0) return { ok: false, error: "List not found." }
        revalidatePath("/me/lists")
        revalidatePath(`/me/lists/${listId}`)
        return { ok: true }
    } catch (e) {
        console.error("renameList failed:", e)
        return { ok: false, error: "Failed to update list." }
    }
}

export async function deleteList(listId: string): Promise<ListResult> {
    const userId = await requireUserId()
    if (!userId) return { ok: false, error: "Sign in." }
    try {
        const result = await prisma.problemList.deleteMany({
            where: { id: listId, ownerId: userId },
        })
        if (result.count === 0) return { ok: false, error: "List not found." }
        revalidatePath("/me/lists")
        return { ok: true }
    } catch (e) {
        console.error("deleteList failed:", e)
        return { ok: false, error: "Failed to delete list." }
    }
}

/**
 * Add a problem to a list. No-op if the row already exists.
 * `position` is set to MAX(position)+1 so newest appends land last.
 */
export async function addToList(
    listId: string,
    problemSlug: string
): Promise<ListResult> {
    const userId = await requireUserId()
    if (!userId) return { ok: false, error: "Sign in." }
    try {
        const list = await prisma.problemList.findFirst({
            where: { id: listId, ownerId: userId },
            select: { id: true, _count: { select: { items: true } } },
        })
        if (!list) return { ok: false, error: "List not found." }
        if (list._count.items >= MAX_ITEMS_PER_LIST) {
            return {
                ok: false,
                error: `This list is full (${MAX_ITEMS_PER_LIST} items max).`,
            }
        }
        const problem = await prisma.sQLProblem.findUnique({
            where: { slug: problemSlug },
            select: { id: true, status: true },
        })
        if (!problem || problem.status !== "PUBLISHED") {
            return { ok: false, error: "Problem not found." }
        }

        // Mint the next position inside the same DB call to avoid races.
        // Conflict on (listId, problemId) is silent — adding the same
        // problem twice is a no-op, not an error.
        const max = await prisma.problemListItem.aggregate({
            where: { listId },
            _max: { position: true },
        })
        const nextPosition = (max._max.position ?? 0) + 1
        try {
            await prisma.problemListItem.create({
                data: {
                    listId,
                    problemId: problem.id,
                    position: nextPosition,
                },
            })
        } catch (e: any) {
            if (e?.code === "P2002") {
                // Already in the list — treat as success.
                return { ok: true }
            }
            throw e
        }
        // Touch the list so it sorts to the top of the index.
        await prisma.problemList.update({
            where: { id: listId },
            data: { updatedAt: new Date() },
        })
        revalidatePath("/me/lists")
        revalidatePath(`/me/lists/${listId}`)
        return { ok: true }
    } catch (e) {
        console.error("addToList failed:", e)
        return { ok: false, error: "Failed to add to list." }
    }
}

export async function removeFromList(
    listId: string,
    problemSlug: string
): Promise<ListResult> {
    const userId = await requireUserId()
    if (!userId) return { ok: false, error: "Sign in." }
    try {
        const list = await prisma.problemList.findFirst({
            where: { id: listId, ownerId: userId },
            select: { id: true },
        })
        if (!list) return { ok: false, error: "List not found." }
        const problem = await prisma.sQLProblem.findUnique({
            where: { slug: problemSlug },
            select: { id: true },
        })
        if (!problem) return { ok: false, error: "Problem not found." }
        await prisma.problemListItem.deleteMany({
            where: { listId, problemId: problem.id },
        })
        await prisma.problemList.update({
            where: { id: listId },
            data: { updatedAt: new Date() },
        })
        revalidatePath("/me/lists")
        revalidatePath(`/me/lists/${listId}`)
        return { ok: true }
    } catch (e) {
        console.error("removeFromList failed:", e)
        return { ok: false, error: "Failed to remove from list." }
    }
}

/**
 * Reorder a list to match the provided sequence of problem IDs. Any IDs
 * not in the input are dropped from the list. Caller is expected to send
 * the full ordering after a drag-drop.
 */
export async function reorderList(
    listId: string,
    problemIds: string[]
): Promise<ListResult> {
    const userId = await requireUserId()
    if (!userId) return { ok: false, error: "Sign in." }
    try {
        const list = await prisma.problemList.findFirst({
            where: { id: listId, ownerId: userId },
            select: { id: true },
        })
        if (!list) return { ok: false, error: "List not found." }
        // Re-stamp positions in a single transaction so we never observe a
        // half-reordered list.
        await prisma.$transaction(
            problemIds.map((problemId, i) =>
                prisma.problemListItem.update({
                    where: { listId_problemId: { listId, problemId } },
                    data: { position: i + 1 },
                })
            )
        )
        await prisma.problemList.update({
            where: { id: listId },
            data: { updatedAt: new Date() },
        })
        revalidatePath(`/me/lists/${listId}`)
        return { ok: true }
    } catch (e) {
        console.error("reorderList failed:", e)
        return { ok: false, error: "Failed to reorder list." }
    }
}
