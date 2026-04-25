import { NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export type AdminPrincipal =
    | { kind: "session"; userId: string }
    | { kind: "apiKey"; userId: string; keyId: string }

export class AuthFailure extends Error {
    constructor(public status: number, public body: { error: string }) {
        super(body.error)
    }
}

export function hashApiKey(plaintext: string): string {
    return createHash("sha256").update(plaintext).digest("hex")
}

/**
 * Resolve the request's admin principal. Throws AuthFailure on error.
 * Accepts either a logged-in admin session or an Authorization: Bearer <key> header.
 */
export async function requireAdmin(req: Request): Promise<AdminPrincipal> {
    // Bearer key path
    const header = req.headers.get("authorization") ?? req.headers.get("Authorization")
    if (header?.startsWith("Bearer ")) {
        const plaintext = header.slice("Bearer ".length).trim()
        if (!plaintext) {
            throw new AuthFailure(401, { error: "Missing bearer token." })
        }
        const keyHash = hashApiKey(plaintext)
        const key = await prisma.apiKey.findUnique({
            where: { keyHash },
            include: { createdBy: { select: { id: true, role: true } } },
        })
        if (!key) {
            throw new AuthFailure(401, { error: "Invalid API key." })
        }
        if (key.revokedAt) {
            throw new AuthFailure(401, { error: "API key has been revoked." })
        }
        if (key.expiresAt && key.expiresAt < new Date()) {
            throw new AuthFailure(401, { error: "API key has expired." })
        }
        if (key.createdBy.role !== "ADMIN") {
            throw new AuthFailure(403, { error: "API key owner is not an admin." })
        }
        // best-effort touch
        prisma.apiKey
            .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
            .catch(() => {})
        return { kind: "apiKey", userId: key.createdById, keyId: key.id }
    }

    // Session path — only reached when no Bearer header was sent.
    //
    // SECURITY: cookies are auto-sent on cross-origin requests, so a session
    // alone is CSRF-vulnerable. Reject the request if the Origin header is
    // missing or doesn't match the request's own host (which is what the
    // browser would send for a same-origin request). NEXTAUTH_URL is also
    // checked when set, as a belt-and-suspenders cross-check. Bearer-token
    // requests are unaffected (attackers can't set the Authorization header
    // cross-origin).
    const origin = req.headers.get("origin")
    const reqHost = req.headers.get("host")
    const allowedHosts = new Set<string>()
    if (reqHost) allowedHosts.add(reqHost)
    for (const env of [process.env.NEXTAUTH_URL, process.env.AUTH_URL]) {
        if (!env) continue
        try {
            allowedHosts.add(new URL(env).host)
        } catch {
            /* ignore malformed env */
        }
    }

    if (origin) {
        let originHost: string
        try {
            originHost = new URL(origin).host
        } catch {
            throw new AuthFailure(403, { error: "Malformed Origin header." })
        }
        if (!allowedHosts.has(originHost)) {
            throw new AuthFailure(403, {
                error: "Cross-origin request rejected.",
            })
        }
    } else if (req.method !== "GET" && req.method !== "HEAD") {
        // No Origin header on a write — most modern browsers send it on POST
        // and on `fetch`. Curl / server-to-server callers should be using a
        // Bearer key. Reject to keep CSRF closed.
        throw new AuthFailure(403, {
            error: "Missing Origin header on a write request — use a Bearer API key for non-browser callers.",
        })
    }

    const session = await auth()
    if (!session?.user?.id) {
        throw new AuthFailure(401, { error: "Authentication required." })
    }
    if (session.user.role !== "ADMIN") {
        throw new AuthFailure(403, { error: "Admin access required." })
    }
    return { kind: "session", userId: session.user.id }
}

/** Wrap a route handler so AuthFailure becomes a JSON response. */
export function withAdmin<Args extends unknown[]>(
    handler: (req: Request, principal: AdminPrincipal, ...rest: Args) => Promise<Response>
) {
    return async (req: Request, ...rest: Args): Promise<Response> => {
        try {
            const principal = await requireAdmin(req)
            return await handler(req, principal, ...rest)
        } catch (e) {
            if (e instanceof AuthFailure) {
                return NextResponse.json(e.body, { status: e.status })
            }
            console.error("Admin route error:", e)
            return NextResponse.json(
                { error: "Internal server error." },
                { status: 500 }
            )
        }
    }
}

export function generateApiKey(): { plaintext: string; prefix: string } {
    // 32 random bytes as base64url, prefixed for visual identification
    const bytes = new Uint8Array(32)
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        crypto.getRandomValues(bytes)
    } else {
        const { randomBytes } = require("node:crypto") as typeof import("node:crypto")
        randomBytes(32).copy(Buffer.from(bytes.buffer))
    }
    const b64 = Buffer.from(bytes).toString("base64url")
    const plaintext = `dl_live_${b64}`
    const prefix = plaintext.slice(0, 12) // "dl_live_" + 4 chars
    return { plaintext, prefix }
}
