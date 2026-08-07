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
# Raw hex literals inside className strings. The design handoff is ~200 hex
# values; pasting one instead of translating it to a token is the obvious
# failure mode, and it silently breaks the other theme.
pattern3='className=("|\{`)[^"`]*#[0-9a-fA-F]{3,8}'

# Try rg first, fall back to grep if unavailable.
violations=""
if command -v rg >/dev/null 2>&1; then
    violations=$(
        rg -n -e "$pattern1" -e "$pattern2" -e "$pattern3" \
            app components \
            --glob '!**/node_modules/**' \
            --glob '!components/shadcn/**' \
            2>/dev/null \
        || true
    )
else
    # Fallback to grep with equivalent flags.
    # grep -r: recurse, -n: line numbers, -E: extended regex
    # --include: only search these file patterns
    # --exclude-dir: skip these directories
    violations=$(
        grep -rEn \
            -e "$pattern1" -e "$pattern2" -e "$pattern3" \
            app components \
            --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
            --exclude-dir='node_modules' --exclude-dir='shadcn' \
            2>/dev/null \
        || true
    )
fi

if [ -n "$violations" ]; then
    echo "Hardcoded palette classes or hex literals found. Use semantic tokens instead."
    echo "---"
    echo "$violations"
    exit 1
fi

exit 0
