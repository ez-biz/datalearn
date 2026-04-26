import { NextResponse } from "next/server"
import type { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"

const ROLE_VALUES = new Set<UserRole>(["USER", "CONTRIBUTOR", "ADMIN"])

export const GET = withAdmin(async (req) => {
    const url = new URL(req.url)
    const roleFilter = url.searchParams.get("role") as UserRole | null
    const q = url.searchParams.get("q")?.trim() ?? ""

    const where: any = {}
    if (roleFilter && ROLE_VALUES.has(roleFilter)) {
        where.role = roleFilter
    }
    if (q) {
        where.OR = [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
        ]
    }

    const users = await prisma.user.findMany({
        where,
        orderBy: [{ role: "desc" }, { createdAt: "asc" }],
        take: 200,
        select: {
            id: true,
            email: true,
            name: true,
            image: true,
            role: true,
            createdAt: true,
            _count: {
                select: { articles: true },
            },
        },
    })
    return NextResponse.json({ data: users })
})
