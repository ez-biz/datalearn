"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import {
    createApproach,
    getApproachesFor,
    removeApproach,
    updateApproach,
    type ApproachView,
    type Result,
} from "@/lib/workspace/approaches"

// Session-resolving wrappers. All the logic lives in lib/workspace/approaches.ts
// so it can be tested against a real database without mocking auth().
//
// The split is the rule from CLAUDE.md, not a preference: every export of a
// "use server" module is a client-callable RPC endpoint, so a function taking
// userId as an argument would let any client write as any other user. The
// userId is resolved here, from the session, and never accepted as input.

export type { ApproachView }

export async function getApproaches(
    problemSlug: string
): Promise<ApproachView[]> {
    const session = await auth()
    return getApproachesFor(problemSlug, session?.user?.id ?? null)
}

export async function postApproach(input: {
    problemSlug: string
    sql: string
    strategy: string | null
}): Promise<Result> {
    const session = await auth()
    if (!session?.user?.id) {
        return { ok: false, reason: "Sign in to share an approach." }
    }
    const result = await createApproach(session.user.id, input)
    if (result.ok) revalidatePath(`/practice/${input.problemSlug}`)
    return result
}

export async function editApproach(input: {
    id: string
    sql: string
    strategy: string | null
}): Promise<Result> {
    const session = await auth()
    if (!session?.user?.id) return { ok: false, reason: "Sign in first." }
    return updateApproach(session.user.id, input)
}

export async function deleteApproach(id: string): Promise<Result> {
    const session = await auth()
    if (!session?.user?.id) return { ok: false, reason: "Sign in first." }
    return removeApproach(session.user.id, id)
}
