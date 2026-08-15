import { expect, test, type Page } from "@playwright/test"

// The mobile workspace (Task 10, components/practice/workspace/) collapses
// Problem/Code/Result into a segmented view below `lg`. Its whole point is
// that switching segments only toggles *visibility* — every pane stays
// mounted the entire time, so Monaco's model and the query-result state
// living in EditorPane both survive a tap. This file is the regression
// guard for that guarantee (Task 10's own proof was a throwaway spec,
// deleted before commit — see task-10-report.md) plus coverage for the
// segmented control, the SQL accessory row, and the mobile problems sheet.
//
// No ambient data is touched: every test here reads the always-seeded
// `simple-select` catalog problem (prisma/seed.ts, present in every
// environment including CI) and writes nothing to the database.

const SLUG = "simple-select"
const MOBILE_VIEWPORT = { width: 375, height: 812 }

function segmentButton(page: Page, name: "Problem" | "Code" | "Result") {
    return page
        .getByRole("group", { name: "Workspace view" })
        .getByRole("button", { name, exact: true })
}

function monacoEditor(page: Page) {
    return page.locator(".monaco-editor").first()
}

async function gotoMobileWorkspace(page: Page, slug = SLUG) {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto(`/practice/${slug}`)
    await expect(monacoEditor(page)).toBeVisible()
}

test.describe("mobile workspace segments", () => {
    test("the segmented control switches which pane is visible", async ({
        page,
    }) => {
        await gotoMobileWorkspace(page)

        // Code is the default segment.
        await expect(segmentButton(page, "Code")).toHaveAttribute(
            "aria-pressed",
            "true"
        )
        await expect(monacoEditor(page)).toBeVisible()

        await segmentButton(page, "Problem").click()
        await expect(segmentButton(page, "Problem")).toHaveAttribute(
            "aria-pressed",
            "true"
        )
        await expect(
            page.getByRole("heading", { level: 1, name: /Simple Select/ })
        ).toBeVisible()
        await expect(monacoEditor(page)).toBeHidden()

        await segmentButton(page, "Result").click()
        await expect(segmentButton(page, "Result")).toHaveAttribute(
            "aria-pressed",
            "true"
        )
        await expect(
            page.getByRole("button", { name: "Results", exact: true })
        ).toBeVisible()
        await expect(
            page.getByRole("heading", { level: 1, name: /Simple Select/ })
        ).toBeHidden()
    })

    // THE REQUIRED CASE. Types a live, unique marker into Monaco, cycles
    // through every other segment, and asserts the marker is still there on
    // return — with no re-run, re-navigation, or re-seeding in between. If a
    // future change swapped WorkspaceLayout's `hidden`-class toggle for
    // conditional rendering (`{active === "code" && editor}`), the editor
    // pane would unmount when segment changes to Problem or Result.
    test("editor text survives switching away and back", async ({ page }) => {
        await gotoMobileWorkspace(page)

        const marker = `ZZ_MOUNT_CHECK_${Date.now()}`
        await monacoEditor(page).click()
        await page.keyboard.insertText(marker)
        await expect(monacoEditor(page)).toContainText(marker)

        await segmentButton(page, "Result").click()
        await expect(monacoEditor(page)).toBeHidden()
        // Still mounted (not removed from the DOM), merely hidden.
        await expect(monacoEditor(page)).toHaveCount(1)

        await segmentButton(page, "Problem").click()
        await expect(monacoEditor(page)).toBeHidden()
        await expect(monacoEditor(page)).toHaveCount(1)

        await segmentButton(page, "Code").click()
        await expect(monacoEditor(page)).toBeVisible()
        await expect(monacoEditor(page)).toContainText(marker)
    })

    // THE REQUIRED CASE, results half. EditorPane owns `queryResult` as its
    // own local React state (not lifted to ProblemClient) — if EditorPane
    // itself were unmounted when the Problem segment activates, that state
    // is gone and returning to Result would show "no runs yet" rather than
    // the prior output. `random()` makes this airtight: an identical value
    // on return proves the pane was never unmounted *and* never silently
    // re-ran the query, not just that the row count matches by coincidence
    // against static seed data.
    test("result rows survive switching to Problem and back", async ({
        page,
    }) => {
        await gotoMobileWorkspace(page)

        await monacoEditor(page).click()
        await page.keyboard.insertText("SELECT random() AS mount_check_value")

        const runButton = page.getByTestId("workspace-run-footer")
        await expect(runButton).toBeEnabled({ timeout: 45_000 })
        await runButton.click()

        await segmentButton(page, "Result").click()
        const cell = page.getByRole("cell").first()
        await expect(cell).toBeVisible({ timeout: 15_000 })
        const value = await cell.innerText()
        expect(value.length).toBeGreaterThan(0)

        await segmentButton(page, "Problem").click()
        await expect(
            page.getByRole("heading", { level: 1, name: /Simple Select/ })
        ).toBeVisible()

        await segmentButton(page, "Result").click()
        await expect(cell).toBeVisible()
        await expect(cell).toHaveText(value)
    })

    test("the Result segment tints after a submit without auto-switching", async ({
        page,
    }) => {
        await gotoMobileWorkspace(page)

        const resultTab = segmentButton(page, "Result")
        // No unseen-verdict dot before anything has been submitted.
        await expect(resultTab.locator("span[aria-hidden]")).toHaveCount(0)

        const runButton = page.getByTestId("workspace-run-footer")
        await expect(runButton).toBeEnabled({ timeout: 45_000 })
        await runButton.click()
        await expect(runButton).toBeEnabled({ timeout: 45_000 })

        const submitButton = page.getByRole("button", { name: "Submit" })
        await expect(submitButton).toBeEnabled()
        await submitButton.click()

        // Anonymous submit still produces a verdict (the sign-in gate), so
        // the tint appears without needing an authenticated session.
        await expect(resultTab.locator("span[aria-hidden]")).toHaveCount(1)

        // The segment must NOT have auto-switched — the learner stays on
        // Code, and the dot signals rather than yanking them off the editor.
        await expect(segmentButton(page, "Code")).toHaveAttribute(
            "aria-pressed",
            "true"
        )
        await expect(monacoEditor(page)).toBeVisible()
        await expect(resultTab).toHaveAttribute("aria-pressed", "false")
    })
})

test.describe("mobile SQL accessory row", () => {
    test("inserts a token at the current cursor", async ({ page }) => {
        await gotoMobileWorkspace(page)

        const marker = `ZZ_CURSOR_${Date.now()}_`
        await monacoEditor(page).click()
        await page.keyboard.insertText(marker)

        await page
            .getByRole("toolbar", { name: "Insert SQL token" })
            .getByRole("button", { name: "FROM", exact: true })
            .click()

        // "FROM " lands immediately after the marker — proof the insert
        // targeted the live cursor, not a fixed position like the start or
        // end of the document.
        await expect(monacoEditor(page)).toContainText(`${marker}FROM `)
    })
})

test.describe("mobile problems sheet", () => {
    test("opens as a full-screen sheet and navigates to another problem", async ({
        page,
    }) => {
        await gotoMobileWorkspace(page)

        await expect(
            page.getByRole("region", { name: "All problems" })
        ).toHaveCount(0)

        await page.getByRole("button", { name: "All problems" }).click()
        const sheet = page.getByRole("region", { name: "All problems" })
        await expect(sheet).toBeVisible()

        // Pick any row that isn't the current problem — robust to whatever
        // order the seeded catalog happens to render in.
        const otherProblem = sheet
            .getByRole("link")
            .filter({ hasNot: page.locator('[aria-current="page"]') })
            .first()
        const href = await otherProblem.getAttribute("href")
        expect(href).not.toBeNull()
        expect(href).not.toBe(`/practice/${SLUG}`)

        await otherProblem.click()
        await expect(page).toHaveURL(new RegExp(href!.replace(/\//g, "\\/") + "$"))
        // The sheet itself does not persist across navigation.
        await expect(
            page.getByRole("region", { name: "All problems" })
        ).toHaveCount(0)
    })

    test("closes via its own close button without navigating", async ({
        page,
    }) => {
        await gotoMobileWorkspace(page)

        await page.getByRole("button", { name: "All problems" }).click()
        await expect(
            page.getByRole("region", { name: "All problems" })
        ).toBeVisible()

        await page.getByRole("button", { name: "Close problems panel" }).click()
        await expect(
            page.getByRole("region", { name: "All problems" })
        ).toHaveCount(0)
        await expect(page).toHaveURL(new RegExp(`/practice/${SLUG}$`))
    })
})
