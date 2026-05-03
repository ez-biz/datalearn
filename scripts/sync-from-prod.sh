#!/usr/bin/env bash
# Pull data from prod Neon to local Postgres. Schema-aware:
#
# - Local schema is the source of truth (because you may be on a branch
#   ahead of prod's migration state, e.g. the per-dialect feature branch).
# - Only DATA is copied from prod, NOT schema. pg_dump --data-only +
#   --column-inserts means inserts only fire for columns that exist on
#   both sides; columns that exist only locally (new ones from a
#   pending migration) are left at their default values.
# - After the data copy, we backfill the new `solutions` /
#   `expectedOutputs` JSONB maps from the legacy `solutionSql` /
#   `expectedOutput` fields, so the local data matches what the
#   per-dialect Option 3 migration would produce.
#
# Usage:
#   PROD_DIRECT_URL='<neon-direct-url>' bash scripts/sync-from-prod.sh
#
# Or via npm:
#   PROD_DIRECT_URL='...' npm run db:sync-prod
#
# Use the DIRECT (non-pooler) URL — pg_dump can't run through PgBouncer
# transaction-mode pooling.

set -euo pipefail

if [[ -z "${PROD_DIRECT_URL:-}" ]]; then
    echo "✗ PROD_DIRECT_URL is not set." >&2
    echo "  Get it from Neon console → datalearn-prod project → Connection Details," >&2
    echo "  pick the URL whose hostname does NOT contain '-pooler'." >&2
    exit 1
fi

# Read local URL from .env (Prisma config also reads this).
if [[ -z "${DATABASE_URL:-}" ]]; then
    if [[ -f .env ]]; then
        # shellcheck disable=SC1091
        DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | head -1 | sed 's/^DATABASE_URL=//; s/^"//; s/"$//')"
    fi
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "✗ Local DATABASE_URL is not set and not found in .env." >&2
    exit 1
fi

DUMP_FILE="/tmp/datalearn-prod-data-$(date +%Y%m%d-%H%M%S).sql"

echo "→ Dumping data from prod to $DUMP_FILE"
pg_dump \
    --data-only \
    --no-owner \
    --no-privileges \
    --column-inserts \
    --disable-triggers \
    "$PROD_DIRECT_URL" \
    > "$DUMP_FILE"
DUMP_SIZE=$(wc -c < "$DUMP_FILE")
echo "  ${DUMP_SIZE} bytes"

echo "→ Truncating local tables (preserving schema)…"
# CASCADE is fine here — we want to drop everything; the dump will
# re-insert in the correct order (pg_dump sorts by FK dependencies).
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
TRUNCATE TABLE
    "Submission",
    "DailyProblem",
    "ProblemListItem",
    "ProblemList",
    "ProblemReport",
    "ArticleVersion",
    "Article",
    "Page",
    "ApiKey",
    "SQLProblem",
    "SqlSchema",
    "Tag",
    "Topic",
    "Account",
    "Session",
    "VerificationToken",
    "User"
RESTART IDENTITY CASCADE;
SQL

echo "→ Loading prod data into local…"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q < "$DUMP_FILE"

echo "→ Backfilling per-dialect columns from legacy fields…"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
UPDATE "SQLProblem"
SET "solutions" = (
        SELECT COALESCE(
            jsonb_object_agg(d, COALESCE("solutionSql", '')),
            '{}'::jsonb
        )
        FROM unnest("dialects") AS d
    ),
    "expectedOutputs" = (
        SELECT COALESCE(
            jsonb_object_agg(d, "expectedOutput"),
            '{}'::jsonb
        )
        FROM unnest("dialects") AS d
    )
WHERE "solutions" = '{}'::jsonb
   OR "expectedOutputs" = '{}'::jsonb;
SQL

echo ""
echo "✓ Sync complete. Verify with:"
echo "    psql \"\$DATABASE_URL\" -c 'SELECT count(*), status FROM \"SQLProblem\" GROUP BY status'"
echo ""
echo "  Dump file kept at $DUMP_FILE — delete when you're done."
