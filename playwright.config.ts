import { defineConfig, devices } from "@playwright/test"
// Same `.env` load the fixtures do (tests/e2e/fixtures/db.ts), hoisted into
// the runner so the server env below can be derived from it. See E2E_ENV.
import "dotenv/config"

const PORT = process.env.E2E_PORT ?? "3100"
const BASE_URL = `http://localhost:${PORT}`

/**
 * Environment pinned onto the e2e web server.
 *
 * This has to be explicit, because `npm run start` is `next start`, which runs
 * with NODE_ENV=production and therefore resolves env in this order:
 *
 *     process.env > .env.production.local > .env.local > .env.production > .env
 *
 * A variable that is *present but empty* still counts as set, so it shadows
 * every layer beneath it. `vercel env pull --environment=production` writes
 * exactly that shape into a developer's working tree: encrypted values come
 * down as `AUTH_SECRET=""` in `.env.production.local`, which outranks the real
 * secret in `.env`. Auth.js then throws `MissingSecret` on every `auth()`
 * call, every session resolves to null, and every signed-in e2e test silently
 * renders the signed-out page — surfacing only as an opaque locator timeout
 * rather than an auth error. The same pull also writes a *production*
 * DATABASE_URL, which would point the server at prod while the fixtures seed
 * into local Postgres.
 *
 * Values already exported in this process always win, so CI's run-scoped
 * secrets (.github/workflows/test.yml) and an explicit
 * `DATABASE_URL=... npx playwright test` prefix both stay authoritative. `||`
 * rather than `??` is deliberate: the failure mode being defended against is
 * an empty string, not `undefined`.
 */
const E2E_ENV: Record<string, string> = {
    // Auth.js v5 rejects requests from non-default hosts unless explicitly
    // trusted. The test server runs on a custom port.
    AUTH_TRUST_HOST: "true",
    // e2e bypasses OAuth entirely by inserting Session rows directly, so these
    // only need to be non-empty for Auth.js to initialize.
    AUTH_SECRET: process.env.AUTH_SECRET || "e2e-local-secret-not-for-deployment",
    AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID || "e2e-dummy",
    AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET || "e2e-dummy",
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID || "e2e-dummy",
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET || "e2e-dummy",
    API_KEY_HASH_SECRET:
        process.env.API_KEY_HASH_SECRET || "e2e-local-key-secret-not-for-deployment",
    // Pin the server to the exact database the fixtures seed into. Left alone
    // when the runner has no DATABASE_URL at all, so the server keeps its
    // existing `.env*` resolution rather than being handed an empty string.
    ...(process.env.DATABASE_URL
        ? { DATABASE_URL: process.env.DATABASE_URL }
        : {}),
}

export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: false, // tests share a DB; serialize for now
    // The contest play pages init DuckDB/PGlite-WASM in-browser (and the
    // official judge spins up a server-side worker); on a cold CI runner the
    // first such test can take ~30-60s just for the verdict. Give every test
    // 120s of headroom so WASM/judge cold-starts don't flake the suite (the
    // verdict assertions themselves use 60s — see contest-play / custom specs).
    timeout: 120_000,
    retries: 0,
    workers: 1,
    // CI: github inline annotations + html for the uploaded artifact so
    // we can inspect traces / browser console for failing tests post-hoc.
    // Local: plain list output.
    reporter: process.env.CI
        ? [["github"], ["html", { open: "never" }]]
        : "list",
    use: {
        baseURL: BASE_URL,
        trace: "retain-on-failure",
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: {
        command: `npm run start -- -p ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "ignore",
        stderr: "pipe",
        env: E2E_ENV,
    },
})
