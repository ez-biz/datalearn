import { defineConfig, devices } from "@playwright/test"

const PORT = process.env.E2E_PORT ?? "3100"
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: false, // tests share a DB; serialize for now
    retries: 0,
    workers: 1,
    reporter: process.env.CI ? "github" : "list",
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
