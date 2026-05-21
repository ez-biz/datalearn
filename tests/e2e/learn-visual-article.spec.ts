import { expect, test } from "@playwright/test"

test.describe("Learn v2 visual seed article", () => {
    test("renders all five directive types", async ({ page }) => {
        await page.goto("/learn/joins/how-a-join-works")

        await expect(
            page.getByRole("heading", { name: "How a JOIN works" }).first()
        ).toBeVisible()
        await expect(
            page.getByRole("img", {
                name: "Two tables joined by customer_id",
            })
        ).toBeVisible()
        await expect(page.locator(".dl-mermaid svg").first()).toBeVisible({
            timeout: 5_000,
        })
        await expect(page.getByText("1", { exact: true }).first()).toBeVisible()
        await expect(page.getByText("2", { exact: true }).first()).toBeVisible()
        await expect(page.getByText("3", { exact: true }).first()).toBeVisible()
        await expect(
            page.getByRole("heading", { name: "INNER JOIN - drops the lonely" })
        ).toBeVisible()
        await expect(
            page.getByRole("heading", { name: "LEFT JOIN - keeps everyone" })
        ).toBeVisible()
        await expect(page.getByText("Pitfall", { exact: false })).toBeVisible()
        await expect(
            page.getByRole("img", {
                name: "Hash join vs nested loop comparison",
            })
        ).toBeVisible()
    })

    test("404 path renders the not-found body", async ({ page }) => {
        await page.goto("/learn/joins/does-not-exist")
        await expect(
            page.getByRole("heading", { name: /not found/i })
        ).toBeVisible()
    })
})
