# Problem Discussions

> **Status**: implemented on branch `docs/problem-discussions-design`; pending release/PR. This is the v1 community layer for problem-specific discussion on Data Learn.

## Goal

Add a problem-level discussion surface so learners can ask questions, explain approaches, and discuss edge cases directly inside the existing practice workspace. The feature should be useful on day one, but it must also include enough moderation, rate limiting, and admin control to avoid spam becoming a product or operations problem.

## Non-goals

- Reddit-style infinite threaded discussions.
- Direct messages, notifications, mentions, or following.
- Rich WYSIWYG editing.
- AI moderation.
- Server-side SQL execution or anti-cheat changes. Discussions can include shared code, but this feature does not change the existing browser-execution model.

## Decisions

| Question | Decision |
|---|---|
| Placement | Add a `Discussion` tab beside `Description`, `Hints`, and `History` in the problem panel. |
| Visibility | Anyone can read discussions. Only signed-in users can post, reply, vote, or report. |
| Reply depth | One level deep only: comments and direct replies. |
| Formatting | Markdown only with preview, inline code, fenced code blocks, and SQL syntax highlighting where possible. Raw HTML is not rendered. |
| Voting | Upvote/downvote on comments and replies. One vote per user per comment. |
| Sorting | Default `Best`; also support `Most votes` and `Latest`. |
| Pagination | Paginate top-level comments. Replies are capped or loaded per visible thread. |
| Per-problem controls | `OPEN`, `LOCKED`, `HIDDEN`. Locked is read-only. Hidden removes the learner-facing tab. |
| Report threshold | Configurable in DB, default `3` reports before a comment enters the admin moderation queue. |
| Auto-hide on threshold | No. Comments stay visible until an admin or permitted moderator acts. |
| Moderator role | Add `MODERATOR`, but make moderator abilities permission-based. |
| Global settings | Admin-only. Moderators cannot change limits, thresholds, or tier config. |
| Share approach | After an accepted submission, show `Share approach` to prefill a comment with the accepted SQL in a fenced code block. |

## Learner Experience

The `Discussion` tab appears on published problems unless the problem discussion mode is `HIDDEN`. In the normal `OPEN` state, the tab shows a composer, comment list, sort selector, and pagination controls. In `LOCKED`, users can read the discussion but cannot post, reply, vote, or report; the UI explains that discussion is locked for the problem.

Signed-out users can read comments, but actions that mutate discussion state open the existing sign-in dialog. Signed-in users can post top-level comments, reply to a top-level comment, vote, report, edit their own comment within the edit window, and soft-delete their own comment. Deleted comments remain as placeholders when they have replies so thread context is not destroyed.

Comments show author display name, avatar when available, reputation tier badge, timestamp, score, reply count, edit marker, and moderation state when relevant. Replies use the same rendering and actions but cannot have nested replies.

Markdown is edited in a textarea with preview. Supported formatting is plain Markdown, inline code, fenced code blocks, and SQL highlighting where available. Body length is capped at 4,000 characters for both comments and replies.

After a user submits an accepted solution, the `History` panel exposes `Share approach`. Clicking it switches to the Discussion tab and pre-fills:

````markdown
Here is my approach:

```sql
<accepted query>
```
````

The user can edit before posting.

## Data Model

Add `DiscussionComment`:
- `id`
- `problemId`
- `userId`
- `parentId` nullable, references another `DiscussionComment`
- `bodyMarkdown`
- `status`: `VISIBLE`, `HIDDEN`, `DELETED`, `SPAM`
- `upvotes`
- `downvotes`
- `score`
- `reportCount`
- `createdAt`
- `updatedAt`
- `editedAt`
- `deletedAt`
- `hiddenAt`
- `hiddenById`

Invariant: `parentId` can only point to a top-level comment. Replies cannot have replies.

Add `DiscussionVote`:
- `commentId`
- `userId`
- `value`: `UP` or `DOWN`
- `createdAt`
- `updatedAt`

Unique key: `(commentId, userId)`.

Add `DiscussionReport`:
- `commentId`
- `userId`
- `reason`: `SPAM`, `ABUSE`, `SPOILER`, `OFF_TOPIC`, `OTHER`
- `message`
- `status`: `OPEN`, `DISMISSED`, `CONFIRMED`
- `createdAt`
- `resolvedAt`
- `resolvedById`

Unique key: `(commentId, userId)` so one user cannot report the same comment repeatedly.

Add `DiscussionSettings` as a singleton config row:
- `globalEnabled`, default `true`; admins can disable globally from `/admin/discussions/settings`
- `reportThreshold`, default `3`
- `editWindowMinutes`, default `15`
- `duplicateCooldownSeconds`, default `300`
- `bodyMaxChars`, default `4000`
- tier thresholds and tier-specific limits
- `updatedAt`
- `updatedById`

Add `ProblemDiscussionState`:
- `problemId`
- `mode`: `OPEN`, `LOCKED`, `HIDDEN`
- `updatedAt`
- `updatedById`

If no row exists for a problem, mode is treated as `OPEN`.

Add `UserReputationEvent`:
- `userId`
- `kind`: `ACCEPTED_SOLVE`, `COMMENT_UPVOTE_RECEIVED`, `COMMENT_DOWNVOTE_RECEIVED`, `COMMENT_HIDDEN`, `COMMENT_SPAM_CONFIRMED`, `ACCOUNT_AGE_BONUS`
- `points`
- `sourceId`
- `createdAt`

This is append-only so reputation is auditable and recalculation is possible.

Add `ModeratorPermission`:
- `userId`
- `permission`
- `grantedById`
- `createdAt`

`User.role` gains `MODERATOR`.

## Moderator Permissions

Admin has full access and does not need explicit moderator permissions.

Moderator permissions are assigned and revoked by admins:
- `VIEW_DISCUSSION_QUEUE`
- `HIDE_COMMENT`
- `RESTORE_COMMENT`
- `DISMISS_REPORT`
- `MARK_SPAM`
- `LOCK_PROBLEM_DISCUSSION`
- `HIDE_PROBLEM_DISCUSSION`

Moderator permissions cannot include:
- changing global discussion settings
- assigning or revoking moderator permissions
- managing admins
- managing API keys
- editing problems, schemas, articles, topics, or tags

Admin UI adds `/admin/moderators` where admins can search existing users, promote them to `MODERATOR`, assign permissions with checkboxes, revoke individual permissions, or remove the moderator role entirely.

## Limits And Reputation

Limits are stored in `DiscussionSettings`, not hardcoded. The application loads settings server-side and applies defaults only if the settings row is missing.

Reputation score is event-based:
- `+2` per accepted problem solve, capped daily.
- `+1` per upvote received on a visible comment.
- `-1` per downvote received, capped daily to reduce brigading damage.
- `-2` when a comment is hidden.
- `-5` when a comment is marked spam or abuse confirmed.
- account-age bonus at 7 and 30 days.

Initial tiers:
- `NEW`
- `TRUSTED`
- `HIGH_TRUST`

Each tier has configurable:
- top-level comments per hour
- replies per hour
- comments per problem per day
- minimum seconds between comments
- votes per hour
- edit window minutes

Spam controls:
- sign-in required for mutating actions
- per-user global rate limits
- per-user per-problem rate limits
- cooldown between comments by the same user
- duplicate-body rejection for the same user on the same problem inside the duplicate cooldown
- report threshold before moderation queue entry
- moderation penalties create reputation events

## Admin And Moderator Experience

Add `/admin/discussions`:
- `Needs review`: comments with open reports meeting or exceeding the report threshold
- `Hidden`
- `Dismissed`
- `Spam`

Each row shows problem, comment body preview, author, reputation tier, score, report count, latest report reason, and timestamp. Actions depend on role and permissions:
- hide comment
- restore comment
- dismiss reports
- mark spam

Every moderation action writes an audit record with actor, action, target, timestamp, and optional note.

Add `/admin/discussions/settings`:
- admin-only page for global discussion settings
- report threshold
- edit window
- rate limits
- reputation tier thresholds
- body length
- duplicate cooldown

Problem admin/edit page adds a discussion mode control:
- `Open`
- `Locked`
- `Hidden`

Admins can always change this. Moderators can change it only with `LOCK_PROBLEM_DISCUSSION` or `HIDE_PROBLEM_DISCUSSION` as appropriate.

## API And Server Boundaries

Public read route:
- `GET /api/problems/{slug}/discussion`

Query params:
- `sort=best|votes|latest`
- `cursor` or `page`
- `limit`

Response includes paginated top-level comments, capped inline replies, aggregate vote counts, and viewer vote state when signed in. It excludes hidden/spam comments unless the viewer is an admin or permitted moderator.

Authenticated write paths:
- create top-level comment
- create reply
- edit own comment within edit window
- soft-delete own comment
- vote
- report

Admin/moderator paths:
- list moderation queue
- hide/restore comment
- dismiss reports
- mark spam
- set problem discussion mode
- update settings, admin-only
- manage moderator permissions, admin-only

Authorization follows the existing pattern: middleware is defense-in-depth, but route handlers enforce permissions server-side. Admin-only and moderator-only checks must not rely on client-side hiding.

## Sorting

`Latest`: newest visible top-level comments first.

`Most votes`: highest `(upvotes - downvotes)` first, then newest.

`Best`: v1 uses a simple deterministic score:

```text
best = (upvotes - downvotes) + recencyBoost
```

`recencyBoost` is small and decays by age so useful older comments are not buried by a new low-value comment. This can later include reputation or accepted-solution signals.

## Rendering And Safety

Markdown rendering must not execute raw HTML or script. Use the existing Markdown stack and avoid `rehype-raw`. Code blocks are rendered as text and highlighted when a language is present.

Comment body is capped before persistence. UI preview and server render use the same Markdown rendering rules to avoid "preview says safe, server renders unsafe" drift.

The public API never returns deleted comment body text. Admin/moderator views can see deleted/hidden/spam body text for audit and moderation.

## Performance

Indexes:
- `DiscussionComment(problemId, parentId, status, score, createdAt)`
- `DiscussionComment(problemId, status, createdAt)`
- `DiscussionVote(commentId, userId)`
- `DiscussionReport(commentId, status)`
- `DiscussionReport(commentId, userId)`
- `ModeratorPermission(userId, permission)`
- `UserReputationEvent(userId, createdAt)`

Top-level comments are paginated. Replies are one level deep and loaded either with a small inline cap or through a per-thread "load replies" request. Vote counts, score, and report count are denormalized on `DiscussionComment` for fast listing.

## Testing

Unit tests:
- reputation score and tier calculation
- rate-limit decisions by tier
- duplicate comment cooldown
- best-sort scoring
- moderator permission checks

API tests:
- signed-out users can read but cannot mutate
- signed-in user can comment, reply, edit inside window, soft-delete
- one-level reply invariant is enforced
- vote uniqueness and vote switching
- report threshold queue entry
- admin-only settings updates
- moderator permission matrix

E2E tests:
- post a comment on a problem
- reply to a comment
- vote and see score update
- report comments until threshold
- admin/moderator hides and restores comment
- locked problem blocks new actions
- hidden problem hides the Discussion tab
- accepted submission can be shared into a prefilled discussion comment

## Rollout

The feature is controlled by `DiscussionSettings.globalEnabled`. When `globalEnabled` is false, the learner-facing Discussion tab is hidden everywhere. The default behavior for published problems is `OPEN` unless a problem-specific state row says `LOCKED` or `HIDDEN`. Create the settings row during migration or first boot.

Recommended implementation phases:
1. Schema, settings defaults, reputation helpers, and permission helpers.
2. Public discussion read API plus learner Discussion tab.
3. Create/reply/edit/delete/vote/report actions with limits.
4. Admin moderation queue.
5. Moderator role and permission management.
6. Per-problem lock/hide controls.
7. Share approach from accepted submissions.

## Acceptance Criteria

- A learner can read discussions on a published problem.
- A signed-in learner can post, reply one level deep, vote, report, edit briefly, and soft-delete.
- A signed-out learner cannot mutate discussion state.
- Rate limits, cooldowns, report threshold, edit window, and tier settings are DB-backed.
- Admins can change global discussion settings.
- Admins can assign and revoke moderator permissions.
- Moderators only see and perform actions granted to them.
- A reported comment appears in the moderation queue after the configured threshold.
- `LOCKED` prevents new discussion actions but keeps comments visible.
- `HIDDEN` removes the learner-facing Discussion tab.
- No raw HTML executes from comment Markdown.
