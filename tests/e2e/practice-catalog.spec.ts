import { test, expect } from "@playwright/test"

// The rebuilt practice catalog: a facet rail (Status / Difficulty / Engine
// checkboxes, Topics chips, Companies rows — components/practice/catalog/FacetRail.tsx),
// a sort + count toolbar (CatalogToolbar.tsx), and an ARIA `table` of rows
// (CatalogTable.tsx / CatalogRow.tsx). All client state lives in
// CatalogClient.tsx. Runs unauthenticated — /practice needs no session.

test.describe("practice catalog", () => {
    test("filtering by difficulty narrows the table and updates the count", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto("/practice")
        const showing = page.getByText(/Showing \d+ of \d+/)
        const before = await showing.innerText()

        await page.getByRole("checkbox", { name: /easy/i }).click()
        await expect(showing).not.toHaveText(before)
    })

    test("a facet's siblings keep non-zero counts after selecting it", async ({
        page,
    }) => {
        // The rail must not tell the learner there is nothing else to pick —
        // each group's counts are computed against every OTHER group's
        // selection, never its own (lib/practice/catalog-model.ts computeFacets).
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto("/practice")
        await page.getByRole("checkbox", { name: /easy/i }).click()
        const medium = page.getByRole("checkbox", { name: /medium/i })
        await expect(medium).toBeVisible()
        // The checkbox's accessible name comes from the wrapping <label>,
        // which also contains the facet's count span — walk up to it.
        const label = medium.locator("xpath=..")
        const labelText = await label.innerText()
        expect(labelText).not.toMatch(/\b0\b/)
    })

    test("sorting by newest reorders the first row", async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto("/practice")
        const first = page.getByRole("row").nth(1)
        const before = await first.innerText()
        await page.getByRole("button", { name: /newest/i }).click()
        await expect(first).not.toHaveText(before)
    })

    test("the / shortcut focuses search", async ({ page }) => {
        await page.goto("/practice")
        await page.keyboard.press("/")
        await expect(page.getByRole("searchbox")).toBeFocused()
    })
})
