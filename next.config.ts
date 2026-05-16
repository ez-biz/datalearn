import type { NextConfig } from "next"

/**
 * Defense-in-depth response headers.
 *
 * - X-Frame-Options: DENY — kills clickjacking against /admin/*. The admin
 *   layout is a high-value target since a logged-in admin could be tricked
 *   into clicking through a transparent overlay.
 * - Referrer-Policy: strict-origin-when-cross-origin — don't leak full
 *   URLs (e.g. /admin/problems/<slug>/edit) in Referer to outbound links.
 * - X-Content-Type-Options: nosniff — disables MIME-sniffing.
 * - Strict-Transport-Security — only in production. Safe default; preload
 *   list submission is a separate, irreversible step.
 *
 * Not enforcing CSP yet — the WASM bundle for DuckDB ships from jsDelivr
 * and the right CSP requires careful testing of Monaco, next/font, and the
 * worker boot path. Tracked as a follow-up.
 */
const securityHeaders = [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    ...(process.env.NODE_ENV === "production"
        ? [
              {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains",
              },
          ]
        : []),
]

const nextConfig: NextConfig = {
    async headers() {
        return [
            {
                source: "/:path*",
                headers: securityHeaders,
            },
            // Self-hosted SQL engine bundle (PR 3.3 Phase 1). Vercel's
            // default for `public/` assets is `max-age=0, must-revalidate`,
            // which forces a revalidation round-trip on every visit and
            // defeats most of the win from self-hosting. The URL is NOT
            // content-hashed (yet — TODO when we ship Phase 2 or upgrade
            // the package routinely), so we can't use `immutable` safely:
            // a package upgrade would otherwise be invisible to returning
            // visitors for the whole max-age window.
            //
            // Compromise: 1-day max-age. Cuts the revalidation round-trip
            // out of the typical practice session entirely, and a package
            // upgrade propagates to returning visitors within ~24 hours.
            // Move to immutable + hashed URLs alongside the Phase 2 SW
            // work if/when telemetry shows we need it.
            {
                source: "/_dl/sql-engine/:path*",
                headers: [
                    {
                        key: "Cache-Control",
                        value: "public, max-age=86400",
                    },
                ],
            },
        ]
    },
    images: {
        // OAuth-provider avatar hosts. Without these, next/image silently
        // refuses to load and we render a broken thumbnail. UserMenu also
        // has an onError fallback for other failure modes (dead URL, CORS,
        // user deletes their avatar at the provider).
        remotePatterns: [
            { protocol: "https", hostname: "avatars.githubusercontent.com" },
            { protocol: "https", hostname: "lh3.googleusercontent.com" },
            { protocol: "https", hostname: "lh4.googleusercontent.com" },
            { protocol: "https", hostname: "lh5.googleusercontent.com" },
            { protocol: "https", hostname: "lh6.googleusercontent.com" },
        ],
    },
}

export default nextConfig
