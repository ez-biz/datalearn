import { expect, test } from "@playwright/test"

const DRAFT_PREFIX = "dl:draft:"
const QUERY_TIMEOUT_OVERRIDE_KEY = "dl:query-timeout-ms"
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
