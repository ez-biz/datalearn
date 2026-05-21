import { NextResponse } from "next/server"
import type { AssetStatus } from "@prisma/client"
import { withAdmin } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"

const ASSET_STATUSES = new Set(["PENDING", "ACTIVE", "DELETING", "DELETED"])

export const GET = withAdmin(async (req) => {
    const url = new URL(req.url)
    const rawStatus = url.searchParams.get("status")
    const ownerId = url.searchParams.get("ownerId") ?? undefined
    const requestedLimit = Number(url.searchParams.get("limit") ?? 50)
    const limit = Number.isFinite(requestedLimit)
        ? Math.min(Math.max(requestedLimit, 1), 200)
        : 50

    if (rawStatus && !ASSET_STATUSES.has(rawStatus)) {
        return NextResponse.json(
            { error: "bad-status", status: rawStatus },
            { status: 400 }
        )
    }

    const assets = await prisma.asset.findMany({
        where: {
            ...(rawStatus ? { status: rawStatus as AssetStatus } : {}),
            ...(ownerId ? { ownerId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
            id: true,
            ownerId: true,
            blobUrl: true,
            contentType: true,
            bytes: true,
            status: true,
            deletedAt: true,
            deletionAttempts: true,
            lastDeletionError: true,
            createdAt: true,
        },
    })
    return NextResponse.json({ items: assets })
})
