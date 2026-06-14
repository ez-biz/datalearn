import { defineConfig, devices } from "@playwright/test"

const PORT = process.env.E2E_PORT ?? "3100"
const BASE_URL = `http://localhost:${PORT}`

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
        env: {
            // Auth.js v5 rejects requests from non-default hosts unless
            // explicitly trusted. The test server runs on a custom port.
            AUTH_TRUST_HOST: "true",
        },
    },
})
