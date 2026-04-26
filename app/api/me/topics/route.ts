import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withContributor } from "@/lib/api-auth"

/**
 * Topics list — needed by the contributor article editor's topic picker.
 * Same data as /api/admin/topics but without the requireAdmin gate.
 */
export const GET = withContributor(async () => {
    const topics = await prisma.topic.findMany({
        orderBy: { name: "asc" },
        select: { id: true, slug: true, name: true },
    })
    return NextResponse.json({ data: topics })
})
