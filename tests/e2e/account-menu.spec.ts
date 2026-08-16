import { expect, test } from "@playwright/test"
import { prisma, seedUser, sessionCookie } from "./fixtures/db"

/**
 * The account menu opens from the sidebar header, which sits against the
 * left edge of the viewport. It shipped with `right-0`, which right-aligns
 * the 288px panel to that trigger and pushed 90px of it off-screen — the
 * name, email and every row label were clipped. The placement doc comment
 * said "opens down-right" the whole time; only the class disagreed.
 *
 * This asserts the panel's left edge is on-screen. It fails at x = -90 on
 * the old class, so it genuinely guards the regression rather than merely
 * describing it.
 */
const BASE_URL =
    process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}`
const PREFIX = `e2e-account-menu-${Date.now()}`

test.afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
})

test("the account menu opens fully on screen from the sidebar header", async ({
    page,
}) => {
    const user = await seedUser({
        email: `${PREFIX}@example.com`,
        role: "USER",
        name: "Account Menu Probe",
    })
    await page.context().addCookies([sessionCookie(user.sessionToken, BASE_URL)])

    await page.setViewportSize({ width: 1728, height: 1000 })
    await page.goto("/")
    await page.waitForLoadState("domcontentloaded")

    await page.locator('button[aria-label*="account menu" i]').first().click()

    const panel = page.getByRole("menu", { name: "Account menu" })
    await expect(panel).toBeVisible()

    const box = await panel.boundingBox()
    expect(box).not.toBeNull()
    // The whole panel must be within the viewport horizontally.
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(1728)
})
