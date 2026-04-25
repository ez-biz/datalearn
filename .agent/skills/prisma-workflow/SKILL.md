---
name: prisma-workflow
description: Prisma ORM usage patterns, schema conventions, and data access patterns for the DataLearn project
---

# Prisma ORM Patterns for DataLearn

This skill documents how Prisma is configured and used in the DataLearn project.

---

## 1. Configuration

### Schema Location
- **File:** `prisma/schema.prisma`
- **Config:** `prisma.config.ts` (custom configuration for driver adapters)

### Key Configuration Details

```prisma
generator client {
    provider        = "prisma-client-js"
    previewFeatures = ["driverAdapters"]
}

datasource db {
    provider = "postgresql"
    // Note: No `url` field — connection is handled via pg Pool adapter
}
```

### Driver Adapter Pattern

The project uses Prisma's `driverAdapters` preview feature with a `pg` Pool:

```typescript
// lib/prisma.ts
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })
```

### Singleton Pattern (Prevents Hot-Reload Connection Leaks)

```typescript
const globalForPrisma = global as unknown as { prisma_new: PrismaClient }

export const prisma =
    globalForPrisma.prisma_new ||
    new PrismaClient({ adapter })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma_new = prisma
```

---

## 2. Schema Conventions

### ID Generation
All models use CUID for primary keys:
```prisma
id String @id @default(cuid())
```

### Slug Convention
All content models include a unique slug for URL-friendly paths:
```prisma
slug String @unique
```

### Timestamps
All models include creation and update timestamps:
```prisma
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
```

### Text Fields
Use `@db.Text` for long-form content (removes VARCHAR(191) limit):
```prisma
content String @db.Text
```

### Enums
Define enums at the schema level:
```prisma
enum Difficulty {
    EASY
    MEDIUM
    HARD
}
```

---

## 3. Common Query Patterns

### Find Many with Relation Counts
```typescript
const topics = await prisma.topic.findMany({
    include: {
        _count: { select: { articles: true } },
    },
    orderBy: { name: 'asc' }
})
```

### Find Many with Filtered Relations
```typescript
const topic = await prisma.topic.findUnique({
    where: { slug },
    include: {
        articles: {
            where: { published: true },
            select: { id: true, title: true, slug: true, createdAt: true }
        }
    }
})
```

### Find Unique with Relations
```typescript
const article = await prisma.article.findUnique({
    where: { slug },
    include: { topic: true }
})
```

### Upsert (Idempotent Create/Update)
```typescript
await prisma.sQLProblem.upsert({
    where: { slug: 'simple-select' },
    update: {},
    create: {
        title: 'Simple Select',
        slug: 'simple-select',
        // ... all fields
    }
})
```

---

## 4. Seed Script Pattern

### Location
- **File:** `prisma/seed.ts`
- **Run:** `npx tsx prisma/seed.ts`

### Structure

```typescript
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

// Create a NEW PrismaClient for seeding (not the singleton)
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    // Use upsert for idempotency
    await prisma.user.upsert({
        where: { email: 'admin@example.com' },
        update: { role: 'ADMIN' },
        create: { email: 'admin@example.com', name: 'Admin', role: 'ADMIN' }
    })
}

main()
    .then(async () => { await prisma.$disconnect() })
    .catch(async (e) => {
        if (e.code === 'P2002') return  // Skip duplicate key errors
        console.error(e)
        process.exit(1)
    })
```

### Shared Seed Data
Large SQL schemas for problems are stored in separate files under `lib/`:
- `lib/seed-data.ts` — E-commerce schema (customers, products, orders)

---

## 5. Migration Workflow

```bash
# 1. Edit schema.prisma
# 2. Generate client types
npx prisma generate

# 3. Create migration
npx prisma migrate dev --name <descriptive-name>

# 4. Apply to production
npx prisma migrate deploy

# 5. Reset (dev only – drops everything)
npx prisma migrate reset
```

---

## 6. Adding a New Model (Checklist)

1. **Add model to `prisma/schema.prisma`** with id, slug, timestamps
2. **Run `npx prisma generate`** to update types
3. **Run `npx prisma migrate dev --name add_<model>_model`** to create migration
4. **Create server actions** in `actions/<model>.ts` (CRUD functions)
5. **Add seed data** in `prisma/seed.ts` using upsert
6. **Create UI components** and pages
7. **Update admin panel** if applicable

---

## 7. Prisma Studio

For visual database inspection:
```bash
npx prisma studio
```
Opens at http://localhost:5555 — allows browsing, filtering, and editing data.

---

## 8. Model Reference (Current)

| Model | Purpose | Key Fields |
|-------|---------|-----------|
| `User` | Authentication + profiles | email, role (USER/ADMIN) |
| `Account` | OAuth provider links | provider, providerAccountId |
| `Session` | Active sessions | sessionToken, expires |
| `VerificationToken` | Email verification | token, expires |
| `Topic` | Learning categories | name, slug, description |
| `Article` | Learning content | title, slug, content (markdown) |
| `SQLProblem` | Practice problems | title, difficulty, sqlSchema, expectedOutput |
| `Page` | Dynamic CMS pages | title, slug, content, isActive |
