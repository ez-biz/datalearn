import "dotenv/config"
import assert from "node:assert/strict"
import { prisma } from "../lib/prisma"

async function main() {
    // Sanity 1: enum value can be written and read back.
    const probeSlug = `__test-topic-lane-${Date.now()}`
    const created = await prisma.topic.create({
        data: {
            name: `__probe ${probeSlug}`,
            slug: probeSlug,
            lane: "DATA_ENGINEERING",
            displayOrder: 99,
        },
    })
    assert.equal(created.lane, "DATA_ENGINEERING")
    assert.equal(created.displayOrder, 99)

    // Sanity 2: orderBy lane, displayOrder returns rows in the expected order.
    await Promise.all([
        prisma.topic.create({
            data: {
                name: `__probe-2 ${probeSlug}`,
                slug: `${probeSlug}-2`,
                lane: "SQL",
                displayOrder: 1,
            },
        }),
        prisma.topic.create({
            data: {
                name: `__probe-3 ${probeSlug}`,
                slug: `${probeSlug}-3`,
                lane: "SQL",
                displayOrder: 2,
            },
        }),
    ])
    const ordered = await prisma.topic.findMany({
        where: { slug: { in: [probeSlug, `${probeSlug}-2`, `${probeSlug}-3`] } },
        orderBy: [{ lane: "asc" }, { displayOrder: "asc" }],
        select: { slug: true, lane: true, displayOrder: true },
    })
    // Prisma's enum ordering follows the declaration order in schema.prisma.
    // DATA_ENGINEERING is declared *after* SQL in the enum body, so SQL < DATA_ENGINEERING.
    assert.deepEqual(
        ordered.map((t) => t.slug),
        [`${probeSlug}-2`, `${probeSlug}-3`, probeSlug],
        "expected SQL lane rows before DATA_ENGINEERING lane, both lanes sorted by displayOrder"
    )

    // Cleanup
    await prisma.topic.deleteMany({
        where: { slug: { startsWith: probeSlug } },
    })
    console.log("ok: topic lane schema + ordering test passed")
}

main()
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
