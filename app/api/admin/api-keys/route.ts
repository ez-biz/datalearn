import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import {
    generateApiKey,
    hashApiKey,
    withAdmin,
} from "@/lib/api-auth"
import { ApiKeyCreateInput } from "@/lib/admin-validation"

export const GET = withAdmin(async () => {
    const keys = await prisma.apiKey.findMany({
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            name: true,
            prefix: true,
            lastUsedAt: true,
            expiresAt: true,
            revokedAt: true,
            createdAt: true,
            createdBy: { select: { id: true, name: true, email: true } },
        },
    })
    return NextResponse.json({ data: keys })
})

export const POST = withAdmin(async (req, principal) => {
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }
    const parsed = ApiKeyCreateInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 }
        )
    }
    const { plaintext, prefix } = generateApiKey()
    try {
        const key = await prisma.apiKey.create({
            data: {
                name: parsed.data.name,
                prefix,
                keyHash: hashApiKey(plaintext),
                expiresAt: parsed.data.expiresAt ?? null,
                createdById: principal.userId,
            },
            select: {
                id: true,
                name: true,
                prefix: true,
                expiresAt: true,
                createdAt: true,
            },
        })
        // Plaintext is returned ONCE — caller must record it.
        return NextResponse.json(
            { data: { ...key, plaintext } },
            { status: 201 }
        )
    } catch (e) {
        console.error("Create API key failed:", e)
        return NextResponse.json(
            { error: "Failed to create API key." },
            { status: 500 }
        )
    }
})
