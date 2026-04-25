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
        ]
    },
}

export default nextConfig
