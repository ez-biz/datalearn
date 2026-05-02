# Login Screen Revamp Design

> Date: 2026-05-02
> Status: Approved design
> Scope: Custom sign-in page UI using existing Auth.js provider routes

## Goal

Replace the default Auth.js sign-in experience with a polished Data Learn sign-in screen that feels like a focused SQL practice workspace. The page should make OAuth sign-in clear, fast, and trustworthy without changing the existing auth implementation.

## Non-Goals

- No changes to `lib/auth.ts` provider logic, account-linking policy, callbacks, roles, or session shape.
- No changes to the Auth.js API route at `/api/auth/[...nextauth]`.
- No email/password sign-in.
- No new backend auth service or API wrapper.
- No broad navigation, dashboard, or homepage redesign.

## Route And Auth Boundary

Add a custom page at `/auth/signin`.

This page links to the existing provider endpoints:

- `/api/auth/signin/google`
- `/api/auth/signin/github`

Each provider link preserves a validated `callbackUrl` query parameter. A callback is valid only when it is an internal path beginning with `/` and not beginning with `//`. Invalid, missing, or external callback values fall back to `/`.

Existing sign-in entry points should move from `/api/auth/signin` to `/auth/signin` where the user should see the custom page first. The underlying Auth.js route remains available for provider handoff and should not be modified.

## Visual Direction

Use the approved high-contrast training direction.

The screen should feel like a production SQL practice environment, not a marketing landing page. Use the existing app design tokens and typography:

- background and surface tokens for the dark workspace
- primary/easy green for the main action and query-success accents
- border and muted tokens for panels, dividers, and secondary text
- Inter for interface text
- JetBrains Mono for query snippets, result rows, and compact technical details

Avoid a one-note decorative gradient. Depth should come from borders, surface contrast, restrained shadows, and small code/result details.

## Layout

Desktop layout:

- two-column composition within the normal app shell
- left side: training workspace visual, such as a compact SQL editor, result rows, progress/status chips, and problem context
- right side: focused sign-in panel with the Data Learn mark, headline, provider buttons, error state, and short trust note

Mobile layout:

- single column
- sign-in action appears early in the viewport
- workspace visual compresses below the action or becomes a smaller supporting panel
- no horizontal scrolling at 375px width

The sign-in panel can be a card. Do not nest cards inside that panel. Supporting workspace elements can be separate panels or inline blocks, but the page should not become a card-heavy layout.

## Content

Primary message:

> Train like the query is going live.

Provider actions:

- Continue with Google
- Continue with GitHub

Support copy should stay short. It can mention that authentication is handled through OAuth and provider passwords are never entered into Data Learn. Do not add long explanatory feature text to the page.

## Interaction And Accessibility

- Provider links must be keyboard reachable and have visible focus states.
- Interactive targets should be at least 44px tall.
- Hover, focus, and pressed states should use existing button interaction patterns.
- Error messages should be visible near the sign-in panel and not rely on color alone.
- Motion should be subtle and must respect `prefers-reduced-motion`.
- The page must remain readable in both light and dark themes, with the high-contrast dark theme as the primary design target.

## Error Handling

Read the optional `error` query parameter returned by Auth.js.

Show a compact error banner in the sign-in panel for known sign-in failures. The message should be user-safe and general, for example:

> Sign-in could not be completed. Try another provider or try again.

Unknown errors use the same general message. Do not expose internal auth details.

## Integration Points

Update sign-in links that currently send users directly to `/api/auth/signin` so they use `/auth/signin` instead. Known entry points include:

- desktop navbar sign-in button
- mobile navigation sign-in action
- footer sign-in link
- protected-page redirects where a callback should be preserved
- inline anonymous CTAs such as report/list actions

Provider handoff still uses `/api/auth/signin/<provider>`.

## Testing

Unit or focused tests:

- callback URL sanitizer accepts internal paths such as `/profile`
- callback URL sanitizer rejects external URLs and protocol-relative URLs
- provider hrefs include the sanitized callback URL

E2E or browser checks:

- `/auth/signin` renders provider actions
- `/auth/signin?callbackUrl=/profile` builds provider links with `/profile`
- `/auth/signin?callbackUrl=https://example.com` falls back to `/`
- desktop viewport around 1440px has a balanced two-column layout
- mobile viewport around 375px has no horizontal scroll and keeps the sign-in action visible

Verification commands should include the project typecheck/build checks used by the repo before opening a PR.

## Open Follow-Ups

- A future account settings page can support linking additional providers after first sign-in.
- A future auth error taxonomy can show more specific messages if the team wants that behavior.
- A future unauthenticated landing flow can reuse the same visual language, but this revamp is limited to sign-in.
