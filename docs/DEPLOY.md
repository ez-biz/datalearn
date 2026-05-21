# Deployment

First-time runbook for shipping Data Learn to production. **Vercel** for the Next.js app, **Neon** for Postgres.

> **Architecture recap**: see [`TECHNICAL_DESIGN.md`](./TECHNICAL_DESIGN.md). The MCP server (`mcp-server/`) is intentionally **not** deployed — it runs on content authors' machines and talks to your live `/api/admin/*` over Bearer auth.

---

## Environments

| Env | App | DB | Auto-deploys when |
|---|---|---|---|
| Local | `localhost:3000` (`npm run dev`) | local Postgres | — |
| Preview | `<project>-git-<branch>-<org>.vercel.app` (per-PR + per-`main`-push) | dev Neon project | any push to a non-`production` branch (including `main`) |
| Production | your custom domain (or `<project>.vercel.app`) | prod Neon project | merge to `production` |

**Code is identical across environments** — only env vars differ.

**`main` is integration, not production.** Pushing to `main` or merging a feature PR into `main` deploys to a Preview URL (your de-facto staging). Production only changes when you cut a release: open a PR `main → production` titled `release: vX.Y.Z`, merge it, and tag.

Vercel knows `production` is the prod branch via **Project → Settings → Git → Production Branch**. (Default is `main`; we override.)

> **GitHub default branch is `production`** — set with `gh repo edit ez-biz/datalearn --default-branch production`. Reasons: (1) suppresses the "Compare & pull request" banner that fired after every release merge under the old setup, (2) `git clone` lands on the live state, and (3) the "behind/ahead" framing on the branches page reads correctly. **Trade-off: feature PRs must explicitly pass `--base main`** to `gh pr create`, otherwise they target `production` and a forgotten flag would deploy unfinished work to live. CONTRIBUTING.md documents this.

> **Neon branching tip**: instead of running two separate projects (one dev, one prod), Neon's free tier lets you create branches off the prod database — copy-on-write Postgres branches that share storage. The Neon-Vercel integration can auto-create one branch per preview deploy, isolating each PR's schema changes. Skip this if you want simpler ops; revisit when previews start stepping on each other.

---

## One-time setup

### 1. Create the Neon projects

Two projects: `datalearn-dev` and `datalearn-prod`. (Or: one prod project plus a `dev` branch of it — see the branching tip above. The simpler path is two projects.)

From each project's **Connection Details**, you'll see two connection strings:

- **Pooled** (hostname contains `-pooler`, e.g. `ep-cool-name-12345-pooler.us-east-2.aws.neon.tech`) — this is `DATABASE_URL`
- **Direct** (same host without `-pooler`, e.g. `ep-cool-name-12345.us-east-2.aws.neon.tech`) — this is `DIRECT_URL`

Both are on port `5432` and end with `?sslmode=require`.

Why two URLs: Neon's pooler runs PgBouncer in transaction mode, which doesn't accept DDL. `prisma migrate deploy` needs the direct URL; runtime reads the pooled one. (Same architectural constraint as Supabase, just a different URL convention.)

> **Auto-suspend**: Neon free tier auto-suspends inactive projects after a few minutes of idle. The first request after a cold start adds ~500ms wake-up latency. For a low-traffic app, this is fine; for a paid app with consistent traffic you'd upgrade to a tier without auto-suspend.

### 2. Configure OAuth providers

You need GitHub OAuth + Google OAuth callback URLs registered for **every environment** the app runs at:

**GitHub** — https://github.com/settings/developers → New OAuth App:

- Local dev:    `http://localhost:3000/api/auth/callback/github`
- Production:   `https://<your-domain>/api/auth/callback/github`
- Preview: GitHub doesn't allow wildcards. Either add each preview URL (annoying) or create a separate **dev-only** OAuth app and use it for both Local + Preview.

**Google** — https://console.cloud.google.com/apis/credentials → Create OAuth client → Web application. Same callback-URL pattern.

Recommended: one `datalearn-dev` OAuth pair (GitHub + Google) for Local + Preview, one `datalearn-prod` pair for Production.

### 3. Create the Vercel project

1. https://vercel.com/new → import the `ez-biz/datalearn` GitHub repo
2. **Framework preset**: Next.js (auto-detected)
3. **Build command**: `npm run vercel-build` (already in `package.json` — runs `prisma migrate deploy && next build --webpack`)
4. **Don't deploy yet** — env vars first.

### 4. Set environment variables in Vercel

Project → Settings → Environment Variables. For each variable below, add it three times (one per environment): **Production**, **Preview**, **Development**. The `Development` value is what `vercel dev` would use; you can ignore it if you never use `vercel dev` and only run `npm run dev` locally.

Required vars (from [`.env.example`](../.env.example)):

| Var | Production | Preview |
|---|---|---|
| `DATABASE_URL` | prod Neon **pooled** (`-pooler` host) | dev Neon **pooled** |
| `DIRECT_URL` | prod Neon **direct** (no `-pooler`) | dev Neon **direct** |
| `AUTH_SECRET` | `openssl rand -base64 32` (fresh) | `openssl rand -base64 32` (fresh, different) |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | prod OAuth app | dev OAuth app |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | prod OAuth client | dev OAuth client |
| `API_KEY_HASH_SECRET` | `openssl rand -hex 32` (fresh) | `openssl rand -hex 32` (fresh, different) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob integration token | Vercel Blob integration token |
| `CRON_SECRET` | manual `vercel env add` secret for `/api/cron/*` | manual `vercel env add` secret for `/api/cron/*` |

**Never** share `AUTH_SECRET`, `API_KEY_HASH_SECRET`, or `CRON_SECRET` between dev and prod.

### 5. First deploy

```
vercel --prod
```

Or click "Deploy" in the Vercel UI. The build will:

1. `npm install` (with `postinstall: prisma generate`)
2. `prisma migrate deploy` — creates every table on prod Neon
3. `next build --webpack` — produces the bundle

Visit your prod URL. You should see the marketing landing page. You won't be able to do much yet because there's no data and no admin — that's the next step.

### 6. Seed the prod database

`prisma migrate deploy` only runs migrations, not seeds. To populate the seeded SQL problems and schemas:

```bash
DATABASE_URL='<prod-direct-url>' npx tsx prisma/seed.ts
```

Run from your laptop. You only do this once. Use the **direct** URL (port 5432) so the seed can do schema-aware operations cleanly.

### 7. Bootstrap the first admin

The `User` table starts empty. To get an admin:

1. Visit your prod URL → sign in via GitHub or Google. This creates a `User` row with `role = USER`.
2. From your laptop, promote yourself:

```bash
DATABASE_URL='<prod-direct-url>' node scripts/bootstrap-admin.mjs you@example.com
```

The script idempotently flips `User.role = ADMIN` for the given email. Re-running on an already-admin user is a no-op.

3. Refresh your browser. `/admin` is now reachable.

---

## Day-to-day workflow

```
make change → push branch → Preview deploy hits dev Neon
            → review → merge to main → still Preview (staging URL) on dev Neon

(later, when ready to release)

main → production PR → review → merge → Production deploy hits prod Neon → tag vX.Y.Z
```

The first half (feature PRs into `main`) is continuous and cheap. The second half (release PR) is the explicit gate that batches changes into a tagged production version. You decide when to release — there's no auto-promotion from `main` to `production`.

What you don't have to think about:

- **Migrations**: every Vercel build runs `prisma migrate deploy` against its target DB (dev Neon for previews, prod Neon for production). If you committed a new migration in `prisma/migrations/`, it ships as part of the deploy. By the time `main → production` is merged, the migration has already been applied to dev Neon — so the same migration applying to prod Neon is well-rehearsed.
- **Schema drift**: impossible by construction. The DB is always at the migration version of the code that's about to serve traffic.
- **Rollback**: revert the release-PR merge commit on `production` → Vercel auto-deploys the previous state. **But** if the reverted release included a destructive migration (`DROP COLUMN`, etc.), you need to write a forward-fix migration; you can't roll back the DB by reverting code.

### Schema changes

```bash
# On your branch, after editing prisma/schema.prisma:
npx prisma migrate dev --name describe_what_changed
```

This creates `prisma/migrations/<timestamp>_<name>/migration.sql` and applies it locally. Commit the migration file along with your code change.

For risky migrations (large backfill, NOT NULL on existing nullable column, large table rewrite), split into two **separate releases** (not just two PRs into `main`):

1. **Release N**: add column nullable + backfill in a single transaction. Merge to `main`, then release to `production`. Wait until you've confirmed it's healthy in prod.
2. **Release N+1**: make the column NOT NULL + drop any backwards-compat code. Merge to `main`, release to `production`.

The two-release rhythm matters because the risky migration runs on prod Neon when the **release PR** merges, not when the feature PR lands on `main`. Splitting across releases gives you a recovery window between the two halves.

For low-risk migrations (additive columns, new tables), batching multiple migrations into one release is fine — just sanity-check the staging Preview before merging the release PR.

### Health check

`GET /api/health` returns:

```json
{ "ok": true, "db": { "ok": true, "latencyMs": 12 }, "commit": "a73b763" }
```

Wire this into UptimeRobot, Better Uptime, or any monitor. It pings the DB so a 200 means both the function and the database are reachable.

### Daily asset garbage collection

`GET /api/cron/asset-gc` runs daily at 04:00 UTC via the `vercel.json` cron entry. It performs these sweeps:

1. **Tombstones** — `Asset` rows in `DELETED` with `deletedAt` older than 7 days get their Blob removed and the row hard-deleted; quota is released.
2. **DELETING retries** — admin abuse-deletes whose inline Blob removal did not confirm are retried.
3. **PENDING expiry + orphan blobs** — expired PENDING reservations are either promoted if the Blob exists or row-deleted if it does not; orphan blobs under `learn/` with no matching `Asset` row are deleted after a 24-hour grace window when Blob credentials are configured.

Health check: `vercel cron list` shows the schedule. Manual invocation:

```bash
curl -H "authorization: Bearer $CRON_SECRET" "$URL/api/cron/asset-gc"
```

### Logs

- Vercel dashboard → Project → Deployments → click a deploy → **Logs**. Filter by function or by request ID.
- CLI tail: `vercel logs <deploy-url>`
- DB query logs: Neon console → Project → Monitoring (slow-query log + connection counts). Or `psql "$DIRECT_URL"` and run ad-hoc queries.

---

## What lives where

| Concern | Where to manage it |
|---|---|
| App code, schema, migrations | This repo (single source of truth) |
| Build pipeline | `package.json` `vercel-build` script |
| Environment values | Vercel project env vars (per environment) |
| OAuth callbacks | GitHub + Google developer consoles |
| DB queries / inspection | `psql "$DIRECT_URL"` or Neon SQL Editor (console → Project → SQL Editor) |
| Live logs | Vercel deploy logs |
| Uptime | `GET /api/health` against any monitor |
| Analytics | Vercel Analytics + Speed Insights are wired in `app/layout.tsx`; GA4 uses `NEXT_PUBLIC_GA_MEASUREMENT_ID` when set, otherwise production falls back to `G-B9RFQWH2JC`. |

**Never** edit prod schema directly via `psql` — write a migration, ship it through a PR. The git-tracked migration log is the audit trail.

---

## Things to add later

These are intentionally not in the v1 deploy runbook; revisit when you have real users:

- **Error tracking**: Sentry. The free tier covers a small project comfortably; install in `app/layout.tsx` and the API routes.
- **Backups**: Neon's free tier includes 7-day point-in-time restore on the prod branch (you can roll back to any second within the window). For longer retention, schedule `pg_dump` on a cron or upgrade to a paid tier.
- **Custom domain**: Vercel project → Settings → Domains. CNAME to `cname.vercel-dns.com`.
- **Analytics deeper dive**: Vercel Analytics, Speed Insights, and GA4 are wired in `app/layout.tsx`; for richer funnels and conversion you'd want PostHog or similar.
- **Rate limiting at the edge**: middleware-level rate limit on `/api/admin/*` and `/api/me/*` (currently per-action, e.g. submission rate limit). Worth doing once the public traffic warrants.
- **CI deploy gate**: today CI runs but doesn't gate Vercel deploys (we removed the required-checks gate due to GitHub's mergeable bug — see CONTRIBUTING.md). When contributor #2 lands and we re-enable required reviews + checks, the gate becomes meaningful.
