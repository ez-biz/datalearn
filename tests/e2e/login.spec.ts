import { test, expect } from "@playwright/test"
import { deleteUser, prisma, seedUser, sessionCookie } from "./fixtures/db"

const BASE_URL =
    process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}`
const SIGN_OUT_EMAIL = "e2e-sign-out@example.test"

test.afterAll(async () => {
    await deleteUser(SIGN_OUT_EMAIL)
    await prisma.$disconnect()
})

test.describe("custom sign-in flow", () => {
    test("home navbar sign-in dialog is centered and unclipped", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto("/")

        await page
            .getByRole("banner")
            .getByRole("button", { name: "Sign in" })
            .click()

        const panel = page.getByTestId("sign-in-dialog-panel")
        await expect(panel).toBeVisible()

        const box = await panel.boundingBox()
        if (!box) throw new Error("Sign-in dialog panel has no bounding box")
        const viewportHeight = await page.evaluate(() => window.innerHeight)

        expect(box.y).toBeGreaterThanOrEqual(24)
        expect(box.y + box.height).toBeLessThanOrEqual(viewportHeight - 24)
    })

    test("navbar sign-in opens provider dialog for current page", async ({
        page,
    }) => {
        await page.goto("/practice")

        await page
            .getByRole("banner")
            .getByRole("button", { name: "Sign in" })
            .click()

        const dialog = page.getByRole("dialog", {
            name: /sign in to data learn/i,
        })
        await expect(dialog).toBeVisible()
        await expect(
            dialog.getByRole("link", { name: /continue with google/i })
        ).toHaveAttribute(
            "href",
            "/api/auth/signin/google?callbackUrl=%2Fpractice"
        )
        await expect(
            dialog.getByRole("link", { name: /continue with github/i })
        ).toHaveAttribute(
            "href",
            "/api/auth/signin/github?callbackUrl=%2Fpractice"
        )

        await page.keyboard.press("Escape")
        await expect(dialog).toBeHidden()
    })

    test("inline report sign-in opens provider dialog for the practice page", async ({
        page,
    }) => {
        await page.goto("/practice/simple-select")

        await page.getByRole("button", { name: "Sign in to report" }).click()

        const dialog = page.getByRole("dialog", {
            name: /sign in to data learn/i,
        })
        await expect(dialog).toBeVisible()
        await expect(
            dialog.getByRole("link", { name: /continue with google/i })
        ).toHaveAttribute(
            "href",
            "/api/auth/signin/google?callbackUrl=%2Fpractice%2Fsimple-select"
        )
    })

    test("renders provider actions", async ({ page }) => {
        await page.goto("/auth/signin")

        await expect(
            page.getByRole("heading", {
                name: /train like the query is going live/i,
            })
        ).toBeVisible()
        await expect(
            page.getByRole("link", { name: /continue with google/i })
        ).toBeVisible()
        await expect(
            page.getByRole("link", { name: /continue with github/i })
        ).toBeVisible()
    })

    test("provider links preserve safe internal callback", async ({ page }) => {
        await page.goto("/auth/signin?callbackUrl=/profile")

        await expect(
            page.getByRole("link", { name: /continue with google/i })
        ).toHaveAttribute(
            "href",
            "/api/auth/signin/google?callbackUrl=%2Fprofile"
        )
        await expect(
            page.getByRole("link", { name: /continue with github/i })
        ).toHaveAttribute(
            "href",
            "/api/auth/signin/github?callbackUrl=%2Fprofile"
        )
    })

    test("provider links reject external callback", async ({ page }) => {
        const unsafeCallbacks = [
            "https%3A%2F%2Fexample.com%2Fsteal",
            "%2F%2Fevil.example",
            "%2F%5C%5Cevil.example",
            "%2F%0A%2Fevil.example",
            "%2F%5C%ZZ",
        ]

        for (const callbackUrl of unsafeCallbacks) {
            await page.goto(`/auth/signin?callbackUrl=${callbackUrl}`)

            await expect(
                page.getByRole("link", { name: /continue with google/i })
            ).toHaveAttribute("href", "/api/auth/signin/google?callbackUrl=%2F")
            await expect(
                page.getByRole("link", { name: /continue with github/i })
            ).toHaveAttribute("href", "/api/auth/signin/github?callbackUrl=%2F")
        }
    })

    test("renders generic error state", async ({ page }) => {
        await page.goto("/auth/signin?error=AccessDenied")

        await expect(
            page.getByText("Sign-in could not be completed.")
        ).toBeVisible()
    })

    test("mobile layout keeps sign-in actions visible without horizontal scroll", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 375, height: 812 })
        await page.goto("/auth/signin?callbackUrl=/me/lists")

        await expect(
            page.getByRole("link", { name: /continue with google/i })
        ).toBeVisible()
        const overflow = await page.evaluate(
            () =>
                document.documentElement.scrollWidth >
                document.documentElement.clientWidth
        )
        expect(overflow).toBe(false)
    })

    test("user menu sign-out redirects home without opening the auth page", async ({
        page,
    }) => {
        const user = await seedUser({
            email: SIGN_OUT_EMAIL,
            name: "Sign Out Test",
        })
        await page.context().addCookies([
            sessionCookie(user.sessionToken, BASE_URL),
        ])

        await page.goto("/profile")
        await page.getByRole("button", { name: "Open account menu" }).click()
        await page.getByRole("menuitem", { name: "Sign out" }).click()

        await expect(page).toHaveURL("/")
        await expect(
            page
                .getByRole("banner")
                .getByRole("button", { name: "Sign in" })
        ).toBeVisible()
    })
})
