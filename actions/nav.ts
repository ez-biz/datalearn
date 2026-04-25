"use server"

import { prisma } from "@/lib/prisma"

export async function getNavLinks() {
    try {
        const pages = await prisma.page.findMany({
            where: { isActive: true },
            select: { title: true, slug: true },
            orderBy: { createdAt: 'asc' }
        })
        return { success: true, data: pages }
    } catch (error) {
        return { success: false, data: [] }
    }
}
