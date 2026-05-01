#!/usr/bin/env node
// Bootstrap an ADMIN user.
//
// First-time prod setup: a new install starts with zero admins, but admin-
// gated routes (/admin/*, /api/admin/*) need at least one to function. This
// script flips an existing user's `role` to ADMIN by email. Idempotent —
// re-running on an already-admin user is a no-op.
//
// Usage:
//   DATABASE_URL='<direct-url>' node scripts/bootstrap-admin.mjs <email>
//
// Notes:
// - The user must already exist (sign in once via OAuth, then run this).
// - Use the DIRECT (non-pooled) URL for safety; doesn't matter functionally
//   but keeps the pattern consistent with prisma migrate.

import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const email = process.argv[2]
if (!email) {
    console.error("Usage: node scripts/bootstrap-admin.mjs <email>")
    process.exit(1)
}

if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.")
    process.exit(1)
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

try {
    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, role: true },
    })

    if (!user) {
        console.error(
            `No user with email "${email}" found. Have they signed in via OAuth at least once?`
        )
        process.exit(1)
    }

    if (user.role === "ADMIN") {
        console.log(`✓ ${user.email} (${user.name ?? "no name"}) is already ADMIN — no-op.`)
        process.exit(0)
    }

    const updated = await prisma.user.update({
        where: { id: user.id },
        data: { role: "ADMIN" },
        select: { email: true, role: true },
    })

    console.log(`✓ Promoted ${updated.email} to ${updated.role}.`)
} catch (err) {
    console.error("Failed:", err)
    process.exit(1)
} finally {
    await prisma.$disconnect()
    await pool.end().catch(() => {})
}
