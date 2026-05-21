import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { validateArticleDirectivesSyntactic } from "../lib/admin-validation"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const CONTENT = `# How a JOIN works

A SQL JOIN combines rows from two tables based on a related column. The database does not loop in your head. It builds a result one row at a time.

## The mental model

:::figure{src="/learn/img/joins-hero.svg" alt="Two tables joined by customer_id"}
orders.customer_id maps to customers.id. Three rows on the left find matches on the right.
:::

Every row in \`orders\` tries to find a matching row in \`customers\` where \`customer_id = id\`. When a match is found, columns from both rows become one output row.

## How the engine evaluates it

:::mermaid{alt="JOIN evaluation flow"}
flowchart LR
  A[Scan orders] --> B{For each row}
  B --> C{Probe customers.id}
  C -->|match| D[Emit joined row]
  C -->|no match| E[Drop or keep NULL]
:::

## Walkthrough in three steps

:::steps
1. **Pick the driver table** - the optimizer starts with a table such as \`orders\`.
   ![](/learn/img/joins-step-1.svg)
2. **Probe the join column** - for each driver row, look up the matching \`customers.id\`.
   ![](/learn/img/joins-step-2.svg)
3. **Emit the joined row** - concatenate columns from both sides into the result.
   ![](/learn/img/joins-step-3.svg)
:::

## INNER vs LEFT

:::side-by-side
### INNER JOIN - drops the lonely

\`\`\`sql
SELECT c.name, o.total
FROM customers c
INNER JOIN orders o ON o.customer_id = c.id;
\`\`\`

---

### LEFT JOIN - keeps everyone

\`\`\`sql
SELECT c.name, o.total
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id;
\`\`\`
:::

:::callout{kind="pitfall"}
Putting a filter on the right table of a LEFT JOIN in the \`WHERE\` clause silently turns it back into an INNER JOIN. Move that filter into the \`ON\` clause instead.
:::

## The optimizer's choice

:::figure{src="/learn/img/joins-hash-vs-nested.svg" alt="Hash join vs nested loop comparison"}
Hash join: O(n+m) but needs memory. Nested loop: O(n*m) but works without one.
:::

Once you can picture the driver-probe-emit loop, every JOIN variant is just a tweak on which rows survive each stage.
`

async function main() {
    const adminEmail = "anchitgupt2012@gmail.com"
    const admin = await prisma.user.findFirst({ where: { email: adminEmail } })
    if (!admin) {
        throw new Error(
            `seed-visual-lesson: admin user with email ${adminEmail} not found`
        )
    }

    const topic = await prisma.topic.upsert({
        where: { slug: "joins" },
        create: {
            name: "Joins",
            slug: "joins",
            description: "Combine rows from related tables.",
        },
        update: {
            name: "Joins",
            description: "Combine rows from related tables.",
        },
    })

    const validated = validateArticleDirectivesSyntactic(CONTENT)
    if (!validated.ok) {
        throw new Error(
            `seed-visual-lesson: invalid content: ${JSON.stringify(
                validated.errors
            )}`
        )
    }

    const slug = "how-a-join-works"
    const existing = await prisma.article.findUnique({ where: { slug } })
    const data = {
        title: "How a JOIN works",
        content: CONTENT,
        summary:
            "Trace the driver-probe-emit loop behind SQL joins with diagrams and examples.",
        status: "PUBLISHED" as const,
        topicId: topic.id,
        authorId: admin.id,
        readingMinutes: Math.max(
            1,
            Math.ceil(CONTENT.split(/\s+/).filter(Boolean).length / 200)
        ),
        hasVisualBlocks: validated.hasVisualBlocks,
    }

    if (existing) {
        await prisma.article.update({
            where: { slug },
            data,
        })
        console.log(`seed-visual-lesson: updated ${slug}`)
    } else {
        await prisma.article.create({
            data: {
                ...data,
                slug,
            },
        })
        console.log(`seed-visual-lesson: created ${slug}`)
    }
}

main()
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
