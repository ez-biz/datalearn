#!/usr/bin/env bash
# Run the tag audit against production. Read-only: the underlying
# `scripts/audit-tags.ts` only issues SELECTs, so the pooler URL is fine
# (pg_dump and migrations would not be).
#
# Usage:
#   PROD_DATABASE_URL='<neon-pooler-url>' bash scripts/audit-tags-prod.sh
#
# Or via npm:
#   PROD_DATABASE_URL='...' npm run audit:tags:prod
#
# Where to get the URL:
#   Neon console → datalearn-prod project → Connection Details → "Pooled
#   connection" (hostname contains `-pooler`). The direct URL also works,
#   but the pooler is the default and matches what Vercel reads.
#
# Why a thin wrapper instead of just exporting DATABASE_URL?
#   The audit-tags Prisma client picks up `DATABASE_URL` from the
#   environment. Setting that to a prod URL in your shell history is a
#   foot-gun — every subsequent migration command in that shell would
#   target prod. This wrapper scopes the prod URL to a single process.

set -euo pipefail

if [[ -z "${PROD_DATABASE_URL:-}" ]]; then
    echo "✗ PROD_DATABASE_URL is not set." >&2
    echo "" >&2
    echo "  Get it from Neon console → datalearn-prod project → Connection Details." >&2
    echo "  The pooled URL (hostname contains '-pooler') is fine — audit is read-only." >&2
    echo "" >&2
    echo "  Then re-run: PROD_DATABASE_URL='<url>' npm run audit:tags:prod" >&2
    exit 1
fi

# Refuse to run if PROD_DATABASE_URL looks like localhost — almost always
# a mistake (the local-DB audit lives at `npm run audit:tags`).
if [[ "$PROD_DATABASE_URL" == *"localhost"* || "$PROD_DATABASE_URL" == *"127.0.0.1"* ]]; then
    echo "✗ PROD_DATABASE_URL points at localhost." >&2
    echo "  Use 'npm run audit:tags' for the local DB." >&2
    exit 1
fi

# Sanity hint so you know which DB you just hit.
HOST="$(printf '%s' "$PROD_DATABASE_URL" | sed -E 's|^[^@]*@([^/:?]+).*|\1|')"
echo "→ Auditing tags on host: ${HOST}"
echo ""

# Scope the env var to this single process — don't leak into the caller's
# shell. `env -i` would strip too much (PATH etc.), so we just override.
DATABASE_URL="$PROD_DATABASE_URL" exec npx tsx scripts/audit-tags.ts
