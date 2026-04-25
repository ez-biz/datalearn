This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Deploying datalearn to Vercel + Neon

1. Create a Neon project (free tier is fine). Copy the **pooled** and **direct** connection strings.
2. In Vercel, import this repo. Set the following env vars under Project Settings → Environment Variables:
   - `DATABASE_URL` — Neon pooled connection string (used by the app at runtime)
   - `DIRECT_URL` — Neon direct connection string (used by `prisma migrate deploy` during build)
   - `NEXTAUTH_URL` — set to the Vercel production URL (e.g. `https://datalearn.vercel.app`)
   - `AUTH_SECRET` — generate with `openssl rand -base64 32`
   - `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` — from a GitHub OAuth app with callback URL `https://<your-domain>/api/auth/callback/github`
   - `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` — from a Google OAuth client with the equivalent Google callback
3. Vercel's Build Command auto-picks `package.json`'s `vercel-build` script: `prisma migrate deploy && next build`.
4. After the first deploy, seed the production DB once:
   ```bash
   DATABASE_URL="<direct-url>" npx tsx prisma/seed.ts
   ```
5. Vercel Analytics is enabled via the `<Analytics />` component in the root layout — page views and Web Vitals appear in the project's Analytics tab.

### SQL engine note

The SQL playground uses DuckDB-WASM, which downloads a ~30MB WASM binary on first visit. Expect a slow first load on mobile; subsequent visits are cached.
