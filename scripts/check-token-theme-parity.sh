#!/bin/sh
# Both themes ship and light is NOT an inversion of dark, so a token declared
# in one block and forgotten in the other fails silently — it looks broken
# only to users on that theme. Compare the two declaration sets directly.
#
# Run: npm run check:token-parity

set -e

CSS="app/globals.css"

# Deliberately theme-invariant: declared once in :root, inherited unchanged.
THEME_INVARIANT="--radius"

extract() {
    # $1 = selector regex. Pull `--token:` names from the brace block it opens.
    awk "/^$1 \{/,/^\}/" "$CSS" \
        | grep -oE '^[[:space:]]*--[a-z0-9-]+[[:space:]]*:' \
        | sed -E 's/^[[:space:]]*(--[a-z0-9-]+)[[:space:]]*:/\1/' \
        | sort -u
}

root=$(extract ':root')
light=$(extract '\.light')

if [ -z "$root" ] || [ -z "$light" ]; then
    echo "Could not extract token blocks from $CSS — check the selectors."
    exit 1
fi

exit_code=0

for token in $root; do
    case " $THEME_INVARIANT " in *" $token "*) continue ;; esac
    if ! echo "$light" | grep -qx -- "$token"; then
        echo "MISSING IN .light: $token"
        exit_code=1
    fi
done

for token in $light; do
    case " $THEME_INVARIANT " in *" $token "*) continue ;; esac
    if ! echo "$root" | grep -qx -- "$token"; then
        echo "MISSING IN :root: $token"
        exit_code=1
    fi
done

exit $exit_code
