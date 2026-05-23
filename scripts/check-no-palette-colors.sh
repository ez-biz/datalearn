#!/bin/sh
# UI v2 anti-regression guard: forbid hardcoded Tailwind palette classes.
# Use semantic tokens (bg-background, text-foreground, etc.) instead.

set -e

PALETTE='(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)'
PREFIXES='(bg|text|border|from|to|ring|fill|stroke|outline|divide|placeholder|accent)'

# Tailwind palette colors with shade numbers.
pattern1="\\b${PREFIXES}-${PALETTE}-[0-9]{2,3}\\b"
# Absolute white/black with the same prefixes.
pattern2="\\b(bg|text|border|from|to|ring|fill|stroke|outline|divide)-(white|black)\\b"

violations=$(
    rg -n -e "$pattern1" -e "$pattern2" \
        app components \
        --glob '!**/node_modules/**' \
        --glob '!components/shadcn/**' \
        2>/dev/null \
    || true
)

if [ -n "$violations" ]; then
    echo "Hardcoded palette classes found. Use semantic tokens instead."
    echo "---"
    echo "$violations"
    exit 1
fi

exit 0
