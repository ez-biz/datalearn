#!/bin/sh
# UI v2 anti-regression guard: forbid hardcoded Tailwind palette classes and
# raw hex colour literals. Use semantic tokens (bg-background, text-foreground,
# etc.) instead.
#
# This guard must never pass vacuously. It historically did: `rg` was not on
# PATH, stderr went to /dev/null, and an empty result read as "clean tree".
# Two defences now exist -- an engine exit-status check, and a canary
# self-test that proves every pattern still matches a known violation before
# the tree is scanned at all.

set -e

PALETTE='(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)'
PREFIXES='(bg|text|border|from|to|ring|fill|stroke|outline|divide|placeholder|accent)'

# Tailwind palette colors with shade numbers.
pattern1="\\b${PREFIXES}-${PALETTE}-[0-9]{2,3}\\b"
# Absolute white/black with the same prefixes.
pattern2="\\b(bg|text|border|from|to|ring|fill|stroke|outline|divide)-(white|black)\\b"
# Raw hex literals inside a className string that opens with a quote or a
# template literal. The design handoff is ~200 hex values; pasting one instead
# of translating it to a token is the obvious failure mode, and it silently
# breaks the other theme.
pattern3='className=("|\{`)[^"`]*#[0-9a-fA-F]{3,8}'
# Hex colours inside a Tailwind arbitrary-value bracket, anywhere on the line:
# `bg-[#0B0B0E]`, `shadow-[0_0_0_1px_#0B0B0E]`. This is position-independent,
# so it also covers class strings assembled by cn() / clsx() / cva(), which
# pattern3 cannot see -- pattern3 anchors on `className=` followed immediately
# by a quote, so a hex in the second argument of `className={cn("a", "b")}` is
# invisible to it.
#
# Precision: the prefix character class deliberately excludes `]`, both quote
# characters and `#`, so array indexing (`items[0]`), regex character classes
# (`/[#0-9a-f]/`) and fragment hrefs (`href="#anchor"`) cannot bridge into a
# match. Verified against every `#`-bearing line in app/ and components/.
pattern4='\[[a-zA-Z0-9_,.%()/+ -]*#[0-9a-fA-F]{3,8}'
# Bare hex inside a quoted argument of a cn(...) call. `[^)]*` cannot cross the
# closing paren, so the match is confined to the call itself.
pattern5='cn\([^)]*["`][^"`]*#[0-9a-fA-F]{3,8}'

# Pick a search engine. CI (ubuntu-latest) has ripgrep; local dev may not.
# The two branches MUST produce identical verdicts -- same file scoping, same
# patterns, same extended-regex semantics.
if command -v rg >/dev/null 2>&1; then
    ENGINE=rg
else
    ENGINE=grep
fi

# Match a single pattern against stdin, quietly, using the selected engine.
# ripgrep needs no "extended regex" flag; its default engine already provides
# those semantics. `rg -E` is --encoding, NOT --extended-regexp.
match_stdin() {
    if [ "$ENGINE" = rg ]; then
        rg -q -e "$1"
    else
        grep -Eq -e "$1"
    fi
}

# Canary self-test: every pattern must match a line that is a known violation.
# A guard that cannot match a known violation is worse than no guard at all.
selftest() {
    if printf '%s\n' "$2" | match_stdin "$1"; then
        return 0
    fi
    echo "GUARD BROKEN ($ENGINE): pattern failed its canary."
    echo "  pattern: $1"
    echo "  canary:  $2"
    exit 2
}

selftest "$pattern1" 'bg-slate-800'
selftest "$pattern2" 'text-white'
selftest "$pattern3" 'className="bg-[#0B0B0E]"'
selftest "$pattern4" 'shadow-[0_0_0_1px_#0B0B0E]'
selftest "$pattern5" 'cn("flex", "#0B0B0E")'

# Scan the tree. Note stderr is NOT discarded -- an engine error must be
# visible, not swallowed into a false "clean" result.
set +e
if [ "$ENGINE" = rg ]; then
    violations=$(
        rg -n -e "$pattern1" -e "$pattern2" -e "$pattern3" \
            -e "$pattern4" -e "$pattern5" \
            app components \
            --glob '*.ts' --glob '*.tsx' --glob '*.js' --glob '*.jsx' \
            --glob '!**/node_modules/**' \
            --glob '!components/shadcn/**'
    )
    status=$?
else
    # grep -r: recurse, -n: line numbers, -E: extended regex.
    # --include mirrors rg's whitelist globs; --exclude-dir mirrors its
    # negated globs.
    violations=$(
        grep -rEn \
            -e "$pattern1" -e "$pattern2" -e "$pattern3" \
            -e "$pattern4" -e "$pattern5" \
            app components \
            --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
            --exclude-dir='node_modules' --exclude-dir='shadcn'
    )
    status=$?
fi
set -e

# 0 = matches found, 1 = no matches, >1 = the engine itself failed.
if [ "$status" -gt 1 ]; then
    echo "GUARD BROKEN: $ENGINE exited $status. Refusing to report a clean tree."
    exit 2
fi

if [ -n "$violations" ]; then
    echo "Hardcoded palette classes or hex literals found. Use semantic tokens instead."
    echo "---"
    echo "$violations"
    exit 1
fi

exit 0
