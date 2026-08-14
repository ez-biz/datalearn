import { test, expect } from "@playwright/test"

// The workspace is an app-mode route: console shell, but no footer and no
// page scroll. Asserted by landmark, not by screenshot — a footer below the
// fold looks identical to a footer that isn't there.
test.describe("workspace shell", () => {
    test("has no contentinfo landmark", async ({ page }) => {
        await page.goto("/practice/simple-select")
        await expect(page.getByRole("contentinfo")).toHaveCount(0)
    })

    test("keeps exactly one banner and the main landmark", async ({ page }) => {
        await page.goto("/practice/simple-select")
        await expect(page.getByRole("banner")).toHaveCount(1)
        await expect(page.locator("main#main-content")).toHaveCount(1)
    })

    test("the catalog one level up still has its footer", async ({ page }) => {
        await page.goto("/practice")
        await expect(page.getByRole("contentinfo")).toHaveCount(1)
    })

    test("#app-scroll clamps at every width, but clears the mobile tab bar below lg", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 768, height: 900 })
        await page.goto("/practice/simple-select")
        const mobile = await page
            .locator("#app-scroll")
            .evaluate((el) => {
                const style = getComputedStyle(el)
                return {
                    overflowY: style.overflowY,
                    paddingBottom: style.paddingBottom,
                }
            })
        expect(mobile).toEqual({ overflowY: "hidden", paddingBottom: "56px" })

        await page.setViewportSize({ width: 1440, height: 900 })
        const desktop = await page
            .locator("#app-scroll")
            .evaluate((el) => {
                const style = getComputedStyle(el)
                return {
                    overflowY: style.overflowY,
                    paddingBottom: style.paddingBottom,
                }
            })
        expect(desktop).toEqual({ overflowY: "hidden", paddingBottom: "0px" })
    })
})
