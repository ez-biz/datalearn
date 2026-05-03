import { prisma } from "@/lib/prisma"
import { DISCUSSION_SETTINGS_ID } from "./constants"

export async function getDiscussionSettings() {
    return prisma.discussionSettings.upsert({
        where: { id: DISCUSSION_SETTINGS_ID },
        update: {},
        create: { id: DISCUSSION_SETTINGS_ID },
    })
}
