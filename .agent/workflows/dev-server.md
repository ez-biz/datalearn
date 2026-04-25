---
description: How to start and run the local development server for the DataLearn project
---

# Development Server Workflow

This workflow describes how to run the DataLearn project locally for development.

## Prerequisites

- Node.js (v18+) installed
- PostgreSQL database running and accessible
- `.env` file configured (copy from `env.example`)

## Steps

### 1. Install dependencies (first time or after pulling changes)

// turbo
```bash
cd /Users/anchitgupta/Documents/Github/datalearn && npm install
```

### 2. Generate Prisma Client (first time or after schema changes)

// turbo
```bash
cd /Users/anchitgupta/Documents/Github/datalearn && npx prisma generate
```

### 3. Run database migrations (if new migrations exist)

```bash
cd /Users/anchitgupta/Documents/Github/datalearn && npx prisma migrate dev
```

### 4. Seed the database (optional, for fresh data)

```bash
cd /Users/anchitgupta/Documents/Github/datalearn && npx tsx prisma/seed.ts
```

### 5. Start the development server

// turbo
```bash
cd /Users/anchitgupta/Documents/Github/datalearn && npm run dev
```

The app will be available at **http://localhost:3000**.

### 6. Verify the app is running

Open the browser and check:
- Homepage: http://localhost:3000
- Learn: http://localhost:3000/learn
- Practice: http://localhost:3000/practice
- Admin: http://localhost:3000/admin (requires ADMIN role)

## Common Issues

| Issue | Solution |
|-------|----------|
| `DATABASE_URL` not set | Copy `env.example` to `.env` and fill in values |
| Prisma Client not generated | Run `npx prisma generate` |
| Port 3000 in use | Kill the process or use `npm run dev -- -p 3001` |
| DuckDB-WASM not loading | Clear browser cache, check network tab for WASM file |

## Quick Start (all-in-one)

// turbo
```bash
cd /Users/anchitgupta/Documents/Github/datalearn && npm install && npx prisma generate && npm run dev
```
