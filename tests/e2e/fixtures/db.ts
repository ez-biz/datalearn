/**
 * E2E DB fixtures.
 *
 * NextAuth v5 with the Prisma adapter persists sessions as
 * (sessionToken, userId, expires). We bypass OAuth entirely by inserting
 * a `User` and a `Session` row directly, then attaching the session
 * cookie to Playwright's request context. The cookie name is
 * "authjs.session-token" by default (HTTP) — Auth.js / next-auth v5.
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { randomUUID } from "node:crypto"
import "dotenv/config"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
export const prisma = new PrismaClient({ adapter })

export const SESSION_COOKIE_NAME = "authjs.session-token"

export type SeededUser = {
    id: string
    email: string
    sessionToken: string
}

/** Create a fresh user with a fresh session, return both. */
export async function seedUser(opts: {
    email: string
    role?: "USER" | "ADMIN"
    name?: string
}): Promise<SeededUser> {
    const user = await prisma.user.upsert({
        where: { email: opts.email },
        update: { role: opts.role ?? "USER" },
        create: {
            email: opts.email,
            name: opts.name ?? opts.email.split("@")[0],
            role: opts.role ?? "USER",
        },
    })

    // Wipe stale sessions for this user, then mint a fresh one.
    await prisma.session.deleteMany({ where: { userId: user.id } })
    const sessionToken = randomUUID()
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await prisma.session.create({
        data: { sessionToken, userId: user.id, expires },
    })
    return { id: user.id, email: user.email!, sessionToken }
}

export async function deleteUser(email: string): Promise<void> {
    const u = await prisma.user.findUnique({ where: { email } })
    if (!u) return
    // Cascades on Account/Session/Submission/ApiKey/ProblemReport.user
    await prisma.user.delete({ where: { id: u.id } })
}

/** Build a Playwright cookie record for a seeded session. */
export function sessionCookie(
    sessionToken: string,
    baseURL: string
): {
    name: string
    value: string
    domain: string
    path: string
    httpOnly: boolean
    secure: boolean
    sameSite: "Lax"
    expires: number
} {
    const url = new URL(baseURL)
    return {
        name: SESSION_COOKIE_NAME,
        value: sessionToken,
        domain: url.hostname,
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
        expires: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    }
}
