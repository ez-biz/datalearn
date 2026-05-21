import { NextResponse } from "next/server"
import { withContributor } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"

export const DELETE = withContributor(
    async (_req, principal, { params }: { params: Promise<{ id: string }> }) => {
        const { id } = await params
        const asset = await prisma.asset.findUnique({ where: { id } })
        if (!asset) {
            return NextResponse.json({ error: "not-found" }, { status: 404 })
        }
        if (asset.ownerId !== principal.userId) {
            return NextResponse.json({ error: "forbidden" }, { status: 403 })
        }
        if (asset.status !== "ACTIVE") {
            return NextResponse.json(
                { error: "bad-status", status: asset.status },
                { status: 409 }
            )
        }
        if (!asset.blobUrl) {
            return NextResponse.json({ error: "no-blob-url" }, { status: 500 })
        }

        const referencing = await prisma.article.findMany({
            where: { content: { contains: asset.blobUrl } },
            select: { slug: true, status: true },
        })
        if (referencing.length > 0) {
            return NextResponse.json(
                { error: "asset-in-use", articles: referencing },
                { status: 409 }
            )
        }

        await prisma.asset.update({
            where: { id },
            data: { status: "DELETED", deletedAt: new Date() },
        })
        return new NextResponse(null, { status: 204 })
    }
)
