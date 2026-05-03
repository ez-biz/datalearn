import { NextResponse } from "next/server"
import { z } from "zod"
import { AuthFailure } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { validateDiscussionSettingsUpdate } from "@/lib/admin-validation"
import { requireDiscussionModerator } from "@/lib/discussions/api-auth"
import { DISCUSSION_SETTINGS_ID } from "@/lib/discussions/constants"
import { getDiscussionSettings } from "@/lib/discussions/settings"

export async function GET(req: Request) {
    try {
        const principal = await requireDiscussionModerator(req)
        if (principal.role !== "ADMIN") {
            return NextResponse.json(
                { error: "Admin access required." },
                { status: 403 }
            )
        }

        const settings = await getDiscussionSettings()
        return NextResponse.json({ data: settings })
    } catch (e) {
        if (e instanceof AuthFailure) {
            return NextResponse.json(e.body, { status: e.status })
        }
        console.error("Discussion settings GET failed:", e)
        return NextResponse.json(
            { error: "Internal server error." },
            { status: 500 }
        )
    }
}

export async function PATCH(req: Request) {
    try {
        const principal = await requireDiscussionModerator(req)
        if (principal.role !== "ADMIN") {
            return NextResponse.json(
                { error: "Admin access required." },
                { status: 403 }
            )
        }

        let body: unknown
        try {
            body = await req.json()
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON body." },
                { status: 400 }
            )
        }

        const current = await getDiscussionSettings()
        const parsed = validateDiscussionSettingsUpdate(current, body)
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: z.treeifyError(parsed.error),
                },
                { status: 400 }
            )
        }

        const settings = await prisma.$transaction(async (tx) => {
            const updated = await tx.discussionSettings.update({
                where: { id: DISCUSSION_SETTINGS_ID },
                data: {
                    ...parsed.data,
                    updatedById: principal.userId,
                },
            })

            await tx.discussionModerationLog.create({
                data: {
                    actorId: principal.userId,
                    action: "UPDATE_SETTINGS",
                    targetType: "SETTINGS",
                    targetId: DISCUSSION_SETTINGS_ID,
                    note: "Updated global discussion settings.",
                },
            })

            return updated
        })

        return NextResponse.json({ data: settings })
    } catch (e) {
        if (e instanceof AuthFailure) {
            return NextResponse.json(e.body, { status: e.status })
        }
        console.error("Discussion settings PATCH failed:", e)
        return NextResponse.json(
            { error: "Internal server error." },
            { status: 500 }
        )
    }
}
