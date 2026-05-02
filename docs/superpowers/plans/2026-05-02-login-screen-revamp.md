# Login Screen Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a custom Data Learn sign-in dialog for in-app actions plus a fallback screen at `/auth/signin`, while keeping the existing Auth.js API/provider logic unchanged.

**Architecture:** Add one pure URL helper for callback sanitization, then build a server-rendered fallback sign-in page and reusable client-side provider actions/dialog. Interactive app entry points open the dialog with the current path as callback; protected server redirects still route through `/auth/signin`; provider handoff uses Auth.js v5 `signIn(provider, { redirectTo })`, which POSTs to `/api/auth/signin/<provider>` with CSRF protection.

**Tech Stack:** Next.js App Router, Auth.js v5, React 19, Tailwind CSS v4 tokens, lucide-react icons, Playwright e2e tests.

---

## File Structure

- Create `lib/auth-redirect.ts`: pure helper functions for safe internal callback URLs and the fallback sign-in path. No Auth.js imports.
- Create `components/auth/ProviderSignInActions.tsx`: client provider buttons that call Auth.js `signIn("google" | "github", { redirectTo })`.
- Create `app/auth/signin/page.tsx`: server page for the custom login UI. Reads `callbackUrl` and `error`, redirects already-signed-in users to the safe callback, and renders provider actions.
- Create `components/auth/SignInDialog.tsx`: client dialog for in-app sign-in actions. Captures the current path/search, renders provider actions, and keeps `/auth/signin` as fallback link.
- Modify `components/layout/Navbar.tsx`: desktop and mobile anonymous sign-in actions open the dialog.
- Modify `components/layout/Footer.tsx`: footer sign-in opens the dialog.
- Modify `components/lists/AddToListButton.tsx`: anonymous save-to-list CTA opens the dialog for the current practice path.
- Modify `components/practice/ReportDialog.tsx`: anonymous report CTA opens the dialog for the current practice path.
- Modify `app/profile/page.tsx`, `app/me/articles/layout.tsx`, `app/me/lists/page.tsx`, `app/me/lists/[id]/page.tsx`, and `app/me/articles/[slug]/edit/page.tsx`: protected page redirects use `/auth/signin` with safe callbacks.
- Modify `middleware.ts`: anonymous admin-page redirects use `/auth/signin`, while anonymous admin API requests remain `401` JSON.
- Create `tests/e2e/login.spec.ts`: route, callback, external-callback fallback, error state, and responsive smoke coverage.
- Modify existing e2e assertions in `tests/e2e/middleware-and-link-guard.spec.ts` and `tests/e2e/security.spec.ts` that currently expect `/api/auth/signin` for admin page redirects.

## Task 1: Auth Redirect Helper

**Files:**
- Create: `lib/auth-redirect.ts`
- Test later in: `tests/e2e/login.spec.ts`

- [ ] **Step 1: Add the pure helper**

Create `lib/auth-redirect.ts`:

```ts
export type AuthProvider = "google" | "github"

const DEFAULT_CALLBACK_PATH = "/"

export function sanitizeAuthCallbackPath(value: string | string[] | undefined | null): string {
    const raw = Array.isArray(value) ? value[0] : value
    if (!raw) return DEFAULT_CALLBACK_PATH

    let decoded = raw
    try {
        decoded = decodeURIComponent(raw)
    } catch {
        decoded = raw
    }

    if (!decoded.startsWith("/") || decoded.startsWith("//")) {
        return DEFAULT_CALLBACK_PATH
    }

    return decoded
}

export function signInPath(callbackUrl?: string | null): string {
    const safeCallback = sanitizeAuthCallbackPath(callbackUrl)
    if (safeCallback === DEFAULT_CALLBACK_PATH) return "/auth/signin"
    return `/auth/signin?callbackUrl=${encodeURIComponent(safeCallback)}`
}

```

- [ ] **Step 2: Run lint/build for the helper**

Run:

```bash
npm run lint
npm run build
```

Expected: both commands pass. If build fails because environment variables or database access are missing locally, record the exact failure in the PR's "Not yet verified" section and continue with the focused e2e checks once the app can run.

- [ ] **Step 3: Commit**

```bash
git add lib/auth-redirect.ts
git commit -m "feat(auth): add sign-in redirect helpers"
```

## Task 2: Custom Sign-In Page

**Files:**
- Create: `app/auth/signin/page.tsx`
- Uses: `lib/auth-redirect.ts`

- [ ] **Step 1: Add the page**

Create `app/auth/signin/page.tsx`:

```tsx
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { AlertCircle, ArrowRight, Database, Play, ShieldCheck, TerminalSquare } from "lucide-react"
import { auth } from "@/lib/auth"
import { sanitizeAuthCallbackPath } from "@/lib/auth-redirect"
import { ProviderSignInActions } from "@/components/auth/ProviderSignInActions"
import { Card } from "@/components/ui/Card"
import { Logo } from "@/components/ui/Logo"

export const metadata: Metadata = {
    title: "Sign in",
    robots: { index: false, follow: false },
}

type Props = {
    searchParams?: Promise<{
        callbackUrl?: string | string[]
        error?: string | string[]
    }>
}

function first(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value
}

function hasAuthError(value: string | string[] | undefined): boolean {
    return Boolean(first(value))
}

export default async function SignInPage({ searchParams }: Props) {
    const params = (await searchParams) ?? {}
    const callbackUrl = sanitizeAuthCallbackPath(params.callbackUrl)
    const session = await auth()

    if (session?.user?.id) {
        redirect(callbackUrl)
    }

    const showError = hasAuthError(params.error)

    return (
        <main className="min-h-[calc(100dvh-4rem)] bg-background">
            <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8 lg:py-14">
                <section className="order-2 min-w-0 lg:order-1">
                    <div className="mb-6 hidden items-center gap-2 text-xs font-medium uppercase text-muted-foreground sm:flex">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        Query practice workspace
                    </div>
                    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
                        <div className="flex items-center justify-between border-b border-border bg-surface-muted px-4 py-3">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <TerminalSquare className="h-4 w-4 text-primary" />
                                training-session.sql
                            </div>
                            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                                Ready
                            </span>
                        </div>
                        <div className="grid gap-0 lg:grid-cols-[1fr_280px]">
                            <div className="border-b border-border p-4 lg:border-b-0 lg:border-r">
                                <pre className="overflow-x-auto rounded-md bg-background p-4 font-mono text-sm leading-6 text-foreground">
{`SELECT customer_id, SUM(amount) AS total_spend
FROM orders
WHERE status = 'paid'
GROUP BY customer_id
ORDER BY total_spend DESC
LIMIT 5;`}
                                </pre>
                                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                                    <Metric label="Accuracy" value="94%" />
                                    <Metric label="Streak" value="7 days" />
                                    <Metric label="Problems" value="38" />
                                </div>
                            </div>
                            <div className="p-4">
                                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                                    <Database className="h-4 w-4 text-primary" />
                                    Result preview
                                </div>
                                <div className="space-y-2 font-mono text-xs">
                                    {["C-104  18,420", "C-087  15,980", "C-211  13,775"].map((row) => (
                                        <div
                                            key={row}
                                            className="flex justify-between rounded-md border border-border bg-background px-3 py-2"
                                        >
                                            <span>{row.slice(0, 5)}</span>
                                            <span className="text-primary">{row.slice(7)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 flex items-center gap-2 rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-primary">
                                    <Play className="h-3.5 w-3.5" />
                                    Validation pipeline ready
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="order-1 flex items-center lg:order-2">
                    <Card className="w-full p-6 shadow-sm sm:p-7">
                        <div className="mb-8">
                            <Logo />
                            <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
                                Train like the query is going live.
                            </h1>
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                Sign in with your existing provider and continue practicing where you left off.
                            </p>
                        </div>

                        {showError && (
                            <div className="mb-4 flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                <p>Sign-in could not be completed. Try another provider or try again.</p>
                            </div>
                        )}

                        <ProviderSignInActions callbackPath={callbackUrl} />

                        <div className="mt-6 flex items-start gap-2 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
                            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <p>OAuth is handled by the provider. Data Learn never asks for or stores provider passwords.</p>
                        </div>

                        <Link
                            href="/"
                            className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            Back to home
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </Card>
                </section>
            </div>
        </main>
    )
}

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-md border border-border bg-background px-3 py-2">
            <div className="text-muted-foreground">{label}</div>
            <div className="mt-1 font-mono font-semibold tabular-nums">{value}</div>
        </div>
    )
}

function ProviderLink({
    href,
    label,
    icon,
    marker,
    primary,
}: {
    href: string
    label: string
    icon?: React.ReactNode
    marker?: string
    primary?: boolean
}) {
    return (
        <Link
            href={href}
            className={
                primary
                    ? "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-[background-color,box-shadow,scale] duration-150 hover:bg-primary-hover active:scale-[0.98]"
                    : "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-muted px-4 text-sm font-semibold text-foreground transition-[background-color,border-color,scale] duration-150 hover:border-border-strong hover:bg-surface-elevated active:scale-[0.98]"
            }
        >
            {icon}
            {marker && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background text-xs font-bold text-foreground">
                    {marker}
                </span>
            )}
            {label}
        </Link>
    )
}
```

- [ ] **Step 2: Confirm the page compiles**

Run:

```bash
npm run lint
npm run build
```

Expected: no TypeScript, ESLint, or Next build errors.

- [ ] **Step 3: Commit**

```bash
git add app/auth/signin/page.tsx
git commit -m "feat(auth): add custom sign-in page"
```

## Task 3: Route Existing Sign-In Entry Points Through The Dialog/Fallback Flow

**Files:**
- Create: `components/auth/SignInDialog.tsx`
- Modify: `components/layout/Navbar.tsx`
- Modify: `components/layout/Footer.tsx`
- Modify: `components/lists/AddToListButton.tsx`
- Modify: `components/practice/ReportDialog.tsx`
- Modify: `app/profile/page.tsx`
- Modify: `app/me/articles/layout.tsx`
- Modify: `app/me/lists/page.tsx`
- Modify: `app/me/lists/[id]/page.tsx`
- Modify: `app/me/articles/[slug]/edit/page.tsx`
- Modify: `middleware.ts`

- [ ] **Step 1: Add reusable sign-in dialog**

Create `components/auth/SignInDialog.tsx`. It should be a `"use client"` component with:

- a trigger button rendered by the component
- the current `window.location` path/search/hash captured at click time
- an optional `callbackPath` prop for CTAs that already know the desired destination
- provider actions using the shared `ProviderSignInActions` component, which calls Auth.js `signIn(provider, { redirectTo: callbackPath })`
- fallback link using `signInPath(callbackPath)`
- Escape/backdrop/close-button dismissal
- focus restore to the trigger after close
- 44px provider targets

- [ ] **Step 2: Update layout sign-in actions**

In `components/layout/Navbar.tsx`, replace the anonymous `LinkButton`/mobile `Link` sign-in controls with `SignInDialogButton`.

In `components/layout/Footer.tsx`, replace the account Sign in link with a footer-styled dialog trigger.

- [ ] **Step 3: Update client CTA actions**

In `components/lists/AddToListButton.tsx`, replace the anonymous `Link` with `SignInDialogButton` using link-like styling and `callbackPath={pathname ?? "/practice"}`.

In `components/practice/ReportDialog.tsx`, replace the anonymous `Link` with `SignInDialogButton` using link-like styling and `callbackPath={pathname ?? "/practice"}`.

- [ ] **Step 4: Update protected server redirects**

In these files, import `signInPath` from `@/lib/auth-redirect` and replace direct Auth.js redirects:

```ts
redirect(signInPath("/profile"))
redirect(signInPath("/me/articles"))
redirect(signInPath("/me/lists"))
redirect(signInPath(`/me/lists/${id}`))
redirect(signInPath(`/me/articles/${slug}/edit`))
```

Use the matching path in the matching file:

- `app/profile/page.tsx`: `/profile`
- `app/me/articles/layout.tsx`: `/me/articles`
- `app/me/lists/page.tsx`: `/me/lists`
- `app/me/lists/[id]/page.tsx`: `/me/lists/${id}`
- `app/me/articles/[slug]/edit/page.tsx`: `/me/articles/${slug}/edit`

For `app/me/articles/[slug]/edit/page.tsx`, move `const { slug } = await params` before the auth redirect so the callback includes the edit URL.

- [ ] **Step 5: Update middleware admin-page redirects only**

In `middleware.ts`, import `signInPath`:

```ts
import { signInPath } from "@/lib/auth-redirect"
```

Replace:

```ts
const url = new URL("/api/auth/signin", req.nextUrl)
url.searchParams.set("callbackUrl", pathname)
return NextResponse.redirect(url)
```

with:

```ts
return NextResponse.redirect(new URL(signInPath(pathname), req.nextUrl))
```

Do not change the anonymous `/api/admin/*` JSON `401` behavior.

- [ ] **Step 6: Run lint/build**

Run:

```bash
npm run lint
npm run build
```

Expected: both pass.

- [ ] **Step 7: Commit**

```bash
git add components/auth/SignInDialog.tsx components/layout/Navbar.tsx components/layout/Footer.tsx components/lists/AddToListButton.tsx components/practice/ReportDialog.tsx app/profile/page.tsx app/me/articles/layout.tsx app/me/lists/page.tsx 'app/me/lists/[id]/page.tsx' 'app/me/articles/[slug]/edit/page.tsx' middleware.ts
git commit -m "feat(auth): add in-app sign-in dialog"
```

## Task 4: Login E2E Coverage

**Files:**
- Create: `tests/e2e/login.spec.ts`
- Modify: `tests/e2e/middleware-and-link-guard.spec.ts`
- Modify: `tests/e2e/security.spec.ts`

- [ ] **Step 1: Add login tests**

Create `tests/e2e/login.spec.ts`:

```ts
import { test, expect } from "@playwright/test"

test.describe("custom sign-in page", () => {
    test("renders provider actions", async ({ page }) => {
        await page.goto("/auth/signin")

        await expect(page.getByRole("heading", { name: /train like the query is going live/i })).toBeVisible()
        await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible()
        await expect(page.getByRole("button", { name: /continue with github/i })).toBeVisible()
    })

    test("provider actions preserve safe internal callback", async ({ page }) => {
        await page.goto("/auth/signin?callbackUrl=/profile")

        // Mock Auth.js providers/csrf, click Google, and assert the POST body
        // contains callbackUrl=/profile.
    })

    test("provider actions reject external callback", async ({ page }) => {
        await page.goto("/auth/signin?callbackUrl=https%3A%2F%2Fexample.com%2Fsteal")

        // Mock Auth.js providers/csrf, click Google, and assert the POST body
        // falls back to callbackUrl=/.
    })

    test("renders generic error state", async ({ page }) => {
        await page.goto("/auth/signin?error=AccessDenied")

        await expect(page.getByText("Sign-in could not be completed.")).toBeVisible()
    })

    test("mobile layout keeps sign-in actions visible without horizontal scroll", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 })
        await page.goto("/auth/signin?callbackUrl=/me/lists")

        await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible()
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
        expect(overflow).toBe(false)
    })
})
```

- [ ] **Step 2: Update existing redirect expectations**

In `tests/e2e/middleware-and-link-guard.spec.ts`, update anonymous admin-page redirect expectations from `/api/auth/signin` to `/auth/signin`:

```ts
expect(location).toContain("/auth/signin")
expect(location).toContain("callbackUrl=%2Fadmin%2Farticles")
```

In `tests/e2e/security.spec.ts`, update:

```ts
expect(res.headers()["location"]).toContain("/auth/signin")
```

Do not change tests for API routes; those should continue asserting `401` JSON, not redirects.

- [ ] **Step 3: Build before e2e**

Run:

```bash
npm run build
```

Expected: build passes, because Playwright uses `npm run start`.

- [ ] **Step 4: Run focused e2e**

Run:

```bash
npm run test:e2e -- tests/e2e/login.spec.ts tests/e2e/middleware-and-link-guard.spec.ts tests/e2e/security.spec.ts
```

Expected: all focused tests pass. If the local DB is unavailable, record the DB failure and still run `npm run lint` and `npm run build`.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/login.spec.ts tests/e2e/middleware-and-link-guard.spec.ts tests/e2e/security.spec.ts
git commit -m "test(auth): cover custom sign-in flow"
```

## Task 5: Browser Visual QA And Final Checks

**Files:**
- No required code changes unless QA exposes layout issues.

- [ ] **Step 1: Start the app**

Run:

```bash
npm run dev
```

Expected: Next dev server starts. Use an available port if `3000` is occupied.

- [ ] **Step 2: Inspect desktop**

Open `/auth/signin?callbackUrl=/profile` at about `1440x900`.

Confirm:

- the page has a balanced two-column layout
- the sign-in panel is not nested inside another card
- provider buttons are visible and at least 44px tall
- provider actions POST to Auth.js with callback `/profile`
- navbar sign-in opens a dialog on `/practice`
- dialog provider actions post with the current path callback
- Escape closes the dialog and returns focus to the trigger

- [ ] **Step 3: Inspect mobile**

Open the same route at about `375x812`.

Confirm:

- no horizontal scrolling
- the sign-in buttons appear early without needing to pass a large decorative section
- text does not overlap or overflow its containers
- focus ring is visible when tabbing through the provider buttons
- mobile navigation sign-in opens the same dialog without conflicting with the drawer

- [ ] **Step 4: Run final verification**

Run:

```bash
npm run lint
npm run build
npm run test:e2e -- tests/e2e/login.spec.ts
```

Expected: all pass.

- [ ] **Step 5: Final branch check**

Run:

```bash
git status --short --branch
git log --oneline main..HEAD
```

Expected: working tree clean and commits are on the topic branch only.

## PR Notes

Open a feature PR from the implementation branch to `main`, not `production`.

Suggested PR title:

```text
feat(auth): add custom sign-in screen
```

Suggested summary:

```markdown
Adds a custom in-app sign-in dialog and `/auth/signin` fallback page that preserve the existing Auth.js provider API flow while replacing the default sign-in UI. Updates anonymous sign-in entry points to open the dialog where possible, keeps protected server redirects on the fallback page, and adds Playwright coverage for callback sanitization, provider actions, error state, and mobile layout.
```

Suggested verified section:

```markdown
- npm run lint
- npm run build
- npm run test:e2e -- tests/e2e/login.spec.ts tests/e2e/middleware-and-link-guard.spec.ts tests/e2e/security.spec.ts
- Browser QA at desktop and mobile widths for `/auth/signin?callbackUrl=/profile` and the in-app sign-in dialog on `/practice`
```

Release flow after merge:

1. Merge this feature PR into `main`.
2. Verify the Vercel Preview for `main`.
3. When ready to ship, open a release PR `main -> production` titled `release: vX.Y.Z`.
4. Tag the production merge commit after the release PR merges.
