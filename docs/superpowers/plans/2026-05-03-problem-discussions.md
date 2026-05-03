# Problem Discussions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add problem-level discussions with one-level replies, voting, reports, DB-backed spam controls, admin moderation, moderator permissions, and per-problem discussion modes.

**Architecture:** Add the discussion domain as a bounded slice: Prisma models and settings first, then server-side permission/rate-limit helpers, then API routes, then learner/admin UI. Public discussion reads stay under `/api/problems/[slug]/discussion`; privileged moderation routes stay under `/api/admin/discussions`; role and permission gates are enforced in middleware, page guards, and route handlers.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 7/Postgres, NextAuth/Auth.js v5, Zod 4, react-markdown/remark-gfm/react-syntax-highlighter, Tailwind CSS v4 tokens, Playwright e2e tests, `tsx` script-level helper tests.

---

## File Structure

- Modify `prisma/schema.prisma`: add discussion models/enums, `MODERATOR` role, and relations.
- Create `prisma/migrations/<timestamp>_add_problem_discussions/migration.sql`: additive Postgres migration with enums, tables, indexes, and singleton settings seed.
- Modify `types/next-auth.d.ts`: include `MODERATOR`.
- Modify `lib/auth.ts`: session callback continues exposing role, now with the new enum value.
- Modify `lib/admin-validation.ts`: add pure Zod validators for discussion settings, moderator permissions, and role update including `MODERATOR`.
- Create `lib/discussions/constants.ts`: shared enum arrays, defaults, permission labels, and tier keys.
- Create `lib/discussions/settings.ts`: server-only settings load/upsert helpers.
- Create `lib/discussions/reputation.ts`: server-only reputation scoring and tier selection.
- Create `lib/discussions/rate-limit.ts`: server-only spam control checks.
- Create `lib/discussions/permissions.ts`: server-only moderator permission helpers.
- Create `lib/discussions/api-auth.ts`: same-origin session guards for discussion writes and moderator/admin APIs.
- Create `lib/discussions/queries.ts`: discussion response shaping and sorting helpers.
- Create `components/markdown/MarkdownRenderer.tsx`: shared safe Markdown renderer.
- Modify `components/admin/MarkdownPreview.tsx`: reuse the shared safe renderer.
- Create learner UI under `components/practice/discussion/`: `DiscussionPanel.tsx`, `DiscussionComposer.tsx`, `DiscussionThread.tsx`, `DiscussionComment.tsx`, `DiscussionVoteButtons.tsx`, `DiscussionSortSelect.tsx`.
- Modify `components/practice/ProblemPanel.tsx`: add the `Discussion` tab, pass mode and sign-in state, and handle share-prefill from history.
- Modify `components/practice/HistoryPanel.tsx`: add `Share approach` for accepted submissions.
- Modify `components/practice/ProblemClient.tsx`: carry discussion shell props and accepted-solution share state.
- Modify `app/practice/[slug]/page.tsx`: fetch discussion shell state and pass `isSignedIn`.
- Create public API routes under `app/api/problems/[slug]/discussion/`.
- Create admin API routes under `app/api/admin/discussions/` and `app/api/admin/moderators/`.
- Modify `middleware.ts`: allow `MODERATOR` only for discussion moderation admin paths; continue blocking other admin paths.
- Modify `app/admin/layout.tsx` and `components/admin/AdminNav.tsx`: allow moderators into the admin shell but only show permitted discussion links.
- Create `lib/admin-page-auth.ts`: page-level admin/moderator guards to preserve defense in depth after moderators enter the admin shell.
- Modify existing admin page files to call `requireAdminPage()` before database work.
- Create admin UI under `components/admin/discussions/` plus pages `/admin/discussions`, `/admin/discussions/settings`, and `/admin/moderators`.
- Modify `components/admin/ProblemForm.tsx` and `app/admin/problems/[slug]/edit/page.tsx`: add discussion mode control for existing problems.
- Add tests in `scripts/test-discussion-helpers.ts`, `tests/e2e/discussions.spec.ts`, and `tests/e2e/moderators.spec.ts`.

## Task 1: Schema And Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260503120000_add_problem_discussions/migration.sql`
- Modify: `types/next-auth.d.ts`

- [ ] **Step 1: Update Prisma schema**

Add `MODERATOR` to `UserRole`, add reverse relations to `User` and `SQLProblem`, and append the discussion models/enums after `DailyProblem`. Use named relations where a model points to `User` more than once.

```prisma
enum UserRole {
  USER
  CONTRIBUTOR
  MODERATOR
  ADMIN
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  role          UserRole  @default(USER)
  accounts      Account[]
  sessions      Session[]
  submissions   Submission[]
  apiKeys       ApiKey[]
  reports       ProblemReport[]
  articles      Article[]
  lists         ProblemList[]
  discussionComments DiscussionComment[] @relation("DiscussionCommentAuthor")
  discussionVotes DiscussionVote[]
  discussionReports DiscussionReport[] @relation("DiscussionReportReporter")
  resolvedDiscussionReports DiscussionReport[] @relation("DiscussionReportResolver")
  hiddenDiscussionComments DiscussionComment[] @relation("DiscussionCommentHiddenBy")
  reputationEvents UserReputationEvent[]
  moderatorPermissions ModeratorPermission[] @relation("ModeratorPermissionUser")
  grantedModeratorPermissions ModeratorPermission[] @relation("ModeratorPermissionGranter")
  moderationActions DiscussionModerationLog[] @relation("DiscussionModerationActor")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model SQLProblem {
  // keep existing fields
  discussionComments DiscussionComment[]
  discussionState ProblemDiscussionState?
}
```

Append:

```prisma
enum DiscussionCommentStatus {
  VISIBLE
  HIDDEN
  DELETED
  SPAM
}

enum DiscussionVoteValue {
  UP
  DOWN
}

enum DiscussionReportReason {
  SPAM
  ABUSE
  SPOILER
  OFF_TOPIC
  OTHER
}

enum DiscussionReportStatus {
  OPEN
  DISMISSED
  CONFIRMED
}

enum ProblemDiscussionMode {
  OPEN
  LOCKED
  HIDDEN
}

enum UserReputationEventKind {
  ACCEPTED_SOLVE
  COMMENT_UPVOTE_RECEIVED
  COMMENT_DOWNVOTE_RECEIVED
  COMMENT_HIDDEN
  COMMENT_SPAM_CONFIRMED
  ACCOUNT_AGE_BONUS
}

enum ModeratorPermissionKey {
  VIEW_DISCUSSION_QUEUE
  HIDE_COMMENT
  RESTORE_COMMENT
  DISMISS_REPORT
  MARK_SPAM
  LOCK_PROBLEM_DISCUSSION
  HIDE_PROBLEM_DISCUSSION
}

enum DiscussionModerationActionKind {
  HIDE_COMMENT
  RESTORE_COMMENT
  DISMISS_REPORT
  MARK_SPAM
  SET_PROBLEM_MODE
  UPDATE_SETTINGS
  GRANT_MODERATOR_PERMISSION
  REVOKE_MODERATOR_PERMISSION
}
```

Add models:

```prisma
model DiscussionComment {
  id          String                  @id @default(cuid())
  problemId   String
  problem     SQLProblem              @relation(fields: [problemId], references: [id], onDelete: Cascade)
  userId      String
  user        User                    @relation("DiscussionCommentAuthor", fields: [userId], references: [id], onDelete: Cascade)
  parentId    String?
  parent      DiscussionComment?      @relation("DiscussionReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies     DiscussionComment[]     @relation("DiscussionReplies")
  bodyMarkdown String                 @db.Text
  status      DiscussionCommentStatus @default(VISIBLE)
  upvotes     Int                     @default(0)
  downvotes   Int                     @default(0)
  score       Int                     @default(0)
  reportCount Int                     @default(0)
  votes       DiscussionVote[]
  reports     DiscussionReport[]
  createdAt   DateTime                @default(now())
  updatedAt   DateTime                @updatedAt
  editedAt    DateTime?
  deletedAt   DateTime?
  hiddenAt    DateTime?
  hiddenById  String?
  hiddenBy    User?                   @relation("DiscussionCommentHiddenBy", fields: [hiddenById], references: [id], onDelete: SetNull)

  @@index([problemId, parentId, status, score, createdAt])
  @@index([problemId, status, createdAt])
  @@index([userId, createdAt])
  @@index([parentId, createdAt])
}

model DiscussionVote {
  commentId String
  comment   DiscussionComment @relation(fields: [commentId], references: [id], onDelete: Cascade)
  userId    String
  user      User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  value     DiscussionVoteValue
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt

  @@id([commentId, userId])
  @@index([userId, updatedAt])
}

model DiscussionReport {
  id          String                 @id @default(cuid())
  commentId   String
  comment     DiscussionComment      @relation(fields: [commentId], references: [id], onDelete: Cascade)
  userId      String
  user        User                   @relation("DiscussionReportReporter", fields: [userId], references: [id], onDelete: Cascade)
  reason      DiscussionReportReason
  message     String                 @db.Text
  status      DiscussionReportStatus @default(OPEN)
  createdAt   DateTime               @default(now())
  resolvedAt  DateTime?
  resolvedById String?
  resolvedBy  User?                  @relation("DiscussionReportResolver", fields: [resolvedById], references: [id], onDelete: SetNull)

  @@unique([commentId, userId])
  @@index([commentId, status])
  @@index([commentId, userId])
  @@index([status, createdAt])
}

model DiscussionSettings {
  id                       String   @id @default("global")
  globalEnabled            Boolean  @default(false)
  reportThreshold          Int      @default(3)
  editWindowMinutes        Int      @default(15)
  duplicateCooldownSeconds Int      @default(300)
  bodyMaxChars             Int      @default(4000)
  trustedMinReputation     Int      @default(20)
  highTrustMinReputation   Int      @default(100)
  newTopLevelPerHour       Int      @default(3)
  newRepliesPerHour        Int      @default(6)
  newPerProblemPerDay      Int      @default(5)
  newMinSecondsBetween     Int      @default(60)
  newVotesPerHour          Int      @default(20)
  trustedTopLevelPerHour   Int      @default(10)
  trustedRepliesPerHour    Int      @default(20)
  trustedPerProblemPerDay  Int      @default(15)
  trustedMinSecondsBetween Int      @default(20)
  trustedVotesPerHour      Int      @default(60)
  highTopLevelPerHour      Int      @default(30)
  highRepliesPerHour       Int      @default(60)
  highPerProblemPerDay     Int      @default(40)
  highMinSecondsBetween    Int      @default(5)
  highVotesPerHour         Int      @default(200)
  updatedAt                DateTime @updatedAt
  updatedById              String?
}

model ProblemDiscussionState {
  problemId   String                @id
  problem     SQLProblem            @relation(fields: [problemId], references: [id], onDelete: Cascade)
  mode        ProblemDiscussionMode @default(OPEN)
  updatedAt   DateTime              @updatedAt
  updatedById String?
}

model UserReputationEvent {
  id        String                  @id @default(cuid())
  userId    String
  user      User                    @relation(fields: [userId], references: [id], onDelete: Cascade)
  kind      UserReputationEventKind
  points    Int
  sourceId  String
  createdAt DateTime                @default(now())

  @@index([userId, createdAt])
  @@index([userId, kind, sourceId])
}

model ModeratorPermission {
  userId      String
  user        User                   @relation("ModeratorPermissionUser", fields: [userId], references: [id], onDelete: Cascade)
  permission  ModeratorPermissionKey
  grantedById String?
  grantedBy   User?                  @relation("ModeratorPermissionGranter", fields: [grantedById], references: [id], onDelete: SetNull)
  createdAt   DateTime               @default(now())

  @@id([userId, permission])
  @@index([userId, permission])
}

model DiscussionModerationLog {
  id        String                         @id @default(cuid())
  actorId   String?
  actor     User?                          @relation("DiscussionModerationActor", fields: [actorId], references: [id], onDelete: SetNull)
  action    DiscussionModerationActionKind
  targetType String
  targetId   String
  note       String?                       @db.Text
  createdAt  DateTime                      @default(now())

  @@index([actorId, createdAt])
  @@index([targetType, targetId, createdAt])
}
```

- [ ] **Step 2: Create migration SQL**

Run:

```bash
npx prisma migrate dev --name add_problem_discussions --create-only
```

Expected: Prisma creates a new migration folder. Replace the timestamp in this plan with the actual folder if it differs.

Ensure the generated SQL includes:

```sql
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MODERATOR';
INSERT INTO "DiscussionSettings" ("id", "globalEnabled", "reportThreshold", "editWindowMinutes", "duplicateCooldownSeconds", "bodyMaxChars", "updatedAt")
VALUES ('global', false, 3, 15, 300, 4000, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
```

- [ ] **Step 3: Regenerate Prisma client**

Run:

```bash
npx prisma generate
```

Expected: Prisma Client generates without schema errors.

- [ ] **Step 4: Update NextAuth types**

In `types/next-auth.d.ts`, change role unions to:

```ts
role: "USER" | "CONTRIBUTOR" | "MODERATOR" | "ADMIN"
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations types/next-auth.d.ts
git commit -m "feat(discussions): add discussion schema"
```

## Task 2: Validation, Constants, Settings, And Reputation Helpers

**Files:**
- Modify: `lib/admin-validation.ts`
- Create: `lib/discussions/constants.ts`
- Create: `lib/discussions/settings.ts`
- Create: `lib/discussions/reputation.ts`
- Create: `scripts/test-discussion-helpers.ts`
- Modify: `package.json`

- [ ] **Step 1: Add pure validators**

In `lib/admin-validation.ts`, keep the file Prisma-free and add:

```ts
export const ModeratorPermission = z.enum([
    "VIEW_DISCUSSION_QUEUE",
    "HIDE_COMMENT",
    "RESTORE_COMMENT",
    "DISMISS_REPORT",
    "MARK_SPAM",
    "LOCK_PROBLEM_DISCUSSION",
    "HIDE_PROBLEM_DISCUSSION",
])

export const ProblemDiscussionMode = z.enum(["OPEN", "LOCKED", "HIDDEN"])

export const DiscussionSettingsUpdateInput = z.object({
    globalEnabled: z.boolean().optional(),
    reportThreshold: z.number().int().min(1).max(100).optional(),
    editWindowMinutes: z.number().int().min(1).max(1440).optional(),
    duplicateCooldownSeconds: z.number().int().min(0).max(86_400).optional(),
    bodyMaxChars: z.number().int().min(100).max(20_000).optional(),
    trustedMinReputation: z.number().int().min(0).max(1_000_000).optional(),
    highTrustMinReputation: z.number().int().min(0).max(1_000_000).optional(),
    newTopLevelPerHour: z.number().int().min(0).max(1_000).optional(),
    newRepliesPerHour: z.number().int().min(0).max(1_000).optional(),
    newPerProblemPerDay: z.number().int().min(0).max(1_000).optional(),
    newMinSecondsBetween: z.number().int().min(0).max(86_400).optional(),
    newVotesPerHour: z.number().int().min(0).max(10_000).optional(),
    trustedTopLevelPerHour: z.number().int().min(0).max(1_000).optional(),
    trustedRepliesPerHour: z.number().int().min(0).max(1_000).optional(),
    trustedPerProblemPerDay: z.number().int().min(0).max(1_000).optional(),
    trustedMinSecondsBetween: z.number().int().min(0).max(86_400).optional(),
    trustedVotesPerHour: z.number().int().min(0).max(10_000).optional(),
    highTopLevelPerHour: z.number().int().min(0).max(1_000).optional(),
    highRepliesPerHour: z.number().int().min(0).max(1_000).optional(),
    highPerProblemPerDay: z.number().int().min(0).max(1_000).optional(),
    highMinSecondsBetween: z.number().int().min(0).max(86_400).optional(),
    highVotesPerHour: z.number().int().min(0).max(10_000).optional(),
}).refine(
    (v) =>
        v.highTrustMinReputation === undefined ||
        v.trustedMinReputation === undefined ||
        v.highTrustMinReputation >= v.trustedMinReputation,
    {
        path: ["highTrustMinReputation"],
        message: "High-trust threshold must be greater than or equal to trusted threshold.",
    }
)

export const DiscussionCommentCreateInput = z.object({
    bodyMarkdown: z.string().min(1).max(20_000),
})

export const DiscussionCommentEditInput = z.object({
    bodyMarkdown: z.string().min(1).max(20_000),
})

export const DiscussionVoteInput = z.object({
    value: z.enum(["UP", "DOWN"]).nullable(),
})

export const DiscussionReportInput = z.object({
    reason: z.enum(["SPAM", "ABUSE", "SPOILER", "OFF_TOPIC", "OTHER"]),
    message: z.string().max(2_000).default(""),
})

export const ModeratorPermissionUpdateInput = z.object({
    permissions: z.array(ModeratorPermission).max(10),
})

export const UserRoleSchema = z.enum(["USER", "CONTRIBUTOR", "MODERATOR", "ADMIN"])
```

- [ ] **Step 2: Add constants**

Create `lib/discussions/constants.ts`:

```ts
export const DISCUSSION_SETTINGS_ID = "global"

export const DISCUSSION_PERMISSIONS = [
    "VIEW_DISCUSSION_QUEUE",
    "HIDE_COMMENT",
    "RESTORE_COMMENT",
    "DISMISS_REPORT",
    "MARK_SPAM",
    "LOCK_PROBLEM_DISCUSSION",
    "HIDE_PROBLEM_DISCUSSION",
] as const

export type DiscussionPermission = (typeof DISCUSSION_PERMISSIONS)[number]

export type ReputationTier = "NEW" | "TRUSTED" | "HIGH_TRUST"

export const TIER_LABELS: Record<ReputationTier, string> = {
    NEW: "New",
    TRUSTED: "Trusted",
    HIGH_TRUST: "High trust",
}
```

- [ ] **Step 3: Add settings helper**

Create `lib/discussions/settings.ts`:

```ts
import { prisma } from "@/lib/prisma"
import { DISCUSSION_SETTINGS_ID } from "./constants"

export async function getDiscussionSettings() {
    return prisma.discussionSettings.upsert({
        where: { id: DISCUSSION_SETTINGS_ID },
        update: {},
        create: { id: DISCUSSION_SETTINGS_ID },
    })
}
```

- [ ] **Step 4: Add reputation helper**

Create `lib/discussions/reputation.ts` with pure tier logic plus server score lookup:

```ts
import { prisma } from "@/lib/prisma"
import type { DiscussionSettings } from "@prisma/client"
import type { ReputationTier } from "./constants"

export function tierForScore(score: number, settings: Pick<DiscussionSettings, "trustedMinReputation" | "highTrustMinReputation">): ReputationTier {
    if (score >= settings.highTrustMinReputation) return "HIGH_TRUST"
    if (score >= settings.trustedMinReputation) return "TRUSTED"
    return "NEW"
}

async function ensureAccountAgeEvents(userId: string, createdAt: Date) {
    const ageDays = Math.floor((Date.now() - createdAt.getTime()) / 86_400_000)
    const events: Array<{ sourceId: string; points: number }> = []
    if (ageDays >= 7) events.push({ sourceId: "account-age:7", points: 2 })
    if (ageDays >= 30) events.push({ sourceId: "account-age:30", points: 3 })
    for (const event of events) {
        const exists = await prisma.userReputationEvent.findFirst({
            where: {
                userId,
                kind: "ACCOUNT_AGE_BONUS",
                sourceId: event.sourceId,
            },
            select: { id: true },
        })
        if (!exists) {
            await prisma.userReputationEvent.create({
                data: {
                    userId,
                    kind: "ACCOUNT_AGE_BONUS",
                    points: event.points,
                    sourceId: event.sourceId,
                },
            })
        }
    }
}

export async function getUserReputation(userId: string, settings: DiscussionSettings): Promise<{ score: number; tier: ReputationTier }> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true },
    })
    if (user) await ensureAccountAgeEvents(userId, user.createdAt)
    const aggregate = await prisma.userReputationEvent.aggregate({
        where: { userId },
        _sum: { points: true },
    })
    const score = aggregate._sum.points ?? 0
    return { score, tier: tierForScore(score, settings) }
}
```

- [ ] **Step 5: Add helper tests**

Create `scripts/test-discussion-helpers.ts`:

```ts
import assert from "node:assert/strict"
import { tierForScore } from "../lib/discussions/reputation"

const settings = {
    trustedMinReputation: 20,
    highTrustMinReputation: 100,
}

assert.equal(tierForScore(0, settings), "NEW")
assert.equal(tierForScore(20, settings), "TRUSTED")
assert.equal(tierForScore(99, settings), "TRUSTED")
assert.equal(tierForScore(100, settings), "HIGH_TRUST")

console.log("discussion helper tests passed")
```

Add script:

```json
"test:discussion": "tsx scripts/test-discussion-helpers.ts"
```

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm run test:discussion
npm run lint
```

Expected: helper script prints `discussion helper tests passed`; lint passes.

Commit:

```bash
git add lib/admin-validation.ts lib/discussions scripts/test-discussion-helpers.ts package.json package-lock.json
git commit -m "feat(discussions): add settings and reputation helpers"
```

## Task 3: Auth, Permissions, And Admin Shell Safety

**Files:**
- Create: `lib/discussions/permissions.ts`
- Create: `lib/discussions/api-auth.ts`
- Create: `lib/admin-page-auth.ts`
- Modify: `middleware.ts`
- Modify: `app/admin/layout.tsx`
- Modify: existing `app/admin/**/page.tsx` pages outside `/admin/discussions` and `/admin/moderators`
- Modify: `components/admin/AdminNav.tsx`

- [ ] **Step 1: Add moderator permission helper**

Create `lib/discussions/permissions.ts`:

```ts
import { prisma } from "@/lib/prisma"
import type { ModeratorPermissionKey, UserRole } from "@prisma/client"

export async function userHasDiscussionPermission(
    user: { id: string; role: UserRole },
    permission: ModeratorPermissionKey
): Promise<boolean> {
    if (user.role === "ADMIN") return true
    if (user.role !== "MODERATOR") return false
    const row = await prisma.moderatorPermission.findUnique({
        where: { userId_permission: { userId: user.id, permission } },
        select: { userId: true },
    })
    return Boolean(row)
}

export async function listModeratorPermissions(userId: string): Promise<ModeratorPermissionKey[]> {
    const rows = await prisma.moderatorPermission.findMany({
        where: { userId },
        select: { permission: true },
        orderBy: { permission: "asc" },
    })
    return rows.map((r) => r.permission)
}
```

- [ ] **Step 2: Add same-origin session guards**

Create `lib/discussions/api-auth.ts`:

```ts
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { AuthFailure } from "@/lib/api-auth"
import { userHasDiscussionPermission } from "./permissions"
import type { ModeratorPermissionKey } from "@prisma/client"

export type SessionPrincipal = {
    userId: string
    role: "USER" | "CONTRIBUTOR" | "MODERATOR" | "ADMIN"
}

function assertSameOriginWrite(req: Request) {
    if (req.method === "GET" || req.method === "HEAD") return
    const origin = req.headers.get("origin")
    const host = req.headers.get("host")
    if (!origin || !host) {
        throw new AuthFailure(403, { error: "Missing Origin header on a write request." })
    }
    let originHost: string
    try {
        originHost = new URL(origin).host
    } catch {
        throw new AuthFailure(403, { error: "Malformed Origin header." })
    }
    if (originHost !== host) {
        throw new AuthFailure(403, { error: "Cross-origin request rejected." })
    }
}

export async function requireDiscussionUser(req: Request): Promise<SessionPrincipal> {
    assertSameOriginWrite(req)
    const session = await auth()
    if (!session?.user?.id) {
        throw new AuthFailure(401, { error: "Authentication required." })
    }
    return { userId: session.user.id, role: session.user.role }
}

export async function requireDiscussionModerator(
    req: Request,
    permission?: ModeratorPermissionKey
): Promise<SessionPrincipal> {
    const principal = await requireDiscussionUser(req)
    if (principal.role !== "ADMIN" && principal.role !== "MODERATOR") {
        throw new AuthFailure(403, { error: "Moderator access required." })
    }
    if (permission) {
        const ok = await userHasDiscussionPermission(
            { id: principal.userId, role: principal.role },
            permission
        )
        if (!ok) {
            throw new AuthFailure(403, { error: "Permission denied." })
        }
    }
    return principal
}

export function withDiscussionAuth<Args extends unknown[]>(
    handler: (req: Request, principal: SessionPrincipal, ...rest: Args) => Promise<Response>
) {
    return async (req: Request, ...rest: Args): Promise<Response> => {
        try {
            const principal = await requireDiscussionUser(req)
            return await handler(req, principal, ...rest)
        } catch (e) {
            if (e instanceof AuthFailure) return NextResponse.json(e.body, { status: e.status })
            console.error("Discussion route error:", e)
            return NextResponse.json({ error: "Internal server error." }, { status: 500 })
        }
    }
}
```

- [ ] **Step 3: Add page auth guards**

Create `lib/admin-page-auth.ts`:

```ts
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { ModeratorPermissionKey } from "@prisma/client"

export async function requireAdminPage() {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== "ADMIN") redirect("/")
    return session
}

export async function requireAdminOrModeratorPage(permission?: ModeratorPermissionKey) {
    const session = await auth()
    if (!session?.user?.id) redirect("/")
    if (session.user.role === "ADMIN") return session
    if (session.user.role !== "MODERATOR") redirect("/")
    if (!permission) return session
    const ok = await prisma.moderatorPermission.findUnique({
        where: { userId_permission: { userId: session.user.id, permission } },
        select: { userId: true },
    })
    if (!ok) redirect("/")
    return session
}
```

- [ ] **Step 4: Update middleware path policy**

In `middleware.ts`, allow `MODERATOR` only for:

```ts
const isDiscussionAdminPath =
    pathname === "/admin/discussions" ||
    pathname.startsWith("/admin/discussions/") ||
    pathname === "/api/admin/discussions" ||
    pathname.startsWith("/api/admin/discussions/")
```

Then change the role gate:

```ts
if (role !== "ADMIN") {
    if (role === "MODERATOR" && isDiscussionAdminPath) {
        return NextResponse.next()
    }
    if (isAdminApi) {
        return NextResponse.json({ error: "Admin access required." }, { status: 403 })
    }
    return NextResponse.redirect(new URL("/", req.nextUrl))
}
```

- [ ] **Step 5: Update admin layout and page guards**

Change `app/admin/layout.tsx` to allow `ADMIN` and `MODERATOR`, but keep counts role-aware:

```ts
const session = await auth()
if (!session?.user || !["ADMIN", "MODERATOR"].includes(session.user.role)) {
    redirect("/")
}
```

For every existing admin page outside discussion/moderator pages, call `await requireAdminPage()` before Prisma queries. Include at least:

```text
app/admin/page.tsx
app/admin/api-keys/page.tsx
app/admin/articles/page.tsx
app/admin/articles/new/page.tsx
app/admin/articles/[slug]/edit/page.tsx
app/admin/contributors/page.tsx
app/admin/daily/page.tsx
app/admin/problems/page.tsx
app/admin/problems/new/page.tsx
app/admin/problems/[slug]/edit/page.tsx
app/admin/reports/page.tsx
app/admin/schemas/page.tsx
app/admin/tags/page.tsx
app/admin/topics/page.tsx
app/admin/topics/[slug]/edit/page.tsx
```

Example edit:

```ts
import { requireAdminPage } from "@/lib/admin-page-auth"

export default async function AdminProblemsPage() {
    await requireAdminPage()
    // existing Prisma work
}
```

- [ ] **Step 6: Update admin navigation**

In `components/admin/AdminNav.tsx`, include `Discussions` and `Moderators`, but filter:

```ts
// props
role: "ADMIN" | "MODERATOR"
discussionQueueCount?: number

// item metadata
adminOnly?: boolean
moderatorAllowed?: boolean
```

Rules:
- `ADMIN`: see all existing admin nav plus `Discussions` and `Moderators`.
- `MODERATOR`: see only `Discussions`.

- [ ] **Step 7: Verify and commit**

Run:

```bash
npm run lint
npm run build
```

Expected: role unions compile and existing admin pages remain protected.

Commit:

```bash
git add lib/discussions/permissions.ts lib/discussions/api-auth.ts lib/admin-page-auth.ts middleware.ts app/admin components/admin/AdminNav.tsx
git commit -m "feat(discussions): add moderator access guards"
```

## Task 4: Public Discussion Query And Write APIs

**Files:**
- Create: `lib/discussions/queries.ts`
- Create: `lib/discussions/rate-limit.ts`
- Create: `app/api/problems/[slug]/discussion/route.ts`
- Create: `app/api/problems/[slug]/discussion/[commentId]/route.ts`
- Create: `app/api/problems/[slug]/discussion/[commentId]/replies/route.ts`
- Create: `app/api/problems/[slug]/discussion/[commentId]/vote/route.ts`
- Create: `app/api/problems/[slug]/discussion/[commentId]/report/route.ts`

- [ ] **Step 1: Add sorting and response shaping helper**

Create `lib/discussions/queries.ts`:

```ts
import type { Prisma } from "@prisma/client"

export type DiscussionSort = "best" | "votes" | "latest"

export function parseDiscussionSort(value: string | null): DiscussionSort {
    if (value === "votes" || value === "latest") return value
    return "best"
}

export function discussionOrderBy(sort: DiscussionSort): Prisma.DiscussionCommentOrderByWithRelationInput[] {
    if (sort === "latest") return [{ createdAt: "desc" }]
    if (sort === "votes") return [{ score: "desc" }, { createdAt: "desc" }]
    return [{ score: "desc" }, { createdAt: "desc" }]
}

export function publicCommentWhere(problemId: string): Prisma.DiscussionCommentWhereInput {
    return {
        problemId,
        parentId: null,
        status: { in: ["VISIBLE", "DELETED"] },
    }
}
```

- [ ] **Step 2: Add rate-limit helper**

Create `lib/discussions/rate-limit.ts`:

```ts
import { prisma } from "@/lib/prisma"
import type { DiscussionSettings } from "@prisma/client"
import type { ReputationTier } from "./constants"

type Action = "COMMENT" | "REPLY" | "VOTE"

function tierLimits(settings: DiscussionSettings, tier: ReputationTier) {
    if (tier === "HIGH_TRUST") {
        return {
            topLevelPerHour: settings.highTopLevelPerHour,
            repliesPerHour: settings.highRepliesPerHour,
            perProblemPerDay: settings.highPerProblemPerDay,
            minSecondsBetween: settings.highMinSecondsBetween,
            votesPerHour: settings.highVotesPerHour,
        }
    }
    if (tier === "TRUSTED") {
        return {
            topLevelPerHour: settings.trustedTopLevelPerHour,
            repliesPerHour: settings.trustedRepliesPerHour,
            perProblemPerDay: settings.trustedPerProblemPerDay,
            minSecondsBetween: settings.trustedMinSecondsBetween,
            votesPerHour: settings.trustedVotesPerHour,
        }
    }
    return {
        topLevelPerHour: settings.newTopLevelPerHour,
        repliesPerHour: settings.newRepliesPerHour,
        perProblemPerDay: settings.newPerProblemPerDay,
        minSecondsBetween: settings.newMinSecondsBetween,
        votesPerHour: settings.newVotesPerHour,
    }
}

export async function checkDiscussionLimit(input: {
    userId: string
    problemId: string
    bodyMarkdown?: string
    action: Action
    tier: ReputationTier
    settings: DiscussionSettings
}): Promise<{ ok: true } | { ok: false; error: string }> {
    const limits = tierLimits(input.settings, input.tier)
    const now = Date.now()
    const oneHourAgo = new Date(now - 60 * 60 * 1000)
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000)

    if (input.action === "VOTE") {
        const votes = await prisma.discussionVote.count({
            where: { userId: input.userId, updatedAt: { gte: oneHourAgo } },
        })
        if (votes >= limits.votesPerHour) return { ok: false, error: "Too many votes. Try again later." }
        return { ok: true }
    }

    const parentId = input.action === "REPLY" ? { not: null } : null
    const recentCount = await prisma.discussionComment.count({
        where: { userId: input.userId, parentId, createdAt: { gte: oneHourAgo } },
    })
    const hourlyLimit = input.action === "REPLY" ? limits.repliesPerHour : limits.topLevelPerHour
    if (recentCount >= hourlyLimit) return { ok: false, error: "You are posting too quickly. Try again later." }

    const problemCount = await prisma.discussionComment.count({
        where: { userId: input.userId, problemId: input.problemId, createdAt: { gte: dayAgo } },
    })
    if (problemCount >= limits.perProblemPerDay) return { ok: false, error: "Daily comment limit reached for this problem." }

    const last = await prisma.discussionComment.findFirst({
        where: { userId: input.userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, bodyMarkdown: true, problemId: true },
    })
    if (last && now - last.createdAt.getTime() < limits.minSecondsBetween * 1000) {
        return { ok: false, error: "Please wait before posting again." }
    }
    if (input.bodyMarkdown && last?.problemId === input.problemId && last.bodyMarkdown.trim() === input.bodyMarkdown.trim()) {
        const duplicateWindow = input.settings.duplicateCooldownSeconds * 1000
        if (now - last.createdAt.getTime() < duplicateWindow) {
            return { ok: false, error: "Duplicate comment. Edit your previous comment instead." }
        }
    }
    return { ok: true }
}
```

- [ ] **Step 3: Add read/create route**

Create `app/api/problems/[slug]/discussion/route.ts`:

```ts
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { DiscussionCommentCreateInput } from "@/lib/admin-validation"
import { getDiscussionSettings } from "@/lib/discussions/settings"
import { getUserReputation } from "@/lib/discussions/reputation"
import { checkDiscussionLimit } from "@/lib/discussions/rate-limit"
import { parseDiscussionSort, discussionOrderBy, publicCommentWhere } from "@/lib/discussions/queries"
import { withDiscussionAuth } from "@/lib/discussions/api-auth"

type Ctx = { params: Promise<{ slug: string }> }

export async function GET(req: Request, ctx: Ctx) {
    const { slug } = await ctx.params
    const url = new URL(req.url)
    const sort = parseDiscussionSort(url.searchParams.get("sort"))
    const take = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "20"), 1), 50)
    const page = Math.max(Number(url.searchParams.get("page") ?? "1"), 1)
    const skip = (page - 1) * take
    const [settings, session, problem] = await Promise.all([
        getDiscussionSettings(),
        auth(),
        prisma.sQLProblem.findFirst({
            where: { slug, status: "PUBLISHED" },
            select: { id: true, discussionState: true },
        }),
    ])
    if (!problem) return NextResponse.json({ found: false }, { status: 404 })
    const mode = problem.discussionState?.mode ?? "OPEN"
    if (!settings.globalEnabled || mode === "HIDDEN") {
        return NextResponse.json({ data: { enabled: false, mode, comments: [], total: 0 } })
    }
    const where = publicCommentWhere(problem.id)
    const [comments, total] = await Promise.all([
        prisma.discussionComment.findMany({
            where,
            orderBy: discussionOrderBy(sort),
            skip,
            take,
            include: {
                user: { select: { id: true, name: true, image: true } },
                replies: {
                    where: { status: { in: ["VISIBLE", "DELETED"] } },
                    orderBy: { createdAt: "asc" },
                    take: 5,
                    include: { user: { select: { id: true, name: true, image: true } } },
                },
                votes: session?.user?.id ? { where: { userId: session.user.id }, select: { value: true } } : false,
            },
        }),
        prisma.discussionComment.count({ where }),
    ])
    return NextResponse.json({ data: { enabled: true, mode, sort, page, pageSize: take, total, comments } })
}

export const POST = withDiscussionAuth(async (req, principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    const settings = await getDiscussionSettings()
    if (!settings.globalEnabled) return NextResponse.json({ error: "Discussions are disabled." }, { status: 403 })
    const body = await req.json().catch(() => null)
    const parsed = DiscussionCommentCreateInput.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Invalid comment." }, { status: 400 })
    if (parsed.data.bodyMarkdown.length > settings.bodyMaxChars) {
        return NextResponse.json({ error: `Comment must be ${settings.bodyMaxChars} characters or fewer.` }, { status: 400 })
    }
    const problem = await prisma.sQLProblem.findFirst({
        where: { slug, status: "PUBLISHED" },
        select: { id: true, discussionState: true },
    })
    if (!problem) return NextResponse.json({ error: "Problem not found." }, { status: 404 })
    if ((problem.discussionState?.mode ?? "OPEN") !== "OPEN") {
        return NextResponse.json({ error: "Discussion is locked." }, { status: 403 })
    }
    const reputation = await getUserReputation(principal.userId, settings)
    const limit = await checkDiscussionLimit({
        userId: principal.userId,
        problemId: problem.id,
        bodyMarkdown: parsed.data.bodyMarkdown,
        action: "COMMENT",
        tier: reputation.tier,
        settings,
    })
    if (!limit.ok) return NextResponse.json({ error: limit.error }, { status: 429 })
    const comment = await prisma.discussionComment.create({
        data: { problemId: problem.id, userId: principal.userId, bodyMarkdown: parsed.data.bodyMarkdown.trim() },
        include: { user: { select: { id: true, name: true, image: true } } },
    })
    return NextResponse.json({ data: comment }, { status: 201 })
})
```

- [ ] **Step 4: Add edit/delete route**

Create `app/api/problems/[slug]/discussion/[commentId]/route.ts` with:

```ts
// PATCH: require owner, status VISIBLE, createdAt within settings.editWindowMinutes, update bodyMarkdown and editedAt.
// DELETE: require owner, set status DELETED, clear bodyMarkdown to "", set deletedAt.
```

Implementation must return:

```ts
return NextResponse.json({ data: updatedComment })
```

and use `withDiscussionAuth`.

- [ ] **Step 5: Add replies route**

Create `app/api/problems/[slug]/discussion/[commentId]/replies/route.ts`:

```ts
// POST only.
// Validate parent exists, parent.parentId is null, parent.status is VISIBLE or DELETED.
// Reject if the problem mode is not OPEN.
// Reuse DiscussionCommentCreateInput and checkDiscussionLimit({ action: "REPLY" }).
// Create DiscussionComment with parentId set.
```

- [ ] **Step 6: Add vote route**

Create `app/api/problems/[slug]/discussion/[commentId]/vote/route.ts`:

```ts
// PUT with { value: "UP" | "DOWN" | null }.
// value null removes viewer vote.
// Reject voting on own comment.
// Upsert/delete DiscussionVote in a transaction.
// Recompute upvotes, downvotes, and score from DiscussionVote.
// Add UserReputationEvent for the comment author with +1 for UP, -1 for DOWN, and compensating events on switch/remove.
```

- [ ] **Step 7: Add report route**

Create `app/api/problems/[slug]/discussion/[commentId]/report/route.ts`:

```ts
// POST with reason/message.
// Unique report per user per comment.
// Increment DiscussionComment.reportCount from OPEN reports.
// Do not auto-hide.
// If open reports >= settings.reportThreshold, it appears in admin queue by query.
```

- [ ] **Step 8: Verify and commit**

Run:

```bash
npm run lint
npm run build
```

Expected: routes compile and no lint failures.

Commit:

```bash
git add lib/discussions app/api/problems
git commit -m "feat(discussions): add public discussion APIs"
```

## Task 5: Learner Discussion Tab

**Files:**
- Create: `components/markdown/MarkdownRenderer.tsx`
- Modify: `components/admin/MarkdownPreview.tsx`
- Create: `components/practice/discussion/DiscussionPanel.tsx`
- Create: `components/practice/discussion/DiscussionComposer.tsx`
- Create: `components/practice/discussion/DiscussionThread.tsx`
- Create: `components/practice/discussion/DiscussionComment.tsx`
- Create: `components/practice/discussion/DiscussionVoteButtons.tsx`
- Create: `components/practice/discussion/DiscussionSortSelect.tsx`
- Modify: `components/practice/ProblemPanel.tsx`
- Modify: `components/practice/HistoryPanel.tsx`
- Modify: `components/practice/ProblemClient.tsx`
- Modify: `app/practice/[slug]/page.tsx`

- [ ] **Step 1: Add shared Markdown renderer**

Create `components/markdown/MarkdownRenderer.tsx`:

```tsx
"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"

export function MarkdownRenderer({ content, empty = "_(empty)_" }: { content: string; empty?: string }) {
    return (
        <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-primary prose-code:font-mono prose-code:text-[0.85em] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-surface-muted prose-code:before:content-none prose-code:after:content-none prose-pre:bg-transparent prose-pre:p-0">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    code({ inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || "")
                        if (!inline && match) {
                            return (
                                <SyntaxHighlighter
                                    style={vscDarkPlus}
                                    language={match[1]}
                                    PreTag="div"
                                    customStyle={{ borderRadius: "0.5rem", fontSize: "13px", padding: "1rem", margin: "0.75rem 0", border: "1px solid hsl(var(--border))" }}
                                    {...props}
                                >
                                    {String(children).replace(/\n$/, "")}
                                </SyntaxHighlighter>
                            )
                        }
                        return <code className={className} {...props}>{children}</code>
                    },
                }}
            >
                {content || empty}
            </ReactMarkdown>
        </div>
    )
}
```

Update `components/admin/MarkdownPreview.tsx` to render `<MarkdownRenderer content={content} />`.

- [ ] **Step 2: Add discussion components**

Create a client `DiscussionPanel` that owns fetch state:

```tsx
export type DiscussionSort = "best" | "votes" | "latest"

export function DiscussionPanel({
    problemSlug,
    isSignedIn,
    mode,
    prefillMarkdown,
    onPrefillConsumed,
}: {
    problemSlug: string
    isSignedIn: boolean
    mode: "OPEN" | "LOCKED" | "HIDDEN"
    prefillMarkdown?: string | null
    onPrefillConsumed?: () => void
}) {
    // state: sort, page, loading, comments, total, error
    // GET `/api/problems/${problemSlug}/discussion?sort=${sort}&page=${page}`
    // POST comments and refresh current page
}
```

Create `DiscussionComposer` with textarea + Preview toggle:

```tsx
// Props: value, onChange, onSubmit, disabled, isSignedIn, placeholder.
// Signed-out state uses SignInDialogButton.
// Preview renders MarkdownRenderer.
```

Create `DiscussionComment` and `DiscussionThread`:

```tsx
// Comment shows avatar/name/timestamp/score/edit marker.
// Replies render one level only.
// Reply button opens an inline DiscussionComposer for that parent.
// Edit/delete buttons show only for viewer-owned comments.
```

Create `DiscussionVoteButtons`:

```tsx
// Up/down icon buttons with aria labels.
// PUT `/api/problems/${problemSlug}/discussion/${commentId}/vote`.
```

Create `DiscussionSortSelect`:

```tsx
// select values: best, votes, latest.
```

- [ ] **Step 3: Wire ProblemPanel tab**

In `components/practice/ProblemPanel.tsx`:

```ts
type Tab = "description" | "hints" | "history" | "discussion"
```

Add props:

```ts
slug: string
isSignedIn: boolean
discussionMode: "OPEN" | "LOCKED" | "HIDDEN"
discussionEnabled: boolean
discussionPrefill: string | null
onDiscussionPrefillConsumed: () => void
```

Show tab only when `discussionEnabled && discussionMode !== "HIDDEN"`.

- [ ] **Step 4: Add share approach from history**

In `components/practice/HistoryPanel.tsx`, add prop:

```ts
onShareApproach?: (code: string) => void
```

For accepted submissions with code, show:

```tsx
<button type="button" onClick={() => onShareApproach?.(s.code)} className="text-xs font-medium text-primary hover:text-primary-hover cursor-pointer">
    Share approach
</button>
```

In `ProblemPanel`, when history calls `onShareApproach`, set tab to `discussion` and set:

```ts
`Here is my approach:\n\n\`\`\`sql\n${code.trim()}\n\`\`\`\n`
```

- [ ] **Step 5: Pass discussion shell from page**

In `app/practice/[slug]/page.tsx`, query:

```ts
const [history, solvedSlugs, session, discussionSettings, discussionState] = await Promise.all([
    getProblemHistory(slug),
    getSolvedSlugs(),
    auth(),
    prisma.discussionSettings.findUnique({ where: { id: "global" } }),
    prisma.problemDiscussionState.findUnique({ where: { problemId: problem.id } }),
])
```

Pass:

```tsx
discussionEnabled={Boolean(discussionSettings?.globalEnabled)}
discussionMode={discussionState?.mode ?? "OPEN"}
isSignedIn={isSignedIn}
```

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm run lint
npm run build
```

Expected: practice page builds; Markdown renderer does not use `rehype-raw`.

Commit:

```bash
git add components/markdown components/practice app/practice
git commit -m "feat(discussions): add learner discussion tab"
```

## Task 6: Admin Moderation Queue And Settings

**Files:**
- Create: `app/admin/discussions/page.tsx`
- Create: `app/admin/discussions/settings/page.tsx`
- Create: `components/admin/discussions/DiscussionQueueClient.tsx`
- Create: `components/admin/discussions/DiscussionSettingsForm.tsx`
- Create: `app/api/admin/discussions/route.ts`
- Create: `app/api/admin/discussions/[commentId]/hide/route.ts`
- Create: `app/api/admin/discussions/[commentId]/restore/route.ts`
- Create: `app/api/admin/discussions/[commentId]/dismiss-reports/route.ts`
- Create: `app/api/admin/discussions/[commentId]/mark-spam/route.ts`
- Create: `app/api/admin/discussions/settings/route.ts`

- [ ] **Step 1: Add moderation queue page**

Create `app/admin/discussions/page.tsx`. Start with:

```ts
import { requireAdminOrModeratorPage } from "@/lib/admin-page-auth"
import { getDiscussionSettings } from "@/lib/discussions/settings"
import { prisma } from "@/lib/prisma"
```

Call:

```ts
await requireAdminOrModeratorPage("VIEW_DISCUSSION_QUEUE")
```

Query four lists:
- Needs review: `status: "VISIBLE"` and `reportCount >= settings.reportThreshold`
- Hidden: `status: "HIDDEN"`
- Dismissed reports: reports with `status: "DISMISSED"`
- Spam: `status: "SPAM"`

- [ ] **Step 2: Add moderation action APIs**

Each action route uses `requireDiscussionModerator(req, permission)`:

```ts
// hide: HIDE_COMMENT, set status HIDDEN/hiddenAt/hiddenById and write UserReputationEvent -2.
// restore: RESTORE_COMMENT, set status VISIBLE and clear hidden fields.
// dismiss-reports: DISMISS_REPORT, set OPEN reports to DISMISSED/resolvedAt/resolvedById.
// mark-spam: MARK_SPAM, set status SPAM, confirm OPEN reports, write UserReputationEvent -5.
```

Every action writes `DiscussionModerationLog`.

- [ ] **Step 3: Add settings page and API**

`app/admin/discussions/settings/page.tsx` calls `await requireAdminPage()`, loads settings, and renders `DiscussionSettingsForm`.

`app/api/admin/discussions/settings/route.ts`:
- `GET`: admin only, return settings.
- `PATCH`: admin only, validate `DiscussionSettingsUpdateInput`, update singleton row, write moderation log with action `UPDATE_SETTINGS`.

- [ ] **Step 4: Add queue client UI**

`DiscussionQueueClient` renders compact tabs and action buttons. Each row shows:
- problem title + link
- author name/email
- body preview with safe Markdown renderer
- score/report count
- latest report reason
- actions allowed by current role/permissions

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm run lint
npm run build
```

Expected: moderator queue and admin settings compile.

Commit:

```bash
git add app/admin/discussions app/api/admin/discussions components/admin/discussions
git commit -m "feat(discussions): add admin moderation queue"
```

## Task 7: Moderator Management

**Files:**
- Create: `app/admin/moderators/page.tsx`
- Create: `components/admin/ModeratorsClient.tsx`
- Create: `app/api/admin/moderators/route.ts`
- Create: `app/api/admin/moderators/[id]/route.ts`
- Modify: `app/api/admin/users/route.ts`
- Modify: `app/api/admin/users/[id]/route.ts`
- Modify: `components/admin/ContributorsClient.tsx`
- Modify: `app/admin/contributors/page.tsx`

- [ ] **Step 1: Add admin-only moderator page**

`app/admin/moderators/page.tsx` calls `await requireAdminPage()`, fetches users with role `MODERATOR`, includes permissions, and renders `ModeratorsClient`.

- [ ] **Step 2: Add moderator APIs**

`app/api/admin/moderators/route.ts`:
- `GET`: list moderators and search users by email/name.
- `POST`: admin only, body `{ userId, permissions }`, set user role to `MODERATOR`, replace permissions.

`app/api/admin/moderators/[id]/route.ts`:
- `PATCH`: replace permissions.
- `DELETE`: remove all permissions and set role back to `USER`.

Use `ModeratorPermissionUpdateInput`.

- [ ] **Step 3: Update users API role handling**

Allow `USER`, `CONTRIBUTOR`, and `MODERATOR` transitions in `/api/admin/users/[id]`; continue blocking UI changes to/from `ADMIN`. Update contributors page copy and filters to include moderators or link to `/admin/moderators`.

- [ ] **Step 4: Verify and commit**

Run:

```bash
npm run lint
npm run build
```

Expected: moderator creation and permission UI compile.

Commit:

```bash
git add app/admin/moderators app/api/admin/moderators app/api/admin/users components/admin/ModeratorsClient.tsx components/admin/ContributorsClient.tsx app/admin/contributors/page.tsx
git commit -m "feat(discussions): add moderator management"
```

## Task 8: Per-Problem Discussion Controls

**Files:**
- Modify: `components/admin/ProblemForm.tsx`
- Modify: `app/admin/problems/[slug]/edit/page.tsx`
- Modify: `app/api/admin/problems/[slug]/route.ts`
- Create: `app/api/admin/discussions/problem-mode/route.ts`

- [ ] **Step 1: Add edit-page initial state**

In `app/admin/problems/[slug]/edit/page.tsx`, include:

```ts
discussionState: true
```

Pass:

```ts
discussionMode: problem.discussionState?.mode ?? "OPEN"
```

- [ ] **Step 2: Add form control**

In `ProblemFormInitial`, add:

```ts
discussionMode?: "OPEN" | "LOCKED" | "HIDDEN"
```

In edit mode, render a `Discussion` card with a select:

```tsx
<Field label="Discussion mode" htmlFor="discussionMode" description="Open is default. Locked keeps comments visible but read-only. Hidden removes the learner-facing tab.">
    <select id="discussionMode" value={discussionMode} onChange={(e) => setDiscussionMode(e.target.value as any)}>
        <option value="OPEN">Open</option>
        <option value="LOCKED">Locked</option>
        <option value="HIDDEN">Hidden</option>
    </select>
</Field>
```

- [ ] **Step 3: Persist mode**

On edit submit, include `discussionMode` in the payload. In `app/api/admin/problems/[slug]/route.ts`, after problem update, upsert `ProblemDiscussionState` if `discussionMode` is present.

Authorization:
- Admin can set all modes.
- Moderator with `LOCK_PROBLEM_DISCUSSION` can set `LOCKED` or `OPEN`.
- Moderator with `HIDE_PROBLEM_DISCUSSION` can set `HIDDEN` or `OPEN`.

If keeping `/api/admin/problems/[slug]` admin-only, only admin form uses this path. Add `app/api/admin/discussions/problem-mode/route.ts` for moderator per-problem changes from the discussion queue.

- [ ] **Step 4: Verify and commit**

Run:

```bash
npm run lint
npm run build
```

Expected: problem edit page compiles and mode is saved.

Commit:

```bash
git add components/admin/ProblemForm.tsx app/admin/problems/[slug]/edit/page.tsx app/api/admin/problems/[slug]/route.ts app/api/admin/discussions/problem-mode/route.ts
git commit -m "feat(discussions): add problem discussion controls"
```

## Task 9: Accepted-Solve Reputation Event

**Files:**
- Modify: `actions/submissions.ts`

- [ ] **Step 1: Insert accepted-solve reputation events**

In `validateSubmission`, after a signed-in accepted submission is persisted, add:

```ts
if (result.ok) {
    const sourceId = `problem:${problem.id}`
    const exists = await prisma.userReputationEvent.findFirst({
        where: {
            userId: session.user.id,
            kind: "ACCEPTED_SOLVE",
            sourceId,
        },
        select: { id: true },
    })
    if (!exists) {
        await prisma.userReputationEvent.create({
            data: {
                userId: session.user.id,
                kind: "ACCEPTED_SOLVE",
                points: 2,
                sourceId,
            },
        })
    }
}
```

Keep this best-effort inside the existing persistence `try/catch` so validation is not blocked by reputation write failure.

- [ ] **Step 2: Verify and commit**

Run:

```bash
npm run lint
```

Expected: lint passes.

Commit:

```bash
git add actions/submissions.ts
git commit -m "feat(discussions): record accepted solve reputation"
```

## Task 10: E2E Coverage And Final Verification

**Files:**
- Create: `tests/e2e/discussions.spec.ts`
- Create: `tests/e2e/moderators.spec.ts`
- Modify: `tests/e2e/security.spec.ts`

- [ ] **Step 1: Add discussion API/UI e2e**

Create `tests/e2e/discussions.spec.ts`:

```ts
import { test, expect } from "@playwright/test"
import { deleteUser, prisma, seedUser, sessionCookie, SESSION_COOKIE_NAME } from "./fixtures/db"

const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}`
const USER_EMAIL = "e2e-discussion-user@example.test"
const ADMIN_EMAIL = "e2e-discussion-admin@example.test"

test.describe.configure({ mode: "serial" })

test.beforeAll(async () => {
    await prisma.discussionSettings.upsert({
        where: { id: "global" },
        update: { globalEnabled: true, reportThreshold: 2 },
        create: { id: "global", globalEnabled: true, reportThreshold: 2 },
    })
})

test.afterAll(async () => {
    await deleteUser(USER_EMAIL)
    await deleteUser(ADMIN_EMAIL)
    await prisma.$disconnect()
})

test("signed-in learner can post, reply, vote, and report", async ({ page }) => {
    const user = await seedUser({ email: USER_EMAIL, name: "Discussion User" })
    await page.context().addCookies([sessionCookie(user.sessionToken, BASE_URL)])
    await page.goto("/practice/simple-select")
    await page.getByRole("button", { name: /discussion/i }).click()
    await page.getByRole("textbox", { name: /comment/i }).fill("This works with `SELECT *`.")
    await page.getByRole("button", { name: /^post$/i }).click()
    await expect(page.getByText("This works with")).toBeVisible()
})
```

Add separate tests for:
- signed-out mutation opens sign-in dialog
- locked problem blocks composer
- hidden problem hides the tab
- report threshold creates admin queue entry
- share approach pre-fills SQL after accepted submission, using seeded accepted `Submission`

- [ ] **Step 2: Add moderator permission e2e**

Create `tests/e2e/moderators.spec.ts` with request-level checks:
- moderator with `VIEW_DISCUSSION_QUEUE` can access `/admin/discussions`
- moderator cannot access `/admin/problems`
- moderator without `HIDE_COMMENT` receives 403 on hide route
- admin can grant `HIDE_COMMENT`, then moderator can hide
- moderator cannot access `/admin/discussions/settings`

- [ ] **Step 3: Update security e2e**

In `tests/e2e/security.spec.ts`, add:

```ts
test("moderator cannot list admin problems API", async ({ request }) => {
    const mod = await seedUser({ email: "e2e-mod-blocked@example.test", role: "MODERATOR" })
    try {
        const res = await request.get("/api/admin/problems", {
            headers: { Cookie: `${SESSION_COOKIE_NAME}=${mod.sessionToken}` },
            failOnStatusCode: false,
        })
        expect(res.status()).toBe(403)
    } finally {
        await deleteUser("e2e-mod-blocked@example.test")
    }
})
```

- [ ] **Step 4: Full verification**

Run:

```bash
npm run test:discussion
npm run lint
npm run build
npm run test:e2e -- tests/e2e/discussions.spec.ts tests/e2e/moderators.spec.ts tests/e2e/security.spec.ts
```

Expected:
- helper script passes
- lint passes
- `next build --webpack` passes
- targeted Playwright tests pass

- [ ] **Step 5: Final commit**

```bash
git add tests/e2e/discussions.spec.ts tests/e2e/moderators.spec.ts tests/e2e/security.spec.ts
git commit -m "test(discussions): cover discussion and moderator flows"
```

## Self-Review Checklist

- Spec coverage:
  - Discussion tab, comments, one-level replies, voting, reports, pagination, and sorting are covered by Tasks 4 and 5.
  - DB-backed global settings, per-tier limits, cooldowns, duplicate checks, and report threshold are covered by Tasks 1, 2, 4, and 6.
  - Admin moderation queue and settings are covered by Task 6.
  - `MODERATOR` role with admin-assigned permissions is covered by Tasks 3 and 7.
  - Per-problem `OPEN`, `LOCKED`, `HIDDEN` controls are covered by Task 8.
  - Markdown preview and fenced code blocks are covered by Task 5.
  - Accepted solution share is covered by Task 5.
  - Accepted-solve reputation is covered by Task 9.
  - Security boundaries are covered by Tasks 3 and 10.
- Red-flag scan: no unresolved placeholder terms or deferred implementation notes should remain.
- Type consistency:
  - Role union is `USER | CONTRIBUTOR | MODERATOR | ADMIN`.
  - Moderator permission enum is `ModeratorPermissionKey`.
  - Per-problem mode enum is `ProblemDiscussionMode` with `OPEN | LOCKED | HIDDEN`.
  - Public sort values are `best | votes | latest`.
