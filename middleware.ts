import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { signInPath } from "@/lib/auth-redirect"

/**
 * Edge gating for the admin surface.
 *
 * Defense in depth — every admin page server component and admin API route
 * already does its own auth check via the layout / withAdmin wrapper, but
 * those checks run AFTER the page's `prisma.*` calls have begun. That's a
 * DoS vector for non-admin requests, and it leaves a tiny race window if
 * Next's layout-redirect semantics ever change in a future version.
 *
 * This middleware bounces unauthorized requests BEFORE any rendering or
 * route handler runs. It does NOT replace the per-route auth checks; both
 * are kept for belt-and-suspenders.
 *
 * Bearer-token /api/admin/* requests bypass the middleware session check —
 * they're validated by `withAdmin` against the ApiKey table.
 */

// Run on Node runtime so we can use the Prisma session adapter.
export const runtime = "nodejs"

const LEARN_CSP_DIRECTIVES = [
    "default-src 'self'",
    "script-src 'self' 'nonce-__NONCE__'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://*.vercel-storage.com https://*.public.blob.vercel-storage.com",
    "connect-src 'self'",
    "font-src 'self' data:",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
]

function isLearnPath(pathname: string): boolean {
    return pathname === "/learn" || pathname.startsWith("/learn/")
}

function applyLearnCsp(req: NextRequest): NextResponse {
    const nonce = crypto.randomUUID().replace(/-/g, "")
    const policy = LEARN_CSP_DIRECTIVES.map((directive) =>
        directive.replace("__NONCE__", nonce)
    ).join("; ")

    const requestHeaders = new Headers(req.headers)
    requestHeaders.set("Content-Security-Policy", policy)
    requestHeaders.set("x-csp-nonce", nonce)

    const response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    })
    response.headers.set("Content-Security-Policy", policy)
    response.headers.set("x-csp-nonce", nonce)
    return response
}

const adminAuthMiddleware = auth((req) => {
    const { pathname } = req.nextUrl
    const isAdminApi = pathname.startsWith("/api/admin/") || pathname === "/api/admin"
    const isAdminPage = pathname.startsWith("/admin/") || pathname === "/admin"
    const isDiscussionAdminPath =
        pathname === "/admin/discussions" ||
        pathname.startsWith("/admin/discussions/") ||
        pathname === "/api/admin/discussions" ||
        pathname.startsWith("/api/admin/discussions/")

    if (!isAdminApi && !isAdminPage) {
        return NextResponse.next()
    }

    // Bearer-key /api/admin/* requests are admin-only and validated by
    // withAdmin in the route handler. Let them through without a session.
    if (isAdminApi) {
        const authz =
            req.headers.get("authorization") ?? req.headers.get("Authorization")
        if (authz?.startsWith("Bearer ")) {
            return NextResponse.next()
        }
        if (
            process.env.NODE_ENV !== "production" &&
            req.headers.get("x-test-user-id")
        ) {
            return NextResponse.next()
        }
    }

    const session = req.auth
    const role = session?.user?.role

    if (!session?.user?.id) {
        if (isAdminApi) {
            return NextResponse.json(
                { error: "Authentication required." },
                { status: 401 }
            )
        }
        return NextResponse.redirect(new URL(signInPath(pathname), req.nextUrl))
    }

    if (role !== "ADMIN") {
        if (role === "MODERATOR" && isDiscussionAdminPath) {
            return NextResponse.next()
        }
        if (isAdminApi) {
            return NextResponse.json(
                { error: "Admin access required." },
                { status: 403 }
            )
        }
        return NextResponse.redirect(new URL("/", req.nextUrl))
    }

    return NextResponse.next()
})

export default function middleware(
    ...args: Parameters<typeof adminAuthMiddleware>
) {
    const [req] = args
    const { pathname } = req.nextUrl

    if (isLearnPath(pathname)) {
        return applyLearnCsp(req)
    }

    return adminAuthMiddleware(...args)
}

export const config = {
    matcher: [
        "/admin",
        "/admin/:path*",
        "/api/admin",
        "/api/admin/:path*",
        "/learn",
        "/learn/:path*",
    ],
}
