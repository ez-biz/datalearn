#!/bin/sh
# UI v2 anti-regression guard: forbid hardcoded Tailwind palette classes.
# Use semantic tokens (bg-background, text-foreground, etc.) instead.

set -e

# Fail loudly if rg is unavailable (not in PATH of /bin/sh).
if ! command -v rg >/dev/null 2>&1; then
    echo "ERROR: rg (ripgrep) not found in PATH. Install ripgrep or add it to PATH."
    exit 1
fi

PALETTE='(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)'
PREFIXES='(bg|text|border|from|to|ring|fill|stroke|outline|divide|placeholder|accent)'

# Tailwind palette colors with shade numbers.
pattern1="\\b${PREFIXES}-${PALETTE}-[0-9]{2,3}\\b"
# Absolute white/black with the same prefixes.
pattern2="\\b(bg|text|border|from|to|ring|fill|stroke|outline|divide)-(white|black)\\b"
# Raw hex literals inside className strings. The design handoff is ~200 hex
# values; pasting one instead of translating it to a token is the obvious
# failure mode, and it silently breaks the other theme.
pattern3='className=("|\{`)[^"`]*#[0-9a-fA-F]{3,8}'

violations=$(
    rg -n -e "$pattern1" -e "$pattern2" -e "$pattern3" \
        app components \
        --glob '!**/node_modules/**' \
        --glob '!components/shadcn/**' \
        2>/dev/null \
    || true
)

if [ -n "$violations" ]; then
    echo "Hardcoded palette classes or hex literals found. Use semantic tokens instead."
    echo "---"
    echo "$violations"
    exit 1
fi

exit 0
