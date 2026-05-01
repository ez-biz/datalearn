// Prisma config.
//
// `prisma migrate` needs a direct (non-pooled) connection because PgBouncer
// in transaction mode doesn't accept DDL. At runtime the app reads
// DATABASE_URL (pooled in prod; same string locally). Pattern:
//
//   DATABASE_URL  → pooled URL (e.g. Supabase ...:6543 with ?pgbouncer=true)
//   DIRECT_URL    → direct URL (e.g. Supabase ...:5432). Falls back to
//                   DATABASE_URL when unset, which is correct locally.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
