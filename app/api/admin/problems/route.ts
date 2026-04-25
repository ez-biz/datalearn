import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import {
    ProblemCreateInput,
    SqlSchemaCreateInput,
} from "@/lib/admin-validation"
import { snapshotProblemVersion } from "@/lib/problem-versions"

export const GET = withAdmin(async () => {
    const problems = await prisma.sQLProblem.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            schema: { select: { id: true, name: true } },
            tags: { select: { id: true, name: true, slug: true } },
            _count: { select: { submissions: true } },
        },
    })
    return NextResponse.json({ data: problems })
})

export const POST = withAdmin(async (req, principal) => {
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const parsed = ProblemCreateInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 }
        )
    }
    const input = parsed.data

    try {
        const created = await prisma.$transaction(async (tx) => {
            // resolve schema
            let schemaId: string
            if (input.schemaId) {
                const exists = await tx.sqlSchema.findUnique({
                    where: { id: input.schemaId },
                    select: { id: true },
                })
                if (!exists) {
                    throw new Error("SCHEMA_NOT_FOUND")
                }
                schemaId = exists.id
            } else {
                const inline = input.schemaInline as z.infer<typeof SqlSchemaCreateInput>
                const newSchema = await tx.sqlSchema.create({
                    data: { name: inline.name, sql: inline.sql },
                    select: { id: true },
                })
                schemaId = newSchema.id
            }

            // resolve tags (slug-keyed; create-on-fly)
            const tagSlugs = input.tagSlugs ?? []
            const tagIds: string[] = []
            for (const tagSlug of tagSlugs) {
                const tag = await tx.tag.upsert({
                    where: { slug: tagSlug },
                    update: {},
                    create: { slug: tagSlug, name: tagSlug.replace(/-/g, " ") },
                    select: { id: true },
                })
                tagIds.push(tag.id)
            }

            const problem = await tx.sQLProblem.create({
                data: {
                    title: input.title,
                    slug: input.slug,
                    difficulty: input.difficulty,
                    status: input.status,
                    description: input.description,
                    schemaDescription: input.schemaDescription,
                    schemaId,
                    expectedOutput: input.expectedOutput!,
                    solutionSql: input.solutionSql ?? null,
                    ordered: input.ordered,
                    hints: input.hints,
                    tags: {
                        connect: tagIds.map((id) => ({ id })),
                    },
                },
                include: {
                    schema: { select: { id: true, name: true } },
                    tags: { select: { id: true, name: true, slug: true } },
                },
            })
            // Snapshot if the problem is created already PUBLISHED
            if (problem.status === "PUBLISHED") {
                await snapshotProblemVersion(tx, problem.id, principal.userId)
            }
            return problem
        })

        return NextResponse.json({ data: created }, { status: 201 })
    } catch (e: any) {
        if (e?.message === "SCHEMA_NOT_FOUND") {
            return NextResponse.json(
                { error: "schemaId does not match any SqlSchema." },
                { status: 400 }
            )
        }
        if (e?.code === "P2002") {
            return NextResponse.json(
                { error: "A problem with that slug already exists." },
                { status: 409 }
            )
        }
        console.error("Create problem failed:", e)
        return NextResponse.json(
            { error: "Failed to create problem." },
            { status: 500 }
        )
    }
})

