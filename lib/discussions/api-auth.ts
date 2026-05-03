import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { AuthFailure } from "@/lib/api-auth"
import { userHasDiscussionPermission } from "./permissions"
import type { ModeratorPermissionKey } from "@prisma/client"

export type SessionPrincipal = {
    userId: string
    role: "USER" | "CONTRIBUTOR" | "MODERATOR" | "ADMIN"
}

function assertSameOriginWrite(req: Request) {
    if (req.method === "GET" || req.method === "HEAD") return

    const origin = req.headers.get("origin")
    if (!origin) {
        throw new AuthFailure(403, {
            error: "Missing Origin header on a write request.",
        })
    }

    const allowedOrigins = new Set<string>()
    try {
        allowedOrigins.add(new URL(req.url).origin)
    } catch {
        throw new AuthFailure(403, { error: "Malformed request URL." })
    }

    for (const env of [process.env.NEXTAUTH_URL, process.env.AUTH_URL]) {
        if (!env) continue
        try {
            allowedOrigins.add(new URL(env).origin)
        } catch {
            /* ignore malformed env */
        }
    }

    let requestOrigin: string
    try {
        requestOrigin = new URL(origin).origin
    } catch {
        throw new AuthFailure(403, { error: "Malformed Origin header." })
    }

    if (!allowedOrigins.has(requestOrigin)) {
        throw new AuthFailure(403, { error: "Cross-origin request rejected." })
    }
}

export async function requireDiscussionUser(
    req: Request
): Promise<SessionPrincipal> {
    const authz =
        req.headers.get("authorization") ?? req.headers.get("Authorization")
    if (authz && authz.length > 0) {
        throw new AuthFailure(401, {
            error: "Authorization headers are not accepted on discussion routes. Sign in instead.",
        })
    }

    assertSameOriginWrite(req)
    const session = await auth()
    if (!session?.user?.id) {
        throw new AuthFailure(401, { error: "Authentication required." })
    }
    return { userId: session.user.id, role: session.user.role }
}

export async function requireDiscussionModerator(
    req: Request,
    permission?: ModeratorPermissionKey
): Promise<SessionPrincipal> {
    const principal = await requireDiscussionUser(req)
    if (principal.role !== "ADMIN" && principal.role !== "MODERATOR") {
        throw new AuthFailure(403, { error: "Moderator access required." })
    }
    if (permission) {
        const ok = await userHasDiscussionPermission(
            { id: principal.userId, role: principal.role },
            permission
        )
        if (!ok) {
            throw new AuthFailure(403, { error: "Permission denied." })
        }
    }
    return principal
}

export function withDiscussionAuth<Args extends unknown[]>(
    handler: (
        req: Request,
        principal: SessionPrincipal,
        ...rest: Args
    ) => Promise<Response>
) {
    return async (req: Request, ...rest: Args): Promise<Response> => {
        try {
            const principal = await requireDiscussionUser(req)
            return await handler(req, principal, ...rest)
        } catch (e) {
            if (e instanceof AuthFailure) {
                return NextResponse.json(e.body, { status: e.status })
            }
            console.error("Discussion route error:", e)
            return NextResponse.json(
                { error: "Internal server error." },
                { status: 500 }
            )
        }
    }
}
