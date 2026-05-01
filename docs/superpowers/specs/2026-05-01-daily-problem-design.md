# Daily Problem v1 Design

> Date: 2026-05-01
> Status: Approved design
> Scope: Compact v1 — daily schedule, auto-fill fallback, admin override, learner entry points

## Goal

Add a lightweight Daily Problem retention loop without introducing a second streak system. Every day has one stable problem. Admins can control the schedule, and the platform auto-fills any missing day so the feature keeps working even when no manual schedule exists.

## Non-Goals

- No separate daily streak counter in v1. The existing activity streak remains the only streak, and Daily Problem submissions naturally contribute to it.
- No email notifications, badges, push notifications, or calendar reminders.
- No dedicated `/daily` landing page. `/daily` resolves today's problem and redirects to the normal practice workspace.
- No support for unpublished problems. Daily choices must be published learner-facing problems.

## Data Model

Add a `DailyProblem` model:

```prisma
model DailyProblem {
  id        String             @id @default(cuid())
  date      DateTime           @unique @db.Date
  problemId String
  problem   SQLProblem         @relation(fields: [problemId], references: [id], onDelete: Restrict)
  source    DailyProblemSource @default(AUTO)
  createdAt DateTime           @default(now())
  updatedAt DateTime           @updatedAt

  @@index([problemId])
}

enum DailyProblemSource {
  AUTO
  MANUAL
}
```

`date` is stored as a Postgres `DATE` via `@db.Date`. Code should still normalize inputs to UTC midnight before querying or writing so TypeScript `Date` values are stable, but the database column enforces one row per calendar date. The user-facing label can render in local time, but the canonical daily key is UTC.

`onDelete: Restrict` prevents deleting a problem that has already been assigned as a daily. Archiving remains allowed because the relationship stays intact and historical daily links should not break.

## Selection Rules

When resolving a date:

1. Normalize the requested date to UTC midnight.
2. Return the existing `DailyProblem` row if one exists.
3. If no row exists, auto-pick a problem and create a row with `source = AUTO`.
4. Return the created row.

Admin-created rows always win because they already exist before auto-fill runs. Admins can replace an auto row with a manual choice.

The auto-pick candidate set is `SQLProblem.status = PUBLISHED`. The ordering is:

1. Least recently used as a daily.
2. Lowest `SQLProblem.number` as the tie-breaker.

Problems never used as a daily sort before previously used problems. This gives a broad rotation while keeping deterministic behavior.

The create path should run in a transaction or use a unique-date upsert pattern so concurrent requests for the same day cannot create duplicate rows. The database `@unique` constraint on `date` is the final guard.

## Learner Surfaces

### `/daily`

`/daily` is a server route/page that resolves today's `DailyProblem` row and redirects to `/practice/[slug]`.

If no published problems exist, show a simple not-found or empty state instead of throwing.

### Homepage / UserHome

Add a Daily Problem card to the signed-in homepage/dashboard:

- problem number, title, difficulty, and tags if already available in the surrounding query
- "Start daily" when the user has not accepted today's problem
- "Review daily" or equivalent when the user already solved it today
- solved state is based on an accepted `Submission` for the current user and today's daily `problemId`

For anonymous users, the public homepage can show the daily problem as a normal CTA if the data is cheap to fetch, but this is optional for v1. The signed-in dashboard is the required surface.

### User Menu

Add a "Daily problem" entry to `UserMenu` linking to `/daily`. If the current user has accepted today's daily problem, show a small completed state using existing menu styling.

## Admin Surface

Add `/admin/daily`.

The page shows a compact table of recent and upcoming daily rows:

- date
- problem number and title
- source (`AUTO` or `MANUAL`)
- updated timestamp
- action to set or replace the problem for that date

Admin controls:

- choose a date
- search/select a published problem
- save as `MANUAL`
- override an existing `AUTO` row
- replace an existing `MANUAL` row when needed

The admin surface does not need drag-and-drop or a full calendar in v1. A table with date input and problem picker is enough.

## Server Boundaries

Add a small daily module, likely `actions/daily.ts` or `lib/daily.ts` plus server actions, with focused responsibilities:

- `normalizeDailyDate(date?: Date): Date`
- `getOrCreateDailyProblem(date?: Date)`
- `getDailyStatusForUser(userId, date?: Date)`
- `setManualDailyProblem(date, problemId)` for admin use
- `listDailyProblems(range)` for the admin table

Keep pure date/selection helpers testable without Prisma where practical. Prisma-backed functions can be covered through e2e or focused integration tests if the existing test setup supports it.

## Existing Streak Interaction

Do not add daily-specific streak fields or profile UI in v1.

Daily submissions write normal `Submission` rows through the existing validation flow. That means the existing activity heatmap and activity streak continue to work unchanged. The Daily Problem UI only needs "solved today" state, not "daily streak" state.

## Error Handling

- If no published problems exist, `/daily` and the homepage card render an empty state.
- If an admin selects a non-published problem, reject the save with a validation error.
- If two requests auto-fill the same date concurrently, one wins; the loser re-reads the existing row.
- If today's daily points to a problem that is later archived, keep the historical row valid. `/daily` should still redirect for that date if the problem route can render archived content only to admins; otherwise future product work should decide archival semantics. In v1, admins should avoid archiving active/future daily problems.

## Testing

Unit tests:

- UTC midnight normalization.
- Auto-pick ordering: never-used first, then oldest-used, then lowest number.
- Solved-today helper returns true only for an accepted submission on today's daily problem.

E2E tests:

- `/daily` redirects to the current daily problem.
- Missing daily row auto-creates a stable row.
- Admin can override an auto row with a manual problem.
- UserMenu or homepage card reflects solved vs unsolved after an accepted submission.

## Open Follow-Ups

- Dedicated daily history on profile.
- Separate daily streak and daily badges.
- Email or push reminder.
- Calendar-style admin schedule.
- Per-user timezone support. This can be revisited if UTC day boundaries feel wrong for real users.
