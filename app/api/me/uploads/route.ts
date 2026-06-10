import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { withContributor } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { putBlob, delBlobWithRetry } from "@/lib/uploads/blob"
import { reserveBytes, releaseBytes } from "@/lib/uploads/quota"
import { checkUploadRate } from "@/lib/uploads/rate-limit"

const MAX_BYTES = 4 * 1024 * 1024
const PENDING_TTL_MS = 5 * 60 * 1000

const ALLOWED_TYPES = new Set([
    "image/svg+xml",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
])

const EXT_FOR_TYPE: Record<string, string> = {
    "image/svg+xml": "svg",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
}

export const POST = withContributor(async (req, principal) => {
    const lenHeader = req.headers.get("content-length")
    if (lenHeader && Number(lenHeader) > MAX_BYTES + 4096) {
        return NextResponse.json({ error: "oversize" }, { status: 413 })
    }

    const rate = await checkUploadRate(principal.userId)
    if (!rate.ok) {
        return NextResponse.json(
            { error: "rate-limited", retryAfterMs: rate.retryAfterMs },
            { status: 429 }
        )
    }

    const formData = await req.formData()
    const file = formData.get("file")
    if (!(file instanceof Blob)) {
        return NextResponse.json({ error: "no-file" }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json(
            { error: "bad-type", contentType: file.type },
            { status: 415 }
        )
    }
    if (file.size > MAX_BYTES) {
        return NextResponse.json(
            { error: "oversize", bytes: file.size },
            { status: 413 }
        )
    }

    const assetId = randomUUID()
    const blobKey = `learn/${principal.userId}/${assetId}.${EXT_FOR_TYPE[file.type]}`

    try {
        await prisma.$transaction(async (tx) => {
            const reserved = await reserveBytes(tx, principal.userId, file.size)
            if (!reserved) {
                throw new Error("QUOTA_EXCEEDED")
            }
            await tx.asset.create({
                data: {
                    id: assetId,
                    ownerId: principal.userId,
                    blobUrl: null,
                    blobKey,
                    contentType: file.type,
                    bytes: file.size,
                    status: "PENDING",
                    pendingExpiresAt: new Date(Date.now() + PENDING_TTL_MS),
                },
            })
        })
    } catch (error) {
        if (error instanceof Error && error.message === "QUOTA_EXCEEDED") {
            return NextResponse.json({ error: "quota-exceeded" }, { status: 413 })
        }
        console.error("Upload phase 1 failed:", error)
        return NextResponse.json({ error: "phase1-failed" }, { status: 500 })
    }

    let blobUrl: string
    try {
        const body = Buffer.from(await file.arrayBuffer())
        const result = await putBlob(blobKey, body, file.type)
        blobUrl = result.url
    } catch (error) {
        console.error("Upload blob write failed:", error)
        await prisma.$transaction(async (tx) => {
            await tx.asset.update({
                where: { id: assetId },
                data: {
                    status: "DELETED",
                    deletedAt: new Date(),
                    quotaReleasedAt: new Date(),
                },
            })
            await releaseBytes(tx, principal.userId, file.size)
        })
        return NextResponse.json({ error: "blob-write-failed" }, { status: 502 })
    }

    const promote = await prisma.asset.updateMany({
        where: { id: assetId, status: "PENDING" },
        data: { status: "ACTIVE", blobUrl, pendingExpiresAt: null },
    })
    if (promote.count !== 1) {
        try {
            await delBlobWithRetry(blobUrl)
        } catch {
            /* tolerated; orphan sweep handles */
        }
        return NextResponse.json({ error: "promote-race" }, { status: 409 })
    }

    const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } })
    return NextResponse.json({
        id: asset.id,
        url: blobUrl,
        contentType: asset.contentType,
        bytes: asset.bytes,
        createdAt: asset.createdAt,
    })
})

export const GET = withContributor(async (req, principal) => {
    const url = new URL(req.url)
    const requestedLimit = Number(url.searchParams.get("limit") ?? 50)
    const limit = Number.isFinite(requestedLimit)
        ? Math.min(Math.max(requestedLimit, 1), 200)
        : 50
    const cursor = url.searchParams.get("cursor") ?? undefined

    const assets = await prisma.asset.findMany({
        where: { ownerId: principal.userId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
            id: true,
            blobUrl: true,
            contentType: true,
            bytes: true,
            createdAt: true,
        },
    })

    const nextCursor = assets.length > limit ? assets[limit - 1].id : null
    return NextResponse.json({
        items: assets.slice(0, limit),
        nextCursor,
    })
})
