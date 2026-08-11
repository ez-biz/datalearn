// Guard: every semantic colour utility used in the app resolves to a
// --color-* variable declared in @theme inline. check:token-parity cannot
// catch this — it only diffs :root against .light, so a token that exists
// but was never mapped to a utility produces a class that silently does
// nothing. Two such classes shipped in SP3.
//
// Run: npm run check:theme-utilities

import { readFileSync, readdirSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const GLOBALS = "app/globals.css"
const SOURCE_DIRS = ["app", "components", "lib"]
const SOURCE_EXTENSIONS = [".ts", ".tsx"]
const UTILITY_RE = /\b(bg|text|border|ring|fill|stroke)-([a-z][a-z0-9-]*)\b/g

// These are Tailwind primitives or CSS-property fragments that can occur in
// arbitrary-value class strings. They do not require a project --color-*
// mapping. Keep this list explicit: an unknown colour-looking name should be
// noisy until it is either mapped or deliberately classified here.
const BUILTIN_UTILITIES = new Set([
    "bg-auto",
    "bg-black",
    "bg-bottom",
    "bg-center",
    "bg-clip-border",
    "bg-clip-content",
    "bg-clip-padding",
    "bg-clip-text",
    "bg-contain",
    "bg-cover",
    "bg-fixed",
    "bg-gradient-to-b",
    "bg-gradient-to-bl",
    "bg-gradient-to-br",
    "bg-gradient-to-l",
    "bg-gradient-to-r",
    "bg-gradient-to-t",
    "bg-gradient-to-tl",
    "bg-gradient-to-tr",
    "bg-inherit",
    "bg-left",
    "bg-local",
    "bg-none",
    "bg-origin-border",
    "bg-origin-content",
    "bg-origin-padding",
    "bg-right",
    "bg-scroll",
    "bg-top",
    "bg-transparent",
    "bg-white",
    "border-box",
    "border-collapse",
    "border-color",
    "border-dashed",
    "border-dotted",
    "border-double",
    "border-hidden",
    "border-inherit",
    "border-l",
    "border-none",
    "border-radius",
    "border-r",
    "border-separate",
    "border-solid",
    "border-t",
    "border-b",
    "border-transparent",
    "border-white",
    "fill-current",
    "fill-inherit",
    "fill-none",
    "ring-inset",
    "ring-offset-1",
    "ring-offset-2",
    "ring-transparent",
    "stroke-current",
    "stroke-inherit",
    "stroke-none",
    "text-balance",
    "text-base",
    "text-black",
    "text-center",
    "text-current",
    "text-end",
    "text-inherit",
    "text-justify",
    "text-left",
    "text-lg",
    "text-nowrap",
    "text-pretty",
    "text-right",
    "text-sm",
    "text-start",
    "text-transparent",
    "text-white",
    "text-wrap",
    "text-xl",
    "text-xs",
])
const BUILTIN_COLOR_TOKENS = new Set([
    "black",
    "current",
    "inherit",
    "transparent",
    "white",
])
const BORDER_DIRECTIONAL_SIZE = /^(?:x|y|t|r|b|l|s|e)-(?:0|2|4|8)$/

export interface SourceFile {
    path: string
    source: string
}

export interface ThemeUtilityResult {
    candidateCount: number
    findings: string[]
}

// NB: do not reach for fs.globSync — it landed in Node 22 and CI pins
// Node 20 (.github/workflows/test.yml `node-version: "20"`).
function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
        const full = join(dir, entry.name)
        if (entry.isDirectory()) walk(full, out)
        else if (SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
            out.push(full)
        }
    }
    return out
}

export function themeInlineNames(css: string): Set<string> {
    const block = css.match(/@theme\s+inline\s*\{([\s\S]*?)\n\}/)
    if (!block) throw new Error(`${GLOBALS}: no @theme inline block found`)

    const names = new Set<string>()
    for (const match of (block[1] ?? "").matchAll(/--color-([a-z0-9-]+)\s*:/g)) {
        const name = match[1]
        if (name) names.add(name)
    }
    return names
}

function mappedToken(prefix: string, suffix: string): string {
    if (prefix === "border") {
        const directional = suffix.match(/^(?:x|y|t|r|b|l|s|e)-(.+)$/)
        if (directional?.[1]) return directional[1]
    }
    if (prefix === "ring" && suffix.startsWith("offset-")) {
        return suffix.slice("offset-".length)
    }
    return suffix
}

export function findUnmappedUtilities(
    declared: Set<string>,
    files: SourceFile[],
): ThemeUtilityResult {
    const findings = new Set<string>()
    let candidateCount = 0

    for (const file of files) {
        for (const match of file.source.matchAll(UTILITY_RE)) {
            candidateCount += 1
            const [utility, prefix, suffix] = match
            if (!prefix || !suffix || BUILTIN_UTILITIES.has(utility)) continue
            if (prefix === "border" && BORDER_DIRECTIONAL_SIZE.test(suffix)) continue

            const token = mappedToken(prefix, suffix)
            if (BUILTIN_COLOR_TOKENS.has(token) || declared.has(token)) continue

            const line = file.source.slice(0, match.index).split("\n").length
            findings.add(`${file.path}:${line}  ${utility}`)
        }
    }

    return {
        candidateCount,
        findings: [...findings].sort(),
    }
}

export function runThemeUtilityCheck(): number {
    const declared = themeInlineNames(readFileSync(GLOBALS, "utf8"))
    const files = SOURCE_DIRS.flatMap((dir) => walk(dir)).map((path) => ({
        path: relative(process.cwd(), path),
        source: readFileSync(path, "utf8"),
    }))
    const result = findUnmappedUtilities(declared, files)

    if (result.candidateCount === 0) {
        console.error("No colour utility candidates found; the guard did not scan the source tree")
        return 1
    }
    for (const finding of result.findings) console.error(finding)
    return result.findings.length === 0 ? 0 : 1
}

const entry = process.argv[1]
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
    process.exitCode = runThemeUtilityCheck()
}
