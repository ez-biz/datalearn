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
