# Deployment

First-time runbook for shipping Data Learn to production. Vercel for the Next.js app, Supabase (or any Postgres host) for the database.

> **Architecture recap**: see [`TECHNICAL_DESIGN.md`](./TECHNICAL_DESIGN.md). The MCP server (`mcp-server/`) is intentionally **not** deployed — it runs on content authors' machines and talks to your live `/api/admin/*` over Bearer auth.

---

## Environments

| Env | App | DB | Auto-deploys when |
|---|---|---|---|
| Local | `localhost:3000` (`npm run dev`) | local Postgres | — |
| Preview | `<project>-git-<branch>-<org>.vercel.app` (per-PR) | shared **dev** Supabase project | any push to a non-`main` branch |
| Production | your custom domain (or `<project>.vercel.app`) | **prod** Supabase project | merge to `main` |

**Code is identical across environments** — only env vars differ. There is no "staging branch"; preview URLs are auto-generated per PR and validate the PR's exact diff.

---

## One-time setup

### 1. Create the Supabase projects

Two projects: `datalearn-dev` and `datalearn-prod`. From each project's **Settings → Database**, copy:

- **Connection pooling** string (port `6543`, `?pgbouncer=true`) — this is `DATABASE_URL`
- **Connection string** (port `5432`, direct) — this is `DIRECT_URL`

PgBouncer in transaction mode doesn't accept DDL, so `prisma migrate deploy` needs the direct URL. The runtime app reads the pooled one.

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
| `DATABASE_URL` | prod Supabase **pooled** | dev Supabase **pooled** |
| `DIRECT_URL` | prod Supabase **direct** | dev Supabase **direct** |
| `AUTH_SECRET` | `openssl rand -base64 32` (fresh) | `openssl rand -base64 32` (fresh, different) |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | prod OAuth app | dev OAuth app |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | prod OAuth client | dev OAuth client |
| `API_KEY_HASH_SECRET` | `openssl rand -hex 32` (fresh) | `openssl rand -hex 32` (fresh, different) |

**Never** share `AUTH_SECRET` or `API_KEY_HASH_SECRET` between dev and prod.

### 5. First deploy

```
vercel --prod
```

Or click "Deploy" in the Vercel UI. The build will:

1. `npm install` (with `postinstall: prisma generate`)
2. `prisma migrate deploy` — creates every table on prod Supabase
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
make change → push branch → Preview deploy hits dev Supabase
            → review → merge to main → Production deploy hits prod Supabase
```

What you don't have to think about:

- **Migrations**: every PR build runs `prisma migrate deploy` against its target DB. If you committed a new migration in `prisma/migrations/`, it ships as part of the deploy.
- **Schema drift**: impossible by construction. The DB is always at the migration version of the code that's about to serve traffic.
- **Rollback**: revert the merge commit on main → Vercel auto-deploys the previous state. **But** if the reverted PR included a destructive migration (`DROP COLUMN`, etc.), you need to write a forward-fix migration; you can't roll back the DB by reverting code.

### Schema changes

```bash
# On your branch, after editing prisma/schema.prisma:
npx prisma migrate dev --name describe_what_changed
```

This creates `prisma/migrations/<timestamp>_<name>/migration.sql` and applies it locally. Commit the migration file along with your code change.

For risky migrations (large backfill, NOT NULL on existing nullable column, large table rewrite), split into two PRs:

1. **PR A**: add column nullable + backfill in a single transaction. Merge & deploy.
2. **PR B**: make the column NOT NULL + drop any backwards-compat code. Merge & deploy.

This pattern guarantees zero downtime under concurrent prod traffic.

### Health check

`GET /api/health` returns:

```json
{ "ok": true, "db": { "ok": true, "latencyMs": 12 }, "commit": "a73b763" }
```

Wire this into UptimeRobot, Better Uptime, or any monitor. It pings the DB so a 200 means both the function and the database are reachable.

### Logs

- Vercel dashboard → Project → Deployments → click a deploy → **Logs**. Filter by function or by request ID.
- CLI tail: `vercel logs <deploy-url>`
- DB query logs: Supabase dashboard → Logs → Postgres logs. Slow queries surface here.

---

## What lives where

| Concern | Where to manage it |
|---|---|
| App code, schema, migrations | This repo (single source of truth) |
| Build pipeline | `package.json` `vercel-build` script |
| Environment values | Vercel project env vars (per environment) |
| OAuth callbacks | GitHub + Google developer consoles |
| DB queries / inspection | `psql "$DIRECT_URL"` or Supabase SQL Editor |
| Live logs | Vercel deploy logs |
| Uptime | `GET /api/health` against any monitor |

**Never** edit prod schema directly via `psql` — write a migration, ship it through a PR. The git-tracked migration log is the audit trail.

---

## Things to add later

These are intentionally not in the v1 deploy runbook; revisit when you have real users:

- **Error tracking**: Sentry. The free tier covers a small project comfortably; install in `app/layout.tsx` and the API routes.
- **Backups**: Supabase free tier doesn't include automatic daily backups. Either upgrade or schedule `pg_dump` on a cron.
- **Custom domain**: Vercel project → Settings → Domains. CNAME to `cname.vercel-dns.com`.
- **Analytics deeper dive**: Vercel Analytics is wired in `app/layout.tsx` for page views + web vitals; for funnels and conversion you'd want PostHog or similar.
- **Rate limiting at the edge**: middleware-level rate limit on `/api/admin/*` and `/api/me/*` (currently per-action, e.g. submission rate limit). Worth doing once the public traffic warrants.
- **CI deploy gate**: today CI runs but doesn't gate Vercel deploys (we removed the required-checks gate due to GitHub's mergeable bug — see CONTRIBUTING.md). When contributor #2 lands and we re-enable required reviews + checks, the gate becomes meaningful.
