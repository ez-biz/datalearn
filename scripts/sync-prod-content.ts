/**
 * Sync content from production to a local development database.
 *
 * Usage:
 *   vercel env pull .env.production.local
 *   set -a; source .env.production.local; set +a
 *   PROD_DATABASE_URL="$DATABASE_URL" \
 *   DATABASE_URL="postgresql://anchitgupta@localhost:5432/datalearn" \
 *     npm run sync:prod-content
 *
 * Flags:
 *   --dry-run   Read from prod, print what would be written, no local writes.
 *   --replace   Truncate local content tables before inserting. Default is upsert.
 *
 * Safety:
 *   - Refuses to run when PROD_DATABASE_URL is unset.
 *   - Refuses to run when PROD_DATABASE_URL === DATABASE_URL.
 *   - Refuses --replace when NODE_ENV === "production".
 *   - Requires a local admin user (Article.authorId is remapped to that user).
 *
 * Scope: content tables only. Skips User/Account/Session/ApiKey and every
 * user-owned table. Articles have their authorId remapped to the local
 * admin user. See docs/superpowers/handoff/2026-05-23-... or the recent
 * brainstorming session for the design rationale.
 */
import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const args = new Set(process.argv.slice(2))
const isDryRun = args.has("--dry-run")
const isReplace = args.has("--replace")

const PROD_URL = process.env.PROD_DATABASE_URL
const LOCAL_URL = process.env.DATABASE_URL

function die(msg: string): never {
    console.error(`\n${msg}\n`)
    process.exit(1)
}

if (!PROD_URL) {
    die(
        [
            "PROD_DATABASE_URL is not set. To run:",
            "",
            "  vercel env pull .env.production.local",
            "  set -a; source .env.production.local; set +a",
            '  PROD_DATABASE_URL="$DATABASE_URL" \\',
            '  DATABASE_URL="postgresql://anchitgupta@localhost:5432/datalearn" \\',
            "    npm run sync:prod-content",
            "",
            "Note: vercel env pull writes prod's DATABASE_URL into the file as",
            "DATABASE_URL. The script needs it under the name PROD_DATABASE_URL,",
            "so the two env vars get swapped on the npm run line above.",
        ].join("\n")
    )
}

if (!LOCAL_URL) {
    die("DATABASE_URL is not set. This script writes to your local DB; configure .env first.")
}

if (PROD_URL === LOCAL_URL) {
    die(
        "PROD_DATABASE_URL and DATABASE_URL are the same. Refusing to run — you'd be syncing the DB to itself. Re-check the env swap recipe in the docstring."
    )
}

if (isReplace && process.env.NODE_ENV === "production") {
    die("--replace refused when NODE_ENV=production. This is a dev-only tool.")
}

const prodPool = new Pool({ connectionString: PROD_URL })
const localPool = new Pool({ connectionString: LOCAL_URL })
const prodPrisma = new PrismaClient({ adapter: new PrismaPg(prodPool) })
const localPrisma = new PrismaClient({ adapter: new PrismaPg(localPool) })

const summary: Record<string, number> = {}
function record(key: string, n = 1) {
    summary[key] = (summary[key] ?? 0) + n
}

async function findLocalAdmin(): Promise<{ id: string; email: string | null }> {
    // Prefer the well-known seed admin email; fall back to any ADMIN role user.
    const known = await localPrisma.user.findUnique({
        where: { email: "anchitgupt2012@gmail.com" },
    })
    if (known) return { id: known.id, email: known.email }
    const anyAdmin = await localPrisma.user.findFirst({
        where: { role: "ADMIN" },
        orderBy: { createdAt: "asc" },
    })
    if (anyAdmin) return { id: anyAdmin.id, email: anyAdmin.email }
    die(
        [
            "No local admin user found. Article.authorId remap needs an ADMIN-role user locally.",
            "Bootstrap one with:",
            "  npx prisma db seed",
            "Then re-run this script.",
        ].join("\n")
    )
}

async function maybeTruncate() {
    if (!isReplace) return
    if (isDryRun) {
        console.log("[dry-run] would TRUNCATE content tables")
        return
    }
    console.log("Truncating local content tables (--replace) ...")
    // Order matters; child tables first.
    await localPrisma.$executeRawUnsafe(
        `TRUNCATE TABLE "TrackItem", "Track", "Article", "SQLProblem", "SqlSchema", "Tag", "Topic" RESTART IDENTITY CASCADE`
    )
    // M-M join tables ("_ArticleTags", "_ArticleProblems", "_ProblemTags") are
    // truncated by CASCADE since they reference the rows above.
}

async function prodHasColumn(table: string, column: string): Promise<boolean> {
    const rows = await prodPrisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = ${table} AND column_name = ${column}
        ) AS "exists"
    `
    return rows[0]?.exists === true
}

async function syncTopics() {
    // Schema-drift tolerance: prod may be behind local. Detect columns at
    // runtime; substitute safe defaults when missing.
    const hasLane = await prodHasColumn("Topic", "lane")
    const hasOrder = await prodHasColumn("Topic", "displayOrder")
    if (!hasLane || !hasOrder) {
        console.warn(
            `  prod schema is behind local for Topic (lane=${hasLane}, displayOrder=${hasOrder}); using defaults for missing columns. Run a main->production release PR to deploy the migration.`
        )
    }

    type ProdTopicRow = {
        id: string
        name: string
        slug: string
        description: string | null
        lane: string
        displayOrder: number
    }
    const topics = await prodPrisma.$queryRawUnsafe<ProdTopicRow[]>(
        `SELECT
            id, name, slug, description,
            ${hasLane ? `lane::text AS lane` : `'SQL'::text AS lane`},
            ${hasOrder ? `"displayOrder"` : `0 AS "displayOrder"`}
        FROM "Topic"`
    )

    for (const t of topics) {
        if (isDryRun) { record("Topic"); continue }
        await localPrisma.topic.upsert({
            where: { slug: t.slug },
            create: {
                id: t.id,
                name: t.name,
                slug: t.slug,
                description: t.description,
                lane: t.lane as "SQL" | "DATA_ENGINEERING",
                displayOrder: t.displayOrder,
            },
            update: {
                name: t.name,
                description: t.description,
                lane: t.lane as "SQL" | "DATA_ENGINEERING",
                displayOrder: t.displayOrder,
            },
        })
        record("Topic")
    }
}

async function syncTags() {
    const tags = await prodPrisma.tag.findMany({
        select: { id: true, name: true, slug: true, kind: true },
    })
    for (const t of tags) {
        if (isDryRun) { record("Tag"); continue }
        await localPrisma.tag.upsert({
            where: { slug: t.slug },
            create: t,
            update: { name: t.name, kind: t.kind },
        })
        record("Tag")
    }
}

async function syncSchemas() {
    const schemas = await prodPrisma.sqlSchema.findMany({
        select: { id: true, name: true, sql: true },
    })
    for (const s of schemas) {
        if (isDryRun) { record("SqlSchema"); continue }
        await localPrisma.sqlSchema.upsert({
            where: { name: s.name },
            create: s,
            update: { sql: s.sql },
        })
        record("SqlSchema")
    }
}

async function syncProblems() {
    const problems = await prodPrisma.sQLProblem.findMany({
        include: {
            schema: { select: { name: true } },
            tags: { select: { slug: true } },
        },
    })
    for (const p of problems) {
        const localSchema = await localPrisma.sqlSchema.findUnique({
            where: { name: p.schema.name },
            select: { id: true },
        })
        if (!localSchema) {
            console.warn(`  skip problem ${p.slug}: schema "${p.schema.name}" not found locally`)
            record("SQLProblem.skipped")
            continue
        }
        if (isDryRun) { record("SQLProblem"); continue }
        await localPrisma.sQLProblem.upsert({
            where: { slug: p.slug },
            create: {
                number: p.number,
                title: p.title,
                slug: p.slug,
                difficulty: p.difficulty,
                status: p.status,
                description: p.description,
                schemaDescription: p.schemaDescription,
                schemaId: localSchema.id,
                expectedOutput: p.expectedOutput,
                solutionSql: p.solutionSql,
                solutions: p.solutions as any,
                expectedOutputs: p.expectedOutputs as any,
                ordered: p.ordered,
                dialects: p.dialects,
                hints: p.hints,
                tags: {
                    connect: p.tags.map((t) => ({ slug: t.slug })),
                },
            },
            update: {
                title: p.title,
                difficulty: p.difficulty,
                status: p.status,
                description: p.description,
                schemaDescription: p.schemaDescription,
                schemaId: localSchema.id,
                expectedOutput: p.expectedOutput,
                solutionSql: p.solutionSql,
                solutions: p.solutions as any,
                expectedOutputs: p.expectedOutputs as any,
                ordered: p.ordered,
                dialects: p.dialects,
                hints: p.hints,
                tags: {
                    set: p.tags.map((t) => ({ slug: t.slug })),
                },
            },
        })
        record("SQLProblem")
    }
}

async function syncArticles(localAdminId: string) {
    const articles = await prodPrisma.article.findMany({
        include: {
            topic: { select: { slug: true } },
            tags: { select: { slug: true } },
            relatedProblems: { select: { slug: true } },
        },
    })
    for (const a of articles) {
        const localTopic = await localPrisma.topic.findUnique({
            where: { slug: a.topic.slug },
            select: { id: true },
        })
        if (!localTopic) {
            console.warn(`  skip article ${a.slug}: topic "${a.topic.slug}" not found locally`)
            record("Article.skipped")
            continue
        }
        if (isDryRun) { record("Article"); continue }
        await localPrisma.article.upsert({
            where: { slug: a.slug },
            create: {
                title: a.title,
                slug: a.slug,
                content: a.content,
                status: a.status,
                hasVisualBlocks: a.hasVisualBlocks,
                summary: a.summary,
                readingMinutes: a.readingMinutes,
                reviewNotes: a.reviewNotes,
                reviewedAt: a.reviewedAt,
                // reviewedBy intentionally not remapped (it's a User id we don't have).
                reviewedBy: null,
                topicId: localTopic.id,
                authorId: localAdminId,
                tags: { connect: a.tags.map((t) => ({ slug: t.slug })) },
                relatedProblems: {
                    connect: a.relatedProblems.map((p) => ({ slug: p.slug })),
                },
            },
            update: {
                title: a.title,
                content: a.content,
                status: a.status,
                hasVisualBlocks: a.hasVisualBlocks,
                summary: a.summary,
                readingMinutes: a.readingMinutes,
                topicId: localTopic.id,
                authorId: localAdminId,
                tags: { set: a.tags.map((t) => ({ slug: t.slug })) },
                relatedProblems: {
                    set: a.relatedProblems.map((p) => ({ slug: p.slug })),
                },
            },
        })
        record("Article")
    }
}

async function syncTracks() {
    const tracks = await prodPrisma.track.findMany({
        include: {
            items: { select: { problem: { select: { slug: true } }, position: true } },
        },
    })
    for (const t of tracks) {
        // Pre-resolve local problem ids for the items.
        const itemSlugs = t.items.map((i) => i.problem.slug)
        const localProblems = await localPrisma.sQLProblem.findMany({
            where: { slug: { in: itemSlugs } },
            select: { id: true, slug: true },
        })
        const slugToId = new Map(localProblems.map((p) => [p.slug, p.id]))

        const itemsForCreate = t.items
            .filter((i) => slugToId.has(i.problem.slug))
            .map((i) => ({
                problemId: slugToId.get(i.problem.slug)!,
                position: i.position,
            }))

        if (isDryRun) {
            record("Track")
            record("TrackItem", itemsForCreate.length)
            continue
        }

        const upserted = await localPrisma.track.upsert({
            where: { slug: t.slug },
            create: {
                slug: t.slug,
                name: t.name,
                summary: t.summary,
                description: t.description,
                difficulty: t.difficulty,
                status: t.status,
                estimatedMinutes: t.estimatedMinutes,
                coverImageUrl: t.coverImageUrl,
            },
            update: {
                name: t.name,
                summary: t.summary,
                description: t.description,
                difficulty: t.difficulty,
                status: t.status,
                estimatedMinutes: t.estimatedMinutes,
                coverImageUrl: t.coverImageUrl,
            },
            select: { id: true },
        })

        // Items are simpler to replace than to diff: delete all existing items
        // for the track, then insert the prod set.
        await localPrisma.trackItem.deleteMany({ where: { trackId: upserted.id } })
        if (itemsForCreate.length > 0) {
            await localPrisma.trackItem.createMany({
                data: itemsForCreate.map((i) => ({
                    trackId: upserted.id,
                    problemId: i.problemId,
                    position: i.position,
                })),
            })
        }
        record("Track")
        record("TrackItem", itemsForCreate.length)
    }
}

async function main() {
    console.log("=== sync-prod-content ===")
    console.log(`Mode: ${isDryRun ? "DRY-RUN" : isReplace ? "REPLACE" : "UPSERT"}`)
    console.log(`PROD: ${PROD_URL!.replace(/:\/\/[^@]+@/, "://****@")}`)
    console.log(`LOCAL: ${LOCAL_URL!.replace(/:\/\/[^@]+@/, "://****@")}`)
    console.log("")

    const admin = await findLocalAdmin()
    console.log(`Article.authorId remap target: ${admin.email ?? "(no email)"} (${admin.id})`)
    console.log("")

    await maybeTruncate()

    console.log("Syncing Topic ...")
    await syncTopics()
    console.log("Syncing Tag ...")
    await syncTags()
    console.log("Syncing SqlSchema ...")
    await syncSchemas()
    console.log("Syncing SQLProblem (with tag M-M) ...")
    await syncProblems()
    console.log("Syncing Article (with tag + relatedProblem M-M; authorId remapped) ...")
    await syncArticles(admin.id)
    console.log("Syncing Track + TrackItem ...")
    await syncTracks()

    console.log("")
    console.log("=== summary ===")
    for (const [key, value] of Object.entries(summary).sort()) {
        console.log(`  ${key.padEnd(24)} ${value}`)
    }
    if (isDryRun) {
        console.log("")
        console.log("(dry-run: no writes performed)")
    }
}

main()
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
    .finally(async () => {
        await Promise.all([prodPrisma.$disconnect(), localPrisma.$disconnect()])
        await Promise.all([prodPool.end(), localPool.end()])
    })
