import { expect, test } from "@playwright/test"

const DRAFT_PREFIX = "dl:draft:"
const QUERY_TIMEOUT_OVERRIDE_KEY = "dl:query-timeout-ms"
const DIALECT_PREFIX = "dl:dialect:"
const SIMPLE_SELECT_SLUG = "simple-select"
const SIMPLE_SELECT_DRAFT_KEY = `${DRAFT_PREFIX}${SIMPLE_SELECT_SLUG}`

test.describe("SQL engine result caps", () => {
    test("large learner results are truncated in the workspace", async ({
        page,
    }) => {
        test.slow()

        await page.addInitScript(
            ({ key, sql }) => {
                window.localStorage.setItem(key, sql)
            },
            {
                key: SIMPLE_SELECT_DRAFT_KEY,
                sql: "SELECT * FROM range(0, 1105) AS t(id);",
            }
        )
        await page.goto(`/practice/${SIMPLE_SELECT_SLUG}`)

        const readyRunButton = page.getByTestId("workspace-run-footer")
        await expect(readyRunButton).toBeEnabled({ timeout: 45_000 })

        await readyRunButton.click()

        await expect(
            page.getByText(/showing first 1,000 rows/i)
        ).toBeVisible({ timeout: 45_000 })
        await expect(
            page.getByText(/query returned at least 1,001 rows/i)
        ).toBeVisible()
    })
})

test.describe("SQL engine runtime controls", () => {
    test("timed out learner query resets the engine for the next run", async ({
        page,
    }) => {
        test.slow()

        await page.addInitScript(
            ({ draftKey, sql, timeoutKey }) => {
                window.localStorage.setItem(timeoutKey, "1")
                window.localStorage.setItem(draftKey, sql)
            },
            {
                draftKey: SIMPLE_SELECT_DRAFT_KEY,
                sql: "SELECT SUM(random()) AS total FROM range(0, 100000000);",
                timeoutKey: QUERY_TIMEOUT_OVERRIDE_KEY,
            }
        )
        await page.goto(`/practice/${SIMPLE_SELECT_SLUG}`)

        const runButton = page.getByTestId("workspace-run-footer")
        await expect(runButton).toBeEnabled({ timeout: 45_000 })

        await runButton.click()

        await expect(
            page.getByText(/query timed out.*engine session was reset/i)
        ).toBeVisible({ timeout: 45_000 })

        await expect(runButton).toBeEnabled({ timeout: 45_000 })
        await page.getByRole("button", { name: "Reset" }).click()
        await runButton.click()

        await expect(
            page.getByRole("columnheader", { name: "id" }).first()
        ).toBeVisible({
            timeout: 45_000,
        })
        await expect(page.getByRole("cell", { name: "Alice" }).first()).toBeVisible()
    })
})

// Note: this suite requires a production-mode build (`next start`).
// `next dev` routes telemetry through console.debug instead of the
// network, so the beacon assertions below would never resolve.
test.describe("SQL engine telemetry", () => {
    test("emits production beacons for init, first query, and disposal", async ({
        page,
    }) => {
        test.slow()

        const eventNames: string[] = []
        page.on("request", (request) => {
            if (!request.url().endsWith("/api/telemetry/sql-engine")) return
            if (request.method() !== "POST") return
            const body = request.postData()
            if (!body) return

            try {
                const event = JSON.parse(body) as { name?: unknown }
                if (typeof event.name === "string") eventNames.push(event.name)
            } catch {}
        })

        await page.addInitScript((dialectKey) => {
            window.localStorage.removeItem(dialectKey)
        }, `dl:dialect:${SIMPLE_SELECT_SLUG}`)
        await page.goto(`/practice/${SIMPLE_SELECT_SLUG}`)

        const runButton = page.getByTestId("workspace-run-footer")
        await expect(runButton).toBeEnabled({ timeout: 45_000 })

        await expect
            .poll(() => eventNames.includes("engine.init.start"), {
                timeout: 45_000,
            })
            .toBe(true)
        await expect
            .poll(() => eventNames.includes("engine.init.ready"), {
                timeout: 45_000,
            })
            .toBe(true)

        await runButton.click()
        await expect(
            page.getByRole("columnheader", { name: "id" }).first()
        ).toBeVisible({
            timeout: 45_000,
        })
        await expect
            .poll(() => eventNames.includes("engine.firstQuery.ready"), {
                timeout: 45_000,
            })
            .toBe(true)

        await page.getByRole("button", { name: /switch engine to postgres/i }).click()
        await expect
            .poll(() => eventNames.includes("engine.dispose"), {
                timeout: 45_000,
            })
            .toBe(true)
    })
})

// PGlite IndexedDB persistence (PR 3.2).
// Asserts the user-visible flow survives a reload: a Postgres-mode
// learner can run queries on first visit and on the persisted reload.
// We don't time-assert "second load is faster" because Playwright timing
// on CI runners is too noisy — the unit tests cover cache-key stability.
test.describe("SQL engine PGlite persistence", () => {
    test("Postgres mode survives a reload of the workspace", async ({
        page,
    }) => {
        test.slow()

        await page.addInitScript(
            ({ dialectKey, draftKey, sql }) => {
                window.localStorage.setItem(dialectKey, "POSTGRES")
                window.localStorage.setItem(draftKey, sql)
            },
            {
                dialectKey: `${DIALECT_PREFIX}${SIMPLE_SELECT_SLUG}`,
                draftKey: SIMPLE_SELECT_DRAFT_KEY,
                // Compose a value that does NOT appear in the schema-panel
                // sample preview, so the post-Run cell locator is unique.
                // (`Alice` would also match the schema preview's Alice.)
                sql: "SELECT name || '_persisted' AS marker FROM users WHERE id = 1;",
            }
        )

        await page.goto(`/practice/${SIMPLE_SELECT_SLUG}`)
        const runButton = page.getByTestId("workspace-run-footer")
        await expect(runButton).toBeEnabled({ timeout: 60_000 })
        await runButton.click()
        await expect(
            page.getByRole("cell", { name: "Alice_persisted" })
        ).toBeVisible({ timeout: 60_000 })

        // Reload — IndexedDB persists across the navigation. The schema
        // replay should be skipped on this load (cache hit).
        await page.reload()
        await expect(runButton).toBeEnabled({ timeout: 60_000 })
        await runButton.click()
        await expect(
            page.getByRole("cell", { name: "Alice_persisted" })
        ).toBeVisible({ timeout: 60_000 })
    })
})
