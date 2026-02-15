---
description: How to make database schema changes with Prisma (edit schema, generate, migrate, seed)
---

# Database Changes Workflow

This workflow describes how to modify the database schema using Prisma ORM.

## Prerequisites

- PostgreSQL database is running and accessible
- `DATABASE_URL` is set in `.env`

## Steps

### 1. Create a feature branch first

Follow the `/feature-development` workflow to create a branch before making DB changes.

### 2. Edit the Prisma schema

Edit `prisma/schema.prisma` to add/modify models, fields, or relations:

```
File: prisma/schema.prisma
```

### 3. Generate the Prisma Client

// turbo
```bash
cd /Users/anchitgupta/Documents/Github/datalearn && npx prisma generate
```

This regenerates the TypeScript types for the Prisma Client.

### 4. Create a migration

```bash
cd /Users/anchitgupta/Documents/Github/datalearn && npx prisma migrate dev --name <migration-name>
```

**Migration naming conventions:**
- `add_submission_model`
- `add_hint_to_sql_problem`
- `rename_user_role_enum`

### 5. Update seed data (if needed)

Edit `prisma/seed.ts` with any new seed data, then run:

```bash
cd /Users/anchitgupta/Documents/Github/datalearn && npx tsx prisma/seed.ts
```

### 6. Verify the changes

// turbo
```bash
cd /Users/anchitgupta/Documents/Github/datalearn && npx prisma studio
```

This opens Prisma Studio in the browser to inspect the database visually.

## Rollback

If you need to undo a migration:

```bash
cd /Users/anchitgupta/Documents/Github/datalearn && npx prisma migrate reset
```

> **Warning:** This drops the database and re-applies all migrations + seed.

## Notes

- Always generate the Prisma Client after schema changes
- Use `upsert` in seed files to make them idempotent (re-runnable)
- The project uses `driverAdapters` preview feature with `@prisma/adapter-pg`
- Both `lib/prisma.ts` and `prisma/seed.ts` create their own adapter instances
