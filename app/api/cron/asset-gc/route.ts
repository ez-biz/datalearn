import { list } from "@vercel/blob"
import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { blobExists, delBlobWithRetry } from "@/lib/uploads/blob"
import { releaseBytes } from "@/lib/uploads/quota"

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000

function isAuthorized(req: NextRequest): boolean {
    return req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`
}

async function handleAssetGc(req: NextRequest) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }

    const out = {
        tombstones: { deleted: 0, failed: 0, bytesReclaimed: 0 },
        deleting: { deleted: 0, failed: 0 },
        pending: { promoted: 0, removed: 0 },
        orphan: { skipped: true, deleted: 0 },
    }

    const tombstoneCutoff = new Date(Date.now() - SEVEN_DAYS_MS)
    const tombstones = await prisma.asset.findMany({
        where: { status: "DELETED", deletedAt: { lt: tombstoneCutoff } },
        select: { id: true, blobUrl: true, ownerId: true, bytes: true },
    })
    for (const tombstone of tombstones) {
        if (!tombstone.blobUrl) continue
        try {
            await delBlobWithRetry(tombstone.blobUrl)
            await prisma.$transaction(async (tx) => {
                await tx.asset.delete({ where: { id: tombstone.id } })
                await releaseBytes(tx, tombstone.ownerId, tombstone.bytes)
            })
            out.tombstones.deleted++
            out.tombstones.bytesReclaimed += tombstone.bytes
        } catch {
            out.tombstones.failed++
        }
    }

    const deletingAssets = await prisma.asset.findMany({
        where: { status: "DELETING" },
        select: {
            id: true,
            blobUrl: true,
            ownerId: true,
            bytes: true,
            deletionAttempts: true,
        },
    })
    for (const asset of deletingAssets) {
        if (!asset.blobUrl) continue
        try {
            await delBlobWithRetry(asset.blobUrl)
            await prisma.$transaction(async (tx) => {
                await tx.asset.update({
                    where: { id: asset.id },
                    data: { status: "DELETED", lastDeletionError: null },
                })
                await releaseBytes(tx, asset.ownerId, asset.bytes)
            })
            out.deleting.deleted++
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            await prisma.asset.update({
                where: { id: asset.id },
                data: {
                    deletionAttempts: { increment: 1 },
                    lastDeletionError: message.slice(0, 500),
                },
            })
            out.deleting.failed++
            if (asset.deletionAttempts + 1 >= 24) {
                console.error("[asset-gc] gcDeletingStuck", {
                    assetId: asset.id,
                    attempts: asset.deletionAttempts + 1,
                    error: message,
                })
            }
        }
    }

    const pendingExpired = await prisma.asset.findMany({
        where: { status: "PENDING", pendingExpiresAt: { lt: new Date() } },
        select: { id: true, blobKey: true, ownerId: true, bytes: true },
    })
    for (const pending of pendingExpired) {
        const blobUrlGuess = `https://${process.env.BLOB_HOST ?? "store.vercel-storage.com"}/${pending.blobKey}`
        const exists = await blobExists(blobUrlGuess)
        if (exists) {
            await prisma.asset.update({
                where: { id: pending.id, status: "PENDING" },
                data: {
                    status: "ACTIVE",
                    blobUrl: blobUrlGuess,
                    pendingExpiresAt: null,
                },
            })
            out.pending.promoted++
        } else {
            await prisma.$transaction(async (tx) => {
                await tx.asset.delete({ where: { id: pending.id } })
                await releaseBytes(tx, pending.ownerId, pending.bytes)
            })
            out.pending.removed++
        }
    }

    if (process.env.BLOB_READ_WRITE_TOKEN) {
        out.orphan.skipped = false
        let cursor: string | undefined
        do {
            const result = await list({ prefix: "learn/", cursor, limit: 1000 })
            const blobs = result.blobs
            if (blobs.length === 0) break

            const urls = blobs.map((blob) => blob.url)
            const known = await prisma.asset.findMany({
                where: { blobUrl: { in: urls } },
                select: { blobUrl: true },
            })
            const knownUrls = new Set(known.map((asset) => asset.blobUrl))
            for (const blob of blobs) {
                if (knownUrls.has(blob.url)) continue
                const ageMs = Date.now() - new Date(blob.uploadedAt).getTime()
                if (ageMs < ONE_DAY_MS) continue
                try {
                    await delBlobWithRetry(blob.url)
                    out.orphan.deleted++
                } catch {
                    /* next run retries */
                }
            }
            cursor = result.cursor
        } while (cursor)
    }

    return NextResponse.json({ sweep: "complete", result: out })
}

export const GET = handleAssetGc
export const POST = handleAssetGc
