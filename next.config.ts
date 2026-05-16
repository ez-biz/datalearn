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
            // Self-hosted SQL engine bundle (PR 3.3 Phase 1).
            //
            // 1. `Content-Type` must be set explicitly. `next start` does NOT
            //    auto-detect MIME for static `public/` assets, and with our
            //    `X-Content-Type-Options: nosniff` defense the browser refuses
            //    to instantiate the WebAssembly module without a true
            //    `application/wasm` declaration. Vercel's edge adds this in
            //    production via file-extension detection, which is why the
            //    bug only manifested in CI's `next start` environment.
            //
            // 2. `Cache-Control: max-age=86400` overrides Vercel's default
            //    `max-age=0, must-revalidate` for `public/` assets. The URL
            //    is not content-hashed yet, so we don't use `immutable` —
            //    a package upgrade would otherwise be invisible to returning
            //    visitors for the whole max-age window. 1 day cuts the
            //    revalidation round-trip out of the typical practice session
            //    while keeping package-upgrade propagation tight. Move to
            //    immutable + hashed URLs alongside the Phase 2 SW work if
            //    telemetry shows we need it.
            {
                source: "/_dl/sql-engine/:path*.wasm",
                headers: [
                    {
                        key: "Content-Type",
                        value: "application/wasm",
                    },
                    {
                        key: "Cache-Control",
                        value: "public, max-age=86400",
                    },
                ],
            },
            {
                source: "/_dl/sql-engine/:path*.js",
                headers: [
                    {
                        key: "Content-Type",
                        value: "application/javascript; charset=utf-8",
                    },
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
