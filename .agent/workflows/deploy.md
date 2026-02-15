---
description: How to deploy the DataLearn project to Vercel (production and preview)
---

# Deployment Workflow

This workflow describes how to deploy the DataLearn platform to Vercel.

## Prerequisites

- Vercel account linked to the GitHub repository
- Production PostgreSQL database (Railway, Supabase, or Neon)
- GitHub and Google OAuth apps configured with production callback URLs

## Steps

### 1. Verify the build locally

// turbo
```bash
cd /Users/anchitgupta/Documents/Github/datalearn && npm run build
```

Fix any build errors before deploying.

### 2. Set up Vercel (first time)

```bash
cd /Users/anchitgupta/Documents/Github/datalearn && npx vercel
```

Follow the interactive prompts to link the project.

### 3. Configure environment variables on Vercel

Go to the Vercel Dashboard → Project Settings → Environment Variables and add:

```
DATABASE_URL=postgresql://user:pass@production-host:5432/datalearn
AUTH_SECRET=<generated-secret>
AUTH_GITHUB_ID=<production-github-oauth-id>
AUTH_GITHUB_SECRET=<production-github-oauth-secret>
AUTH_GOOGLE_ID=<production-google-oauth-id>
AUTH_GOOGLE_SECRET=<production-google-oauth-secret>
AUTH_URL=https://your-domain.vercel.app
```

### 4. Configure OAuth callback URLs

**GitHub OAuth App:**
- Authorization callback URL: `https://your-domain.vercel.app/api/auth/callback/github`

**Google OAuth App:**
- Authorized redirect URIs: `https://your-domain.vercel.app/api/auth/callback/google`

### 5. Deploy to production

```bash
cd /Users/anchitgupta/Documents/Github/datalearn && npx vercel --prod
```

Or simply push to `main` if auto-deploy is configured.

### 6. Run production database migrations

```bash
DATABASE_URL=<production-url> npx prisma migrate deploy
```

### 7. Seed production database

```bash
DATABASE_URL=<production-url> npx tsx prisma/seed.ts
```

### 8. Verify production deployment

- Visit the production URL
- Test auth flow (GitHub + Google sign-in)
- Navigate to Learn, Practice pages
- Test SQL playground execution
- Check admin panel (if logged in as admin)

## Preview Deployments

Every push to a non-`main` branch creates a preview deployment on Vercel automatically. Use these to review feature branches before merging.

## Notes

- **Framework Preset:** Vercel auto-detects Next.js
- **Build Command:** `npm run build` (default)
- **Output Directory:** `.next` (default)
- **Node.js Version:** 18.x or 20.x
- The `prisma generate` step runs automatically during `npm run build` if you add `"postinstall": "prisma generate"` to `package.json` scripts
