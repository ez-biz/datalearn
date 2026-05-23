# Anonymous Access Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a LeetCode-style anonymous workspace gate: three free problem starts per browser, then a sign-in wall before any new Run or Submit engine execution.

**Architecture:** Keep the gate at the user-action boundary in `SqlPlayground`, not in `useProblemDB`, so schema introspection and sample previews remain unmetered. Use localStorage as the fast client-side counter and an HMAC-signed HttpOnly cookie as a soft server-side check; both must agree before a new fourth slug executes. Keep auth reset out of `Navbar` by mounting a tiny client component in the root layout that calls a server action and clears localStorage only when the action confirms a signed-in session.

**Tech Stack:** Next.js App Router server actions, NextAuth v5 Prisma sessions, React client components, Vercel Analytics, Playwright e2e, Node `node:test` scripts, HMAC-SHA256 via `node:crypto`.

---

## File Structure

- Create `lib/anon-gate-constants.ts`: client-safe constants and shared types. No Node imports.
- Create `lib/anon-gate.ts`: server-side HMAC signing, verification, cookie parsing, and pure counter helpers. This file imports `node:crypto`; client components must not import it.
- Create `lib/anon-gate-client.ts`: localStorage read/write helpers for client components.
- Create `actions/runtime.ts`: server actions `validateRunQuery` and `clearAnonRunCookie`.
- Create `components/auth/AnonStorageReset.tsx`: root-mounted client reset bridge.
- Create `components/auth/SignInModal.tsx`: trial-exhausted modal using the existing portal/focus-trap and provider button patterns.
- Modify `components/auth/ProviderSignInActions.tsx`: optional provider-click callback for telemetry.
- Modify `app/layout.tsx`: mount `<AnonStorageReset />`; do not call `auth()` here just for gating.
- Modify `components/sql/SqlEditor.tsx`: allow a lock cue on the editor-header Run button.
- Modify `components/sql/SqlPlayground.tsx`: hydrate anon state, render chip/lock, and route Run/Submit through `gateAndExecute`.
- Modify `components/practice/ProblemClient.tsx`: own the modal state and pass `isSignedIn` / `onTrialExhausted`.
- Modify `app/privacy/page.tsx`: document the functional anon-trial cookie.
- Modify `.env.example`: add `ANON_GATE_SECRET`.
- Modify `package.json`: add `test:anon-gate`.
- Create `scripts/test-anon-gate.ts`: unit tests for the HMAC/counter helper.
- Create `tests/e2e/anon-gate.spec.ts`: browser regression tests for background loads, Run, Submit bypass, reset, and Navbar.

---

### Task 1: Pure Anonymous Counter Helpers

**Files:**
- Create: `lib/anon-gate-constants.ts`
- Create: `lib/anon-gate.ts`
- Create: `scripts/test-anon-gate.ts`
- Modify: `package.json`

- [ ] **Step 1: Add the failing unit test**

Create `scripts/test-anon-gate.ts`:

```ts
import assert from "node:assert/strict"
import test from "node:test"
import {
    ANON_STARTED_COOKIE_NAME,
    MAX_FREE_PROBLEMS,
} from "../lib/anon-gate-constants"
import {
    buildNextCounter,
    parseCookieValue,
    signCounter,
    verifyCounter,
} from "../lib/anon-gate"

const SECRET = "test-secret-with-enough-entropy"

test("anonymous gate constants are stable", () => {
    assert.equal(MAX_FREE_PROBLEMS, 3)
    assert.equal(ANON_STARTED_COOKIE_NAME, "dl_anon_started")
})

test("signCounter and verifyCounter round trip normalized slugs", () => {
    const signed = signCounter(
        { startedSlugs: ["simple-select", "simple-select", "", "../bad"] },
        SECRET
    )

    assert.deepEqual(verifyCounter(signed, SECRET), {
        startedSlugs: ["simple-select"],
    })
})

test("verifyCounter rejects tampered payloads", () => {
    const signed = signCounter({ startedSlugs: ["simple-select"] }, SECRET)
    const tampered = signed.replace("simple-select", "top-selling-products")

    assert.equal(verifyCounter(tampered, SECRET), null)
    assert.deepEqual(parseCookieValue(tampered, SECRET), { startedSlugs: [] })
})

test("buildNextCounter appends new slugs once and reports exhaustion", () => {
    const one = buildNextCounter([], "simple-select")
    assert.deepEqual(one, {
        ok: true,
        consumedNewSlot: true,
        startedSlugs: ["simple-select"],
    })

    const rerun = buildNextCounter(["simple-select"], "simple-select")
    assert.deepEqual(rerun, {
        ok: true,
        consumedNewSlot: false,
        startedSlugs: ["simple-select"],
    })

    const exhausted = buildNextCounter(
        ["simple-select", "total-revenue-per-customer", "top-selling-products"],
        "customers-by-country"
    )
    assert.deepEqual(exhausted, {
        ok: false,
        reason: "trial-exhausted",
        startedSlugs: [
            "simple-select",
            "total-revenue-per-customer",
            "top-selling-products",
        ],
    })
})

// Defends against a malformed-but-validly-signed cookie that arrives with
// more entries than MAX_FREE_PROBLEMS (e.g., a future schema migration
// rolled back, or a forged cookie signed with a leaked secret). The cap
// must apply on the way in, and the resulting state must be treated as
// exhausted by buildNextCounter.
test("parseCookieValue caps incoming slugs at MAX_FREE_PROBLEMS", () => {
    const oversized = signCounter(
        {
            startedSlugs: [
                "simple-select",
                "total-revenue-per-customer",
                "top-selling-products",
                "customers-by-country",
                "orders-per-month",
            ],
        },
        SECRET
    )

    const parsed = parseCookieValue(oversized, SECRET)
    assert.equal(parsed.startedSlugs.length, MAX_FREE_PROBLEMS)
    assert.deepEqual(parsed.startedSlugs, [
        "simple-select",
        "total-revenue-per-customer",
        "top-selling-products",
    ])

    const next = buildNextCounter(parsed.startedSlugs, "orders-per-month")
    assert.equal(next.ok, false)
    if (next.ok === false) {
        assert.equal(next.reason, "trial-exhausted")
    }
})
```

Also update the imports at the top of the file to include `MAX_FREE_PROBLEMS`:

```ts
import {
    ANON_STARTED_COOKIE_NAME,
    MAX_FREE_PROBLEMS,
} from "../lib/anon-gate-constants"
```

(The file already imports `MAX_FREE_PROBLEMS` from the constants module — confirm in your patch that the import list matches.)

Add the package script:

```json
"test:anon-gate": "node --import tsx --test scripts/test-anon-gate.ts"
```

- [ ] **Step 2: Run the unit test to verify it fails**

Run:

```bash
npm run test:anon-gate
```

Expected: FAIL because `lib/anon-gate-constants.ts` and `lib/anon-gate.ts` do not exist.

- [ ] **Step 3: Add client-safe constants**

Create `lib/anon-gate-constants.ts`:

```ts
export const MAX_FREE_PROBLEMS = 3
export const ANON_STARTED_STORAGE_KEY = "dl:anon:startedSlugs"
export const ANON_STARTED_COOKIE_NAME = "dl_anon_started"
export const ANON_GATE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export type AnonGateIntent = "run" | "submit"
export type TrialExhaustedReason = "trial-exhausted"

export interface TrialExhaustedEvent {
    slug: string
    reason: TrialExhaustedReason
    intent: AnonGateIntent
}
```

- [ ] **Step 4: Add server-only HMAC helpers**

Create `lib/anon-gate.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto"
import { MAX_FREE_PROBLEMS } from "@/lib/anon-gate-constants"

export { MAX_FREE_PROBLEMS } from "@/lib/anon-gate-constants"

export interface AnonCounter {
    startedSlugs: string[]
}

export type AnonGateDecision =
    | {
          ok: true
          consumedNewSlot: boolean
          startedSlugs: string[]
      }
    | {
          ok: false
          reason: "trial-exhausted"
          startedSlugs: string[]
      }

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function normalizeStartedSlugs(value: unknown): string[] {
    if (!Array.isArray(value)) return []

    const out: string[] = []
    for (const item of value) {
        if (typeof item !== "string") continue
        const slug = item.trim()
        if (!SLUG_PATTERN.test(slug)) continue
        if (!out.includes(slug)) out.push(slug)
        if (out.length >= MAX_FREE_PROBLEMS) break
    }
    return out
}

function encodeBase64Url(value: string): string {
    return Buffer.from(value, "utf8").toString("base64url")
}

function decodeBase64Url(value: string): string | null {
    try {
        return Buffer.from(value, "base64url").toString("utf8")
    } catch {
        return null
    }
}

function digest(payload: string, secret: string): string {
    return createHmac("sha256", secret).update(payload).digest("base64url")
}

function safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a)
    const right = Buffer.from(b)
    return left.length === right.length && timingSafeEqual(left, right)
}

export function signCounter(counter: AnonCounter, secret: string): string {
    const payload = encodeBase64Url(
        JSON.stringify({
            startedSlugs: normalizeStartedSlugs(counter.startedSlugs),
        })
    )
    return `${payload}.${digest(payload, secret)}`
}

export function verifyCounter(value: string | undefined, secret: string): AnonCounter | null {
    if (!value) return null
    const [payload, signature, extra] = value.split(".")
    if (!payload || !signature || extra !== undefined) return null
    if (!safeEqual(signature, digest(payload, secret))) return null

    const decoded = decodeBase64Url(payload)
    if (!decoded) return null

    try {
        const parsed = JSON.parse(decoded) as { startedSlugs?: unknown }
        return { startedSlugs: normalizeStartedSlugs(parsed.startedSlugs) }
    } catch {
        return null
    }
}

export function parseCookieValue(value: string | undefined, secret: string): AnonCounter {
    return verifyCounter(value, secret) ?? { startedSlugs: [] }
}

export function buildNextCounter(
    currentSlugs: string[],
    slug: string
): AnonGateDecision {
    const startedSlugs = normalizeStartedSlugs(currentSlugs)
    const normalizedSlug = slug.trim()

    if (!SLUG_PATTERN.test(normalizedSlug)) {
        return { ok: false, reason: "trial-exhausted", startedSlugs }
    }

    if (startedSlugs.includes(normalizedSlug)) {
        return { ok: true, consumedNewSlot: false, startedSlugs }
    }

    if (startedSlugs.length >= MAX_FREE_PROBLEMS) {
        return { ok: false, reason: "trial-exhausted", startedSlugs }
    }

    return {
        ok: true,
        consumedNewSlot: true,
        startedSlugs: [...startedSlugs, normalizedSlug],
    }
}
```

- [ ] **Step 5: Run the unit test to verify it passes**

Run:

```bash
npm run test:anon-gate
```

Expected: PASS for all `scripts/test-anon-gate.ts` tests.

- [ ] **Step 6: Commit**

```bash
git add package.json lib/anon-gate-constants.ts lib/anon-gate.ts scripts/test-anon-gate.ts
git commit -m "feat(runtime): add anonymous gate counter helpers"
```

---

### Task 2: Runtime Server Actions And Environment Contract

**Files:**
- Create: `actions/runtime.ts`
- Modify: `.env.example`
- Modify: `app/privacy/page.tsx`
- Test: `scripts/test-anon-gate.ts`

- [ ] **Step 1: Extend the failing helper test for runtime secret behavior**

Append to `scripts/test-anon-gate.ts`:

```ts
import { getAnonGateSecretForRuntime } from "../lib/anon-gate"

test("getAnonGateSecretForRuntime allows local fallback but requires deployed secret", () => {
    assert.equal(
        getAnonGateSecretForRuntime({ anonGateSecret: "configured", vercelEnv: "production" }),
        "configured"
    )
    assert.equal(
        getAnonGateSecretForRuntime({ anonGateSecret: undefined, vercelEnv: undefined }),
        "development-anon-gate-secret"
    )
    assert.throws(
        () =>
            getAnonGateSecretForRuntime({
                anonGateSecret: undefined,
                vercelEnv: "preview",
            }),
        /ANON_GATE_SECRET/
    )
})
```

- [ ] **Step 2: Run the unit test to verify it fails**

Run:

```bash
npm run test:anon-gate
```

Expected: FAIL because `getAnonGateSecretForRuntime` is not exported.

- [ ] **Step 3: Add the runtime secret helper**

Append this export to `lib/anon-gate.ts`:

```ts
export function getAnonGateSecretForRuntime(env: {
    anonGateSecret: string | undefined
    vercelEnv: string | undefined
}): string {
    if (env.anonGateSecret) return env.anonGateSecret
    if (env.vercelEnv === "production" || env.vercelEnv === "preview") {
        throw new Error("ANON_GATE_SECRET is required for deployed anonymous gating")
    }
    return "development-anon-gate-secret"
}
```

- [ ] **Step 4: Add the server actions**

Create `actions/runtime.ts`:

```ts
"use server"

import { cookies } from "next/headers"
import { auth } from "@/lib/auth"
import {
    ANON_GATE_COOKIE_MAX_AGE_SECONDS,
    ANON_STARTED_COOKIE_NAME,
} from "@/lib/anon-gate-constants"
import {
    buildNextCounter,
    getAnonGateSecretForRuntime,
    parseCookieValue,
    signCounter,
    type AnonGateDecision,
} from "@/lib/anon-gate"

export type ValidateRunQueryResult = AnonGateDecision

function anonGateSecret(): string {
    return getAnonGateSecretForRuntime({
        anonGateSecret: process.env.ANON_GATE_SECRET,
        vercelEnv: process.env.VERCEL_ENV,
    })
}

export async function validateRunQuery(input: {
    slug: string
}): Promise<ValidateRunQueryResult> {
    const session = await auth()
    const cookieStore = await cookies()
    const secret = anonGateSecret()
    const current = parseCookieValue(
        cookieStore.get(ANON_STARTED_COOKIE_NAME)?.value,
        secret
    )

    if (session?.user?.id) {
        return {
            ok: true,
            consumedNewSlot: false,
            startedSlugs: current.startedSlugs,
        }
    }

    const decision = buildNextCounter(current.startedSlugs, input.slug)
    if (decision.ok && decision.consumedNewSlot) {
        cookieStore.set(
            ANON_STARTED_COOKIE_NAME,
            signCounter({ startedSlugs: decision.startedSlugs }, secret),
            {
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                path: "/",
                maxAge: ANON_GATE_COOKIE_MAX_AGE_SECONDS,
            }
        )
    }

    return decision
}

export async function clearAnonRunCookie(): Promise<{ signedIn: boolean }> {
    const session = await auth()
    if (!session?.user?.id) return { signedIn: false }

    const cookieStore = await cookies()
    cookieStore.delete(ANON_STARTED_COOKIE_NAME)
    return { signedIn: true }
}
```

- [ ] **Step 5: Add the environment variable hint**

In `.env.example`, add:

```bash
# HMAC secret for the anonymous free-trial cookie.
# Generate with: openssl rand -base64 32
ANON_GATE_SECRET=
```

- [ ] **Step 6: Update privacy copy for the functional cookie**

In `app/privacy/page.tsx`, update the cookies paragraph to include this sentence:

```tsx
We also use a first-party functional cookie to remember how many anonymous practice problems have been started in the current browser, so the free trial can work without tracking you across sites.
```

- [ ] **Step 7: Run unit and type checks**

Run:

```bash
npm run test:anon-gate
npx tsc --noEmit -p .
```

Expected: both commands pass.

- [ ] **Step 8: Commit**

```bash
git add actions/runtime.ts .env.example app/privacy/page.tsx lib/anon-gate.ts scripts/test-anon-gate.ts
git commit -m "feat(runtime): add anonymous query gate actions"
```

---

### Task 3: Client Storage And Sign-In Reset Bridge

**Files:**
- Create: `lib/anon-gate-client.ts`
- Create: `components/auth/AnonStorageReset.tsx`
- Modify: `app/layout.tsx`
- Test: `tests/e2e/anon-gate.spec.ts`

- [ ] **Step 1: Add the failing reset e2e skeleton**

Create `tests/e2e/anon-gate.spec.ts`:

```ts
import { expect, test } from "@playwright/test"
import {
    deleteUser,
    seedUser,
    sessionCookie,
} from "./fixtures/db"

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3100"
const STORAGE_KEY = "dl:anon:startedSlugs"
const COOKIE_NAME = "dl_anon_started"
const USER_EMAIL = "anon-gate-e2e@example.test"

test.afterEach(async () => {
    await deleteUser(USER_EMAIL)
})

// AnonStorageReset receives isSignedIn as a server-derived prop. When the
// layout sees a session, the prop is true and the client effect clears
// localStorage synchronously on mount (no awaited server-action round-trip).
// The cookie clear is fire-and-forget against the server action.
test("signed-in root layout mount clears anonymous trial storage", async ({
    page,
    context,
}) => {
    const user = await seedUser({ email: USER_EMAIL, name: "Anon Gate E2E" })

    await page.addInitScript(
        ({ key }) => {
            window.localStorage.setItem(
                key,
                JSON.stringify([
                    "simple-select",
                    "total-revenue-per-customer",
                    "top-selling-products",
                ])
            )
        },
        { key: STORAGE_KEY }
    )
    await context.addCookies([
        {
            name: COOKIE_NAME,
            value: "invalid-test-cookie",
            domain: new URL(BASE_URL).hostname,
            path: "/",
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
            expires: Math.floor(Date.now() / 1000) + 3600,
        },
        sessionCookie(user.sessionToken, BASE_URL),
    ])

    await page.goto("/practice/simple-select")

    await expect
        .poll(() => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY), {
            timeout: 15_000,
        })
        .toBe(null)

    const cookies = await context.cookies()
    expect(cookies.some((cookie) => cookie.name === COOKIE_NAME)).toBe(false)
})
```

- [ ] **Step 2: Run the reset e2e to verify it fails**

Run:

```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run build
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' E2E_PORT=3100 npx playwright test tests/e2e/anon-gate.spec.ts -g "signed-in root layout mount"
```

Expected: FAIL because `AnonStorageReset` is not mounted and storage remains.

- [ ] **Step 3: Add client localStorage helpers**

Create `lib/anon-gate-client.ts`:

```ts
"use client"

import {
    ANON_STARTED_STORAGE_KEY,
    MAX_FREE_PROBLEMS,
} from "@/lib/anon-gate-constants"

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function readAnonStartedSlugs(): string[] {
    try {
        const raw = window.localStorage.getItem(ANON_STARTED_STORAGE_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []

        const out: string[] = []
        for (const item of parsed) {
            if (typeof item !== "string") continue
            const slug = item.trim()
            if (!SLUG_PATTERN.test(slug)) continue
            if (!out.includes(slug)) out.push(slug)
            if (out.length >= MAX_FREE_PROBLEMS) break
        }
        return out
    } catch {
        return []
    }
}

export function writeAnonStartedSlugs(slugs: string[]): string[] {
    const normalized = slugs
        .filter((slug, index, list) => SLUG_PATTERN.test(slug) && list.indexOf(slug) === index)
        .slice(0, MAX_FREE_PROBLEMS)

    try {
        window.localStorage.setItem(
            ANON_STARTED_STORAGE_KEY,
            JSON.stringify(normalized)
        )
    } catch {}

    return normalized
}

export function clearAnonStartedSlugs(): void {
    try {
        window.localStorage.removeItem(ANON_STARTED_STORAGE_KEY)
    } catch {}
}
```

- [ ] **Step 4: Add the reset bridge**

Create `components/auth/AnonStorageReset.tsx`:

```tsx
"use client"

import { useEffect } from "react"
import { clearAnonRunCookie } from "@/actions/runtime"
import { clearAnonStartedSlugs } from "@/lib/anon-gate-client"

/**
 * Receives `isSignedIn` as a server-derived prop from the root layout's
 * existing `auth()` call. Anonymous mounts short-circuit on the boolean,
 * so anon users pay zero HTTP work per page load. Signed-in mounts clear
 * localStorage immediately and fire-and-forget the server-side cookie
 * delete; the server action does its own `auth()` check as defense in
 * depth against direct/forged calls.
 *
 * Why "every mount while signedIn", not "on false -> true transition":
 * OAuth flows navigate to /api/auth/callback/<provider> and return with a
 * full root-layout remount. A useRef-based transition tracker mounts
 * fresh with prevRef = null and isSignedIn = true, so the transition
 * condition never fires. Clearing on every mount-while-signed-in is the
 * OAuth-callback-safe rule; localStorage removeItem is a no-op when the
 * key is already absent.
 */
export function AnonStorageReset({ isSignedIn }: { isSignedIn: boolean }) {
    useEffect(() => {
        if (!isSignedIn) return
        clearAnonStartedSlugs()
        // Fire-and-forget. We don't need to await the server cookie clear
        // because localStorage is already cleared; the server side is
        // belt-and-suspenders defense against a stale signed cookie.
        void clearAnonRunCookie()
    }, [isSignedIn])

    return null
}
```

- [ ] **Step 5: Mount the reset bridge in the root layout, threading the existing `auth()` result**

Modify `app/layout.tsx`. The layout already calls `auth()` for `<Navbar />` (and the existing CSP nonce integration). Reuse that result — do NOT add a second `auth()` call.

```tsx
import { auth } from "@/lib/auth";
import { AnonStorageReset } from "@/components/auth/AnonStorageReset";
```

Inside the default-export async function, where `session` (or equivalent) is already being computed for `<Navbar />`:

```tsx
const session = await auth();   // already present for Navbar; do not duplicate
const isSignedIn = Boolean(session?.user?.id);
// ...
<Navbar />
<AnonStorageReset isSignedIn={isSignedIn} />
<div
    id="main-content"
    tabIndex={-1}
    className="flex-1 flex flex-col focus:outline-none"
>
    {children}
</div>
```

If `app/layout.tsx` currently invokes `auth()` only indirectly (e.g., inside `Navbar`), thread the call up to the layout so the boolean can be derived once and shared. **Do not add a second `auth()` call inside `AnonStorageReset` or in a separate server action invoked from mount** — that was the previous design and it cost an extra session lookup per page load for every visitor.

- [ ] **Step 6: Run the reset e2e to verify it passes**

Run:

```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run build
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' E2E_PORT=3100 npx playwright test tests/e2e/anon-gate.spec.ts -g "signed-in root layout mount"
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/layout.tsx components/auth/AnonStorageReset.tsx lib/anon-gate-client.ts tests/e2e/anon-gate.spec.ts
git commit -m "feat(auth): clear anonymous trial state after sign-in"
```

---

### Task 4: Trial Wall Modal And Provider Telemetry Hook

**Files:**
- Create: `components/auth/SignInModal.tsx`
- Modify: `components/auth/ProviderSignInActions.tsx`

- [ ] **Step 1: Add provider-click callback support**

Modify `components/auth/ProviderSignInActions.tsx`:

```tsx
interface ProviderSignInActionsProps {
    callbackPath?: string | null
    onProviderClick?: (provider: AuthProvider) => void
}

export function ProviderSignInActions({
    callbackPath,
    onProviderClick,
}: ProviderSignInActionsProps) {
    const [pendingProvider, setPendingProvider] = useState<AuthProvider | null>(
        null
    )
    const safeCallback = sanitizeAuthCallbackPath(callbackPath)

    async function handleProviderSignIn(provider: AuthProvider) {
        onProviderClick?.(provider)
        setPendingProvider(provider)
        try {
            await signIn(provider, { redirectTo: safeCallback })
        } finally {
            setPendingProvider(null)
        }
    }

    return (
        <div className="space-y-3">
            {PROVIDERS.map((provider) => (
                <ProviderButton
                    key={provider.id}
                    label={provider.label}
                    marker={provider.marker}
                    primary={provider.primary}
                    loading={pendingProvider === provider.id}
                    disabled={pendingProvider !== null}
                    onClick={() => handleProviderSignIn(provider.id)}
                />
            ))}
        </div>
    )
}
```

- [ ] **Step 2: Add the trial wall modal**

Create `components/auth/SignInModal.tsx`:

```tsx
"use client"

import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { track } from "@vercel/analytics"
import { Lock, X } from "lucide-react"
import { ProviderSignInActions } from "@/components/auth/ProviderSignInActions"
import { Logo } from "@/components/ui/Logo"
import type { AnonGateIntent } from "@/lib/anon-gate-constants"

interface SignInModalProps {
    open: boolean
    slug: string | null
    attemptedFrom: AnonGateIntent | null
    onClose: () => void
}

export function SignInModal({
    open,
    slug,
    attemptedFrom,
    onClose,
}: SignInModalProps) {
    const closeRef = useRef<HTMLButtonElement>(null)
    const dialogRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open || !slug || !attemptedFrom) return
        track("anon_wall_shown", { slug, attemptedFrom })
    }, [open, slug, attemptedFrom])

    useEffect(() => {
        if (!open) return

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = "hidden"
        closeRef.current?.focus()

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                onClose()
                return
            }
            if (event.key !== "Tab") return

            const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
            if (!focusable?.length) return

            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault()
                last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault()
                first.focus()
            }
        }

        document.addEventListener("keydown", onKeyDown)
        return () => {
            document.body.style.overflow = previousOverflow
            document.removeEventListener("keydown", onKeyDown)
        }
    }, [open, onClose])

    if (!open || typeof document === "undefined") return null

    const callbackPath = `${window.location.pathname}${window.location.search}${window.location.hash}`

    return createPortal(
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6"
            role="dialog"
            aria-modal="true"
            aria-label="Sign in to continue solving"
            data-testid="anon-trial-modal"
        >
            <button
                type="button"
                aria-label="Close sign-in modal"
                className="absolute inset-0 cursor-default bg-background/80 backdrop-blur-sm"
                onClick={onClose}
            />
            <div
                ref={dialogRef}
                className="relative w-full max-w-md rounded-lg border border-border bg-surface p-6 text-foreground shadow-xl sm:p-7"
            >
                <button
                    ref={closeRef}
                    type="button"
                    aria-label="Maybe later"
                    onClick={onClose}
                    className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                >
                    <X aria-hidden="true" className="h-4 w-4" />
                </button>

                <div className="pr-8">
                    <Logo />
                    <div className="mt-6 inline-flex h-10 w-10 items-center justify-center rounded-md border border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-300">
                        <Lock aria-hidden="true" className="h-4 w-4" />
                    </div>
                    <h2 className="mt-4 text-2xl font-bold tracking-tight">
                        Nice - you've tried 3 problems.
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Sign in to keep solving, save your progress, and unlock
                        the full catalog.
                    </p>
                </div>

                <div className="mt-6">
                    <ProviderSignInActions
                        callbackPath={callbackPath}
                        onProviderClick={(provider) => {
                            if (slug) {
                                track("anon_signin_from_wall", { slug, provider })
                            }
                        }}
                    />
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="mt-5 inline-flex text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                    Maybe later
                </button>
            </div>
        </div>,
        document.body
    )
}
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
npx tsc --noEmit -p .
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/auth/ProviderSignInActions.tsx components/auth/SignInModal.tsx
git commit -m "feat(auth): add anonymous trial sign-in modal"
```

---

### Task 5: Workspace Gate UI And Engine Boundary

**Files:**
- Modify: `components/sql/SqlEditor.tsx`
- Modify: `components/sql/SqlPlayground.tsx`
- Modify: `components/practice/ProblemClient.tsx`
- Test: `tests/e2e/anon-gate.spec.ts`

- [ ] **Step 1: Add failing e2e coverage for page-loads and Run quota**

Append to `tests/e2e/anon-gate.spec.ts`:

```ts
const SLUGS = [
    "simple-select",
    "total-revenue-per-customer",
    "top-selling-products",
    "customers-by-country",
]

async function waitForRun(page: import("@playwright/test").Page) {
    const runButton = page.getByTestId("workspace-run-footer")
    await expect(runButton).toBeEnabled({ timeout: 60_000 })
    return runButton
}

test("anonymous page loads do not consume trial slots", async ({ page }) => {
    for (const slug of SLUGS) {
        await page.goto(`/practice/${slug}`)
        await expect(page.getByText("3 free runs")).toBeVisible({
            timeout: 60_000,
        })
    }

    const started = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)
    expect(started).toBe(null)
})

test("anonymous Run consumes three new slugs and walls the fourth", async ({
    page,
}) => {
    for (const [index, slug] of SLUGS.slice(0, 3).entries()) {
        await page.goto(`/practice/${slug}`)
        const runButton = await waitForRun(page)
        await runButton.click()
        await expect(page.getByRole("table").first()).toBeVisible({
            timeout: 60_000,
        })
        await expect
            .poll(() =>
                page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]").length, STORAGE_KEY)
            )
            .toBe(index + 1)
    }

    await page.goto(`/practice/${SLUGS[3]}`)
    await expect(page.getByText("3 free runs")).toBeHidden()
    const runButton = await waitForRun(page)
    await runButton.click()

    await expect(page.getByTestId("anon-trial-modal")).toBeVisible()
    await expect(page.getByRole("table").first()).toBeHidden()
    await expect
        .poll(() =>
            page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]").length, STORAGE_KEY)
        )
        .toBe(3)
})

// The Submit shortcut must hit the same gate as the Run button. If this test
// is missing here, an implementer could complete Task 5's chip + Run gate
// without realizing that Submit (Cmd/Ctrl+Shift+Enter) still bypasses the
// wall — because SqlPlayground.handleSubmit currently runs the engine
// query *before* invoking onSubmit (which is what the server-side
// validateSubmission auth gate blocks). Failing here forces the implementer
// to route Submit through the same gateAndExecute helper.
test("anonymous Submit on a fourth new slug opens the wall before engine execution", async ({
    page,
}) => {
    for (const slug of SLUGS.slice(0, 3)) {
        await page.goto(`/practice/${slug}`)
        const runButton = await waitForRun(page)
        await runButton.click()
        await expect(page.getByRole("table").first()).toBeVisible({
            timeout: 60_000,
        })
    }

    await page.goto(`/practice/${SLUGS[3]}`)
    await waitForRun(page)
    await page.keyboard.press(
        process.platform === "darwin" ? "Meta+Shift+Enter" : "Control+Shift+Enter"
    )

    await expect(page.getByTestId("anon-trial-modal")).toBeVisible()
    await expect(page.getByRole("table").first()).toBeHidden()
})
```

- [ ] **Step 2: Run the e2e tests to verify they fail**

Run:

```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run build
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' E2E_PORT=3100 npx playwright test tests/e2e/anon-gate.spec.ts -g "anonymous"
```

Expected: all three "anonymous ..." tests FAIL — the chip, modal wiring, Run gate, and Submit gate do not exist yet. The Submit-bypass case in particular must fail with the result table becoming visible (the current `SqlPlayground.handleSubmit` runs the engine before calling `onSubmit`).

- [ ] **Step 3: Add lock support to the editor header Run button**

Modify `components/sql/SqlEditor.tsx`:

```tsx
import { Database, Lock, Play } from "lucide-react"
```

Add the prop:

```tsx
trialLocked?: boolean
```

Use it in the component:

```tsx
trialLocked = false,
```

Inside the header Run button:

```tsx
{trialLocked ? (
    <Lock className="h-3 w-3" />
) : (
    <Play className="h-3 w-3 fill-current" />
)}
{running ? "Running..." : "Run"}
```

- [ ] **Step 4: Add gate props and local state to SqlPlayground**

Modify `components/sql/SqlPlayground.tsx` imports:

```tsx
import { CheckCircle2, Loader2, Lock, Play, RotateCcw, Send } from "lucide-react"
import { track } from "@vercel/analytics"
import { validateRunQuery } from "@/actions/runtime"
import {
    MAX_FREE_PROBLEMS,
    type AnonGateIntent,
    type TrialExhaustedEvent,
} from "@/lib/anon-gate-constants"
import {
    readAnonStartedSlugs,
    writeAnonStartedSlugs,
} from "@/lib/anon-gate-client"
```

Extend props:

```tsx
    isSignedIn?: boolean
    onTrialExhausted?: (event: TrialExhaustedEvent) => void
```

Default props:

```tsx
    isSignedIn = false,
    onTrialExhausted,
```

Add state near the other state declarations:

```tsx
    const [startedSlugs, setStartedSlugs] = useState<string[]>([])

    useEffect(() => {
        if (isSignedIn) {
            setStartedSlugs([])
            return
        }
        setStartedSlugs(readAnonStartedSlugs())
    }, [isSignedIn, problemSlug])
```

- [ ] **Step 5: Add `gateAndExecute` before `handleRun`**

In `components/sql/SqlPlayground.tsx`, add:

```tsx
    const currentSlug = problemSlug ?? null
    const currentStarted = currentSlug
        ? startedSlugs.includes(currentSlug)
        : false
    const trialLocked =
        Boolean(currentSlug) &&
        !isSignedIn &&
        !currentStarted &&
        startedSlugs.length >= MAX_FREE_PROBLEMS
    const showTrialChip =
        Boolean(currentSlug) && !isSignedIn && !currentStarted && !trialLocked
    const remainingTrials = Math.max(
        0,
        MAX_FREE_PROBLEMS - startedSlugs.length
    )

    async function gateAndExecute(
        intent: AnonGateIntent,
        options: SqlQueryOptions
    ): Promise<SqlQueryResult | null> {
        // Defense-in-depth: reject obviously malformed slugs at the caller
        // boundary so buildNextCounter's "invalid-slug" path never reaches
        // onTrialExhausted (which would open the wrong modal).
        if (currentSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(currentSlug)) {
            return null
        }

        if (!currentSlug || isSignedIn || currentStarted) {
            return runQuery(queryRef.current, options)
        }

        // Read localStorage directly instead of relying on the `startedSlugs`
        // useState. This is intentional: another tab may have appended a slug
        // since the last render, and we want the freshest count for the
        // preflight check. The chip/lock UI uses `startedSlugs` from
        // useState, so a brief inconsistency between chip text and gate
        // behavior is possible (chip lags by one render) — that is
        // acceptable for a soft conversion nudge. DO NOT collapse this
        // re-read to a single-source model without thinking through the
        // multi-tab staleness story.
        const localStarted = readAnonStartedSlugs()
        if (
            !localStarted.includes(currentSlug) &&
            localStarted.length >= MAX_FREE_PROBLEMS
        ) {
            setStartedSlugs(localStarted)
            onTrialExhausted?.({
                slug: currentSlug,
                reason: "trial-exhausted",
                intent,
            })
            return null
        }

        const gate = await validateRunQuery({ slug: currentSlug })
        if (!gate.ok) {
            onTrialExhausted?.({
                slug: currentSlug,
                reason: gate.reason,
                intent,
            })
            return null
        }

        if (gate.consumedNewSlot) {
            const nextStarted = writeAnonStartedSlugs(gate.startedSlugs)
            setStartedSlugs(nextStarted)
            track("anon_trial_consumed", {
                slug: currentSlug,
                attemptedFrom: intent,
                totalStarted: nextStarted.length,
            })
        }

        return runQuery(queryRef.current, options)
    }
```

- [ ] **Step 6: Route Run and Submit through the gate without clearing results before the gate**

In `handleRun`, replace the direct `runQuery` call:

```tsx
            const result = await gateAndExecute("run", {
                rowCap: DEFAULT_DISPLAY_ROW_CAP,
                timeoutMs: queryTimeoutMs,
            })
            if (!result) return
            setError(null)
            setQueryResult(null)
            setValidation(null)
            setTab("results")
            setQueryResult(result)
            setHasRunOnce(true)
```

In `handleSubmit`, replace the direct `runQuery` call:

```tsx
            const result = await gateAndExecute("submit", {
                rowCap: cap,
                timeoutMs: queryTimeoutMs,
            })
            if (!result) return
            setValidation(null)
            setError(null)
            setQueryResult(
                limitQueryResultForDisplay(result, DEFAULT_DISPLAY_ROW_CAP)
            )
            setHasRunOnce(true)
```

Keep the existing truncation and `onSubmit(result.rows)` logic after this block.

- [ ] **Step 7: Render the chip and lock cues**

Pass `trialLocked` into `SqlEditor`:

```tsx
<SqlEditor
    value={query}
    onChange={(v) => setQuery(v || "")}
    onRun={handleRun}
    onSubmit={showSubmit ? handleSubmit : undefined}
    running={loading}
    runDisabled={runDisabled}
    trialLocked={trialLocked}
    dialect={dialect}
    allowedDialects={allowedDialects}
    onDialectChange={onDialectChange}
/>
```

Render the chip before the footer Run button:

```tsx
<span
    className={cn(
        "hidden min-w-[7.5rem] justify-center rounded-md border px-2 py-1 text-xs font-medium sm:inline-flex",
        showTrialChip
            ? remainingTrials === 1
                ? "border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-300"
                : "border-border bg-surface text-muted-foreground"
            : "invisible border-transparent"
    )}
>
    {showTrialChip
        ? remainingTrials === MAX_FREE_PROBLEMS
            ? "3 free runs"
            : `${remainingTrials} free run${remainingTrials === 1 ? "" : "s"} left`
        : "3 free runs"}
</span>
```

In the footer Run button icon:

```tsx
{trialLocked ? (
    <Lock className="h-3.5 w-3.5" />
) : (
    <Play className="h-3.5 w-3.5" />
)}
Run
```

- [ ] **Step 8: Wire the modal from ProblemClient**

Modify `components/practice/ProblemClient.tsx` imports:

```tsx
import { SignInModal } from "@/components/auth/SignInModal"
import type { TrialExhaustedEvent } from "@/lib/anon-gate-constants"
```

Add state:

```tsx
    const [trialWall, setTrialWall] = useState<TrialExhaustedEvent | null>(null)
```

Pass props:

```tsx
<SqlPlayground
    dbReady={dbReady}
    dbError={dbError}
    dbRecovering={dbRecovering}
    runQuery={runQuery}
    queryTimeoutMs={queryTimeoutMs}
    initialSchema={schemaSql ?? undefined}
    problemSlug={slug}
    query={query}
    onQueryChange={setQuery}
    onSubmit={handleSubmit}
    onReset={resetDraft}
    validateRowCap={computeValidateRowCap(expectedRows?.length)}
    dialect={dialect}
    allowedDialects={allowedDialects}
    onDialectChange={handleDialectChange}
    isSignedIn={isSignedIn}
    onTrialExhausted={setTrialWall}
/>
<SignInModal
    open={trialWall !== null}
    slug={trialWall?.slug ?? null}
    attemptedFrom={trialWall?.intent ?? null}
    onClose={() => setTrialWall(null)}
/>
```

- [ ] **Step 9: Run focused checks**

Run:

```bash
npx tsc --noEmit -p .
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run build
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' E2E_PORT=3100 npx playwright test tests/e2e/anon-gate.spec.ts -g "anonymous"
```

Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add components/sql/SqlEditor.tsx components/sql/SqlPlayground.tsx components/practice/ProblemClient.tsx tests/e2e/anon-gate.spec.ts
git commit -m "feat(workspace): gate anonymous run and submit actions"
```

---

### Task 6: Already-Started Submit Regression Coverage

**Files:**
- Modify: `tests/e2e/anon-gate.spec.ts`

The Submit *bypass* case (4th new slug via Cmd/Ctrl+Shift+Enter) is now a failing test inside Task 5, so the implementer is forced to gate Submit before they can mark Task 5 complete. This task covers the **other** Submit case: pressing Submit on an *already-started* slug should still execute the engine locally and surface the existing `validateSubmission` server-side error ("Sign in to submit..."). The new gate must not regress that path.

- [ ] **Step 1: Add the failing regression test**

Append to `tests/e2e/anon-gate.spec.ts`:

```ts
test("anonymous Submit on an already-started slug still reaches validation auth gate", async ({
    page,
}) => {
    await page.goto("/practice/simple-select")
    const runButton = await waitForRun(page)
    await runButton.click()
    await expect(page.getByRole("table").first()).toBeVisible({
        timeout: 60_000,
    })

    await page.keyboard.press(
        process.platform === "darwin" ? "Meta+Shift+Enter" : "Control+Shift+Enter"
    )

    await expect(
        page.getByText(/sign in to submit your solution/i)
    ).toBeVisible({ timeout: 60_000 })
    await expect(page.getByTestId("anon-trial-modal")).toBeHidden()
})
```

- [ ] **Step 2: Run the regression test**

Run:

```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run build
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' E2E_PORT=3100 npx playwright test tests/e2e/anon-gate.spec.ts -g "already-started slug still reaches"
```

Expected: PASS. The slug is already-started (added by the Run click on line above), so `gateAndExecute("submit", ...)` returns `ok: true, consumedNewSlot: false` and falls through to the existing `onSubmit` → `validateSubmission` path which yields the auth-gate message. If this fails by showing the `anon-trial-modal` instead of the validation message, the gate is incorrectly counting re-Submits on already-started slugs as new consumption — fix `gateAndExecute` to only consume a slot when the slug is genuinely new.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/anon-gate.spec.ts
git commit -m "test(workspace): regression coverage for already-started Submit"
```

---

### Task 7: Full Reset Cycle And Navbar Regression Coverage

**Files:**
- Modify: `tests/e2e/anon-gate.spec.ts`

- [ ] **Step 1: Add reset-cycle and Navbar regression tests**

Append to `tests/e2e/anon-gate.spec.ts`:

```ts
test("sign-in remount clears trial state and sign-out starts a fresh anonymous trial", async ({
    page,
    context,
}) => {
    const user = await seedUser({ email: USER_EMAIL, name: "Anon Gate E2E" })

    for (const slug of SLUGS.slice(0, 3)) {
        await page.goto(`/practice/${slug}`)
        const runButton = await waitForRun(page)
        await runButton.click()
        await expect(page.getByRole("table").first()).toBeVisible({
            timeout: 60_000,
        })
    }

    await context.addCookies([sessionCookie(user.sessionToken, BASE_URL)])
    await page.goto("/practice/customers-by-country")

    await expect
        .poll(() => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY), {
            timeout: 15_000,
        })
        .toBe(null)

    await context.clearCookies()
    // After sign-out, localStorage is empty (cleared on the signed-in mount)
    // so any seeded slug should appear as fresh. Reuse SLUGS[0] rather than
    // inventing a slug name that may not be in the seed data.
    await page.goto(`/practice/${SLUGS[0]}`)
    await expect(page.getByText("3 free runs")).toBeVisible({ timeout: 60_000 })
    const runButton = await waitForRun(page)
    await runButton.click()
    await expect(page.getByRole("table").first()).toBeVisible({
        timeout: 60_000,
    })
})

test("Navbar stays a server component boundary", async () => {
    const fs = await import("node:fs/promises")
    const path = await import("node:path")
    // Resolve from the repo root so the test works regardless of where
    // Playwright is invoked from.
    const navbarPath = path.resolve(process.cwd(), "components/layout/Navbar.tsx")
    const source = await fs.readFile(navbarPath, "utf8")

    expect(source).not.toContain('"use client"')
    expect(source).not.toContain("'use client'")
    expect(source).toContain('import { auth } from "@/lib/auth"')
    expect(source).toContain('import { prisma } from "@/lib/prisma"')
    expect(source).not.toContain("useSession")
})
```

- [ ] **Step 2: Run the focused regression tests**

Run:

```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run build
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' E2E_PORT=3100 npx playwright test tests/e2e/anon-gate.spec.ts -g "sign-in remount|Navbar"
```

Expected: PASS.

- [ ] **Step 3: Run the full anon-gate e2e suite**

Run:

```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' E2E_PORT=3100 npx playwright test tests/e2e/anon-gate.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/anon-gate.spec.ts
git commit -m "test(workspace): cover anonymous gate reset cycle"
```

---

### Task 8: Final Verification And PR Prep

**Files:**
- Review all files changed in Tasks 1-7.

- [ ] **Step 1: Run the required verification commands**

Run:

```bash
npm run test:anon-gate
npx tsc --noEmit -p .
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run build
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' E2E_PORT=3100 npx playwright test tests/e2e/anon-gate.spec.ts
git diff --check
```

Expected:
- `test:anon-gate` passes.
- `tsc` exits 0.
- `npm run build` exits 0 using `next build --webpack`.
- `anon-gate.spec.ts` passes.
- `git diff --check` prints no whitespace errors.

- [ ] **Step 2: Manually inspect the changed boundaries**

Run:

```bash
git diff --stat origin/main...HEAD
git diff -- components/layout/Navbar.tsx app/layout.tsx components/sql/SqlPlayground.tsx actions/runtime.ts
```

Expected:
- `components/layout/Navbar.tsx` is unchanged.
- `app/layout.tsx` reuses its existing `auth()` call to derive `isSignedIn` and passes it as a prop to `<AnonStorageReset isSignedIn={isSignedIn} />`. It does **not** add a second `auth()` call solely for this feature.
- `components/sql/SqlPlayground.tsx` gates only `handleRun` and `handleSubmit`, not the shared `runQuery` from `useProblemDB`.
- `actions/runtime.ts` is the only place that writes or deletes `dl_anon_started`.

- [ ] **Step 3: Commit any final fixes**

If Step 1 or Step 2 required changes:

```bash
git add .env.example app/layout.tsx app/privacy/page.tsx actions/runtime.ts components/auth/AnonStorageReset.tsx components/auth/ProviderSignInActions.tsx components/auth/SignInModal.tsx components/practice/ProblemClient.tsx components/sql/SqlEditor.tsx components/sql/SqlPlayground.tsx lib/anon-gate-constants.ts lib/anon-gate-client.ts lib/anon-gate.ts package.json scripts/test-anon-gate.ts tests/e2e/anon-gate.spec.ts
git commit -m "fix(workspace): polish anonymous gate implementation"
```

If no changes were required, do not create an empty commit.

- [ ] **Step 4: Open or update the implementation PR**

If implementing on a new branch:

```bash
git push -u origin feat/anonymous-access-gating
gh pr create --base main --title "feat(workspace): gate anonymous practice after three problems" --body "$(cat <<'EOF'
## Summary

Adds a soft anonymous free-trial gate for practice workspaces: three free problem starts per browser, then a sign-in wall before Run or Submit can execute on a new slug.

## Type of change

- [x] feat - new user-visible feature
- [ ] fix - bug fix
- [ ] sec - security fix or hardening
- [ ] perf - performance, no behavior change
- [ ] refactor - internal restructure, no behavior change
- [ ] docs - documentation only
- [ ] test - tests only
- [ ] chore - repo housekeeping, deps, configs
- [ ] ci - GitHub Actions, CI tooling
- [ ] build - bundler, package manifests, deploy config

## Verified

- npm run test:anon-gate
- npx tsc --noEmit -p .
- DATABASE_URL=$DATABASE_URL npm run build
- DATABASE_URL=$DATABASE_URL E2E_PORT=3100 npx playwright test tests/e2e/anon-gate.spec.ts
- git diff --check

## Not yet verified

- Vercel preview manual smoke: anon problems 1-3, fourth-problem modal, GitHub sign-in return, and Googlebot curl.

## Screenshots / recordings

Required before merge: trial chip and sign-in modal screenshots from Vercel preview.

## Pre-merge checklist

- [x] Branch name follows `<type>/<description>` convention
- [x] PR title is conventional and reads as the final commit message
- [x] Pre-commit / pre-push hooks ran (no `--no-verify`)
- [x] No leftover `console.log`, `debugger`, or unlinked follow-up comments
- [ ] Preview deploy verified (link auto-commented once Vercel is wired up)
- [ ] CI is green or expected to be by merge time
EOF
)"
```

If adding implementation commits to an existing PR, update the PR title/body so it no longer describes a docs-only change.

- [ ] **Step 5: Vercel preview smoke**

After Vercel produces a preview URL, run:

```bash
PREVIEW_URL="$(gh pr view --json statusCheckRollup -q '.statusCheckRollup[] | select(.context=="Vercel") | .targetUrl')"
curl -A Googlebot "${PREVIEW_URL%/}/practice/simple-select" | rg -n "Simple Select|users|3 free runs|anon-trial-modal"
```

Expected:
- The HTML contains the problem title and schema text.
- The modal is not open in the initial HTML.

Then manually in Chrome:
- Anonymous problem 1 Run works and chip decreases.
- Anonymous problems 2 and 3 Run work.
- Anonymous problem 4 Run opens the modal and does not render a result table.
- GitHub sign-in returns to the same problem and Run works.

---

## Self-Review

**Spec coverage:** This plan covers the pure HMAC helper, runtime actions, localStorage/cookie reset, modal, Run/Submit gate boundary, chip/lock UI, telemetry, privacy/env docs, e2e regressions, Navbar boundary, and preview smoke checks.

**Placeholder scan:** The plan contains no open implementation placeholders. Every task names exact files, commands, expected outcomes, and concrete code blocks.

**Type consistency:** Shared types are defined in `lib/anon-gate-constants.ts`; server-only functions live in `lib/anon-gate.ts`; client components import client-safe helpers from `lib/anon-gate-client.ts`; `TrialExhaustedEvent.intent` matches `AnonGateIntent` and the telemetry property `attemptedFrom`.
