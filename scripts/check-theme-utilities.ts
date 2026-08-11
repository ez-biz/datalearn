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
import * as ts from "typescript"

const GLOBALS = "app/globals.css"
const SOURCE_DIRS = ["app", "components", "lib"]
const SOURCE_EXTENSIONS = [".ts", ".tsx"]
const UTILITY_TOKEN_RE = /^(bg|text|border|ring|fill|stroke)-([a-z][a-z0-9-]*)(?:\/\S+)?$/
const CLASS_HELPERS = new Set(["cn", "clsx", "cva", "twMerge"])
const CLASS_CONTAINER_NAME = /class|style|variant|color|tone/i

// These Tailwind primitives resemble colour utilities but do not require a
// project --color-* mapping. Keep this list explicit: an unknown
// colour-looking class should be noisy until it is mapped or deliberately
// classified here.
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
    "border-collapse",
    "border-dashed",
    "border-dotted",
    "border-double",
    "border-hidden",
    "border-inherit",
    "border-l",
    "border-none",
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

interface ClassFragment {
    line: number
    text: string
}

interface UtilityToken {
    index: number
    prefix: string
    suffix: string
    utility: string
}

function utilityTokens(text: string): UtilityToken[] {
    const tokens: UtilityToken[] = []
    for (const match of text.matchAll(/\S+/g)) {
        const raw = match[0]
        const base = (raw.split(":").at(-1) ?? raw).replace(/^!/, "")
        const utility = base.match(UTILITY_TOKEN_RE)
        if (!utility?.[1] || !utility[2]) continue
        tokens.push({
            index: match.index,
            prefix: utility[1],
            suffix: utility[2],
            utility: base,
        })
    }
    return tokens
}

function literalText(node: ts.Node): string | null {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        return node.text
    }
    if (
        node.kind === ts.SyntaxKind.TemplateHead ||
        node.kind === ts.SyntaxKind.TemplateMiddle ||
        node.kind === ts.SyntaxKind.TemplateTail
    ) {
        return (node as ts.TemplateLiteralToken).text
    }
    return null
}

function expressionName(expression: ts.Expression): string | null {
    if (ts.isIdentifier(expression)) return expression.text
    if (ts.isPropertyAccessExpression(expression)) return expression.name.text
    return null
}

function isClassContext(node: ts.Node, sourceFile: ts.SourceFile): boolean {
    let parent = node.parent
    while (parent) {
        if (
            ts.isJsxAttribute(parent) &&
            parent.name.getText(sourceFile) === "className"
        ) {
            return true
        }
        if (
            ts.isCallExpression(parent) &&
            CLASS_HELPERS.has(expressionName(parent.expression) ?? "")
        ) {
            return true
        }
        if (
            ts.isVariableDeclaration(parent) &&
            ts.isIdentifier(parent.name) &&
            CLASS_CONTAINER_NAME.test(parent.name.text)
        ) {
            return true
        }
        if (ts.isPropertyAssignment(parent)) {
            const name = parent.name.getText(sourceFile).replace(/["']/g, "")
            if (name === "class" || name === "className") return true
        }
        parent = parent.parent
    }
    return false
}

function classFragments(file: SourceFile): ClassFragment[] {
    const sourceFile = ts.createSourceFile(
        file.path,
        file.source,
        ts.ScriptTarget.Latest,
        true,
        file.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )
    const fragments: ClassFragment[] = []

    function visit(node: ts.Node): void {
        const text = literalText(node)
        if (text !== null) {
            const candidates = utilityTokens(text)
            const singleUtility =
                candidates.length === 1 && text.trim() === candidates[0]?.utility
            const classContext = isClassContext(node, sourceFile)
            if (candidates.length > 0 && (singleUtility || classContext)) {
                fragments.push({
                    line:
                        sourceFile.getLineAndCharacterOfPosition(
                            node.getStart(sourceFile),
                        ).line + 1,
                    text,
                })
            }
        }
        ts.forEachChild(node, visit)
    }

    visit(sourceFile)
    return fragments
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
        for (const fragment of classFragments(file)) {
            for (const candidate of utilityTokens(fragment.text)) {
                const { utility, prefix, suffix } = candidate
                if (BUILTIN_UTILITIES.has(utility)) continue
                if (
                    prefix === "border" &&
                    BORDER_DIRECTIONAL_SIZE.test(suffix)
                ) {
                    continue
                }

                const semanticToken = mappedToken(prefix, suffix)
                if (BUILTIN_COLOR_TOKENS.has(semanticToken)) continue

                candidateCount += 1
                if (declared.has(semanticToken)) continue

                const line =
                    fragment.line +
                    fragment.text.slice(0, candidate.index).split("\n").length -
                    1
                findings.add(`${file.path}:${line}  ${utility}`)
            }
        }
    }

    return {
        candidateCount,
        findings: [...findings].sort(),
    }
}

export function runThemeUtilityCheck(sourceRoot = process.cwd()): number {
    const root = resolve(sourceRoot)
    const declared = themeInlineNames(readFileSync(join(root, GLOBALS), "utf8"))
    const files = SOURCE_DIRS.flatMap((dir) => walk(join(root, dir))).map(
        (path) => ({
            path: relative(root, path),
            source: readFileSync(path, "utf8"),
        }),
    )
    const result = findUnmappedUtilities(declared, files)

    if (result.candidateCount === 0) {
        console.error(
            "No colour utility candidates found; the guard did not scan the source tree",
        )
        return 1
    }
    for (const finding of result.findings) console.error(finding)
    return result.findings.length === 0 ? 0 : 1
}

const entry = process.argv[1]
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
    const rootFlag = process.argv.indexOf("--root")
    const sourceRoot = rootFlag === -1 ? process.cwd() : process.argv[rootFlag + 1]
    if (!sourceRoot) {
        console.error("--root requires a source directory")
        process.exitCode = 2
    } else {
        process.exitCode = runThemeUtilityCheck(sourceRoot)
    }
}
