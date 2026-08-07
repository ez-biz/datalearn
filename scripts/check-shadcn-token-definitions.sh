#!/bin/sh
# Verify every var(--X) reference in the component tree has a matching
# CSS declaration (^\s*--X\s*:) in app/globals.css.
# Run after shadcn add, and before commit on any token-touching change.
#
# This guard must never pass vacuously. It historically did, twice: first
# because `rg` was not on PATH at all, then because the ripgrep branch used
# grep-style `-hoE` flags -- in ripgrep `-h` is --help and `-E` is --encoding,
# so rg consumed the pattern as an encoding name and errored out. With stderr
# discarded, `refs` came back empty, the loop never ran, and the script exited
# 0 with real violations present. The vacuity check below closes that hole.

set -e

exit_code=0

# Tokens legitimately defined outside app/globals.css. Whole-token matching.
ALLOWED_TOKENS=" --font-inter --font-jetbrains --gap "
# --font-inter: next/font, via inter.variable on <body> in app/layout.tsx
# --font-jetbrains: next/font, via jetbrainsMono.variable on <body> in app/layout.tsx
# --gap: Tailwind spacing mechanism, vendored components/shadcn/toggle-group.tsx

# Deliberately unquoted on use: this is a word-split list of search roots.
SEARCH_DIRS="components/shadcn components/ui components/markdown components/sql \
components/practice components/layout components/admin components/learn \
components/me components/lists components/auth app"

# Pick a search engine. CI (ubuntu-latest) has ripgrep; local dev may not.
# The two branches MUST produce identical verdicts.
if command -v rg >/dev/null 2>&1; then
    ENGINE=rg
else
    ENGINE=grep
fi

# Collect every var(--token) reference. Stderr is NOT discarded -- an engine
# error must be visible, not swallowed into a false "clean" result.
set +e
if [ "$ENGINE" = rg ]; then
    # --no-filename + --only-matching. ripgrep's default regex engine already
    # has extended-regex semantics, so there is no -E to add: `rg -E` is
    # --encoding and `rg -h` is --help. Spelling these long-form keeps the
    # grep-ism from creeping back in.
    # shellcheck disable=SC2086
    raw=$(rg --no-filename --only-matching -e 'var\(--[a-z0-9-]+\)' $SEARCH_DIRS)
    status=$?
else
    # grep -r: recurse, -h: no filename, -o: only matching, -E: extended regex.
    # shellcheck disable=SC2086
    raw=$(grep -rhoE -e 'var\(--[a-z0-9-]+\)' $SEARCH_DIRS)
    status=$?
fi
set -e

# 0 = matches found, 1 = no matches, >1 = the engine itself failed.
if [ "$status" -gt 1 ]; then
    echo "GUARD BROKEN: $ENGINE exited $status. Refusing to report a clean tree."
    exit 2
fi

refs=$(printf '%s\n' "$raw" | sed -E 's/var\((--[a-z0-9-]+)\)/\1/' | sort -u)

# Vacuity check: the component tree unconditionally references design tokens.
# Zero references means the search engine is broken, not that the tree is clean.
if [ -z "$refs" ]; then
    echo "GUARD BROKEN: $ENGINE found no var(--...) references at all."
    echo "The search invocation is wrong; this is not a clean tree."
    exit 2
fi

for token in $refs; do
    case " $ALLOWED_TOKENS " in *" $token "*) continue ;; esac
    if [ "$ENGINE" = rg ]; then
        rg -q -e "^\s*${token}\s*:" app/globals.css || {
            echo "MISSING DECLARATION: $token"
            exit_code=1
        }
    else
        grep -q -e "^\s*${token}\s*:" app/globals.css || {
            echo "MISSING DECLARATION: $token"
            exit_code=1
        }
    fi
done

exit $exit_code
