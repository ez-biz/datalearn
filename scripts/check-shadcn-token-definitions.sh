#!/bin/sh
# Verify every var(--X) reference in the component tree has a matching
# CSS declaration (^\s*--X\s*:) in app/globals.css.
# Run after shadcn add, and before commit on any token-touching change.

set -e

# Fail loudly if rg is unavailable (not in PATH of /bin/sh).
if ! command -v rg >/dev/null 2>&1; then
    echo "ERROR: rg (ripgrep) not found in PATH. Install ripgrep or add it to PATH."
    exit 1
fi

exit_code=0

refs=$(rg -hoE 'var\(--[a-z0-9-]+\)' \
    components/shadcn \
    components/ui \
    components/markdown \
    components/sql \
    components/practice \
    components/layout \
    components/admin \
    components/learn \
    components/me \
    components/lists \
    components/auth \
    app \
    2>/dev/null \
    | sed -E 's/var\((--[a-z0-9-]+)\)/\1/' \
    | sort -u)

for token in $refs; do
    if ! rg -q "^\s*${token}\s*:" app/globals.css; then
        echo "MISSING DECLARATION: $token"
        exit_code=1
    fi
done

exit $exit_code
