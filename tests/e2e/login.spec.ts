import { test, expect, type Page, type Request } from "@playwright/test"
import { deleteUser, prisma, seedUser, sessionCookie } from "./fixtures/db"

const BASE_URL =
    process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}`
const SIGN_OUT_EMAIL = "e2e-sign-out@example.test"
type AuthProvider = "google" | "github"

test.afterAll(async () => {
    await deleteUser(SIGN_OUT_EMAIL)
    await prisma.$disconnect()
})

async function mockProviderSignIn(page: Page) {
    await page.route("**/api/auth/providers", async (route) => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                google: { id: "google", name: "Google", type: "oauth" },
                github: { id: "github", name: "GitHub", type: "oauth" },
            }),
        })
    })
    await page.route("**/api/auth/csrf", async (route) => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ csrfToken: "test-csrf-token" }),
        })
    })
    await page.route("**/api/auth/signin/*", async (route) => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ url: "/" }),
        })
    })
}

function waitForProviderPost(page: Page, provider: AuthProvider) {
    return page.waitForRequest((request: Request) => {
        const url = new URL(request.url())
        return (
            request.method() === "POST" &&
            url.pathname === `/api/auth/signin/${provider}`
        )
    })
}

function expectProviderPost(request: Request, callbackUrl: string) {
    const body = new URLSearchParams(request.postData() ?? "")
    expect(body.get("callbackUrl")).toBe(callbackUrl)
    expect(body.get("csrfToken")).toBe("test-csrf-token")
}

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
            dialog.getByRole("button", { name: /continue with google/i })
        ).toBeVisible()
        await expect(
            dialog.getByRole("button", { name: /continue with github/i })
        ).toBeVisible()

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
            dialog.getByRole("button", { name: /continue with google/i })
        ).toBeVisible()
    })

    test("dialog provider action posts through Auth.js with the current callback", async ({
        page,
    }) => {
        await mockProviderSignIn(page)
        await page.goto("/practice/simple-select")

        await page.getByRole("button", { name: "Sign in to report" }).click()
        const providerPost = waitForProviderPost(page, "google")
        await page
            .getByRole("dialog", { name: /sign in to data learn/i })
            .getByRole("button", { name: /continue with google/i })
            .click()

        expectProviderPost(
            await providerPost,
            "/practice/simple-select"
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
            page.getByRole("button", { name: /continue with google/i })
        ).toBeVisible()
        await expect(
            page.getByRole("button", { name: /continue with github/i })
        ).toBeVisible()
    })

    test("provider actions preserve safe internal callback", async ({ page }) => {
        await mockProviderSignIn(page)
        await page.goto("/auth/signin?callbackUrl=/profile")

        const providerPost = waitForProviderPost(page, "google")
        await page
            .getByRole("button", { name: /continue with google/i })
            .click()

        expectProviderPost(await providerPost, "/profile")
    })

    test("provider actions reject external callback", async ({ page }) => {
        await mockProviderSignIn(page)
        const unsafeCallbacks = [
            "https%3A%2F%2Fexample.com%2Fsteal",
            "%2F%2Fevil.example",
            "%2F%5C%5Cevil.example",
            "%2F%0A%2Fevil.example",
            "%2F%5C%ZZ",
        ]

        for (const callbackUrl of unsafeCallbacks) {
            await page.goto(`/auth/signin?callbackUrl=${callbackUrl}`)

            const providerPost = waitForProviderPost(page, "google")
            await page
                .getByRole("button", { name: /continue with google/i })
                .click()

            expectProviderPost(await providerPost, "/")
            await expect(page).toHaveURL("/")
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
            page.getByRole("button", { name: /continue with google/i })
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
