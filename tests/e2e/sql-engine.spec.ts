import { expect, test } from "@playwright/test"

test.describe("SQL engine result caps", () => {
    test("large learner results are truncated in the workspace", async ({
        page,
    }) => {
        test.slow()

        await page.goto("/practice/simple-select")

        const readyRunButton = page.getByTestId("workspace-run-footer")
        await expect(readyRunButton).toBeEnabled({ timeout: 45_000 })

        await page.locator(".monaco-editor").click()
        await page.keyboard.press("Control+A")
        await page.keyboard.type("SELECT * FROM range(0, 1105) AS t(id);")
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

        await page.addInitScript(() => {
            window.localStorage.setItem("dl:query-timeout-ms", "1")
        })
        await page.goto("/practice/simple-select")

        const runButton = page.getByTestId("workspace-run-footer")
        await expect(runButton).toBeEnabled({ timeout: 45_000 })

        await page.locator(".monaco-editor").click()
        await page.keyboard.press("Control+A")
        await page.keyboard.type(
            "SELECT SUM(random()) AS total FROM range(0, 100000000);"
        )
        await runButton.click()

        await expect(
            page.getByText(/query timed out.*engine session was reset/i)
        ).toBeVisible({ timeout: 5_000 })

        await page.locator(".monaco-editor").click()
        await page.keyboard.press("Control+A")
        await page.keyboard.type("SELECT 1 AS ok;")
        await runButton.click()

        await expect(page.getByRole("columnheader", { name: "ok" })).toBeVisible({
            timeout: 45_000,
        })
        await expect(page.getByRole("cell", { name: "1" }).last()).toBeVisible()
    })
})
