#!/bin/sh
# Verify every var(--X) reference in the component tree has a matching
# CSS declaration (^\s*--X\s*:) in app/globals.css.
# Run after shadcn add, and before commit on any token-touching change.

set -e

exit_code=0

# Tokens legitimately defined outside app/globals.css. Use whole-token matching.
ALLOWED_TOKENS=" --font-inter --font-jetbrains --gap "
# --font-inter: next/font, via inter.variable on <body> in app/layout.tsx
# --font-jetbrains: next/font, via jetbrainsMono.variable on <body> in app/layout.tsx
# --gap: Tailwind spacing mechanism, vendored components/shadcn/toggle-group.tsx

# Try rg first, fall back to grep if unavailable.
if command -v rg >/dev/null 2>&1; then
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
        case " $ALLOWED_TOKENS " in *" $token "*) continue ;; esac
        if ! rg -q "^\s*${token}\s*:" app/globals.css; then
            echo "MISSING DECLARATION: $token"
            exit_code=1
        fi
    done
else
    # Fallback to grep with equivalent flags.
    # grep -r: recurse, -h: no filename, -o: only matching, -E: extended regex
    refs=$(grep -rhoE 'var\(--[a-z0-9-]+\)' \
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
        case " $ALLOWED_TOKENS " in *" $token "*) continue ;; esac
        if ! grep -q "^\s*${token}\s*:" app/globals.css; then
            echo "MISSING DECLARATION: $token"
            exit_code=1
        fi
    done
fi

exit $exit_code
