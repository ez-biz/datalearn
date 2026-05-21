import { build } from "esbuild"
import { resolve } from "node:path"

const ENTRY = resolve(process.cwd(), "mcp-server/src/index.ts")
const FORBIDDEN_PATTERNS: RegExp[] = [
    /^@prisma\/client$/,
    /^next\/server$/,
    /^next\/headers$/,
    /lib\/prisma/,
    /actions\/article-publish-validation/,
]

async function main() {
    const result = await build({
        entryPoints: [ENTRY],
        bundle: true,
        platform: "node",
        packages: "external",
        write: false,
        metafile: true,
        format: "esm",
        logLevel: "silent",
    })

    const inputs = Object.keys(result.metafile.inputs)
    const outputImports = Object.values(result.metafile.outputs).flatMap(
        (output) => output.imports.map((imported) => imported.path)
    )
    const scanned = [...new Set([...inputs, ...outputImports])]
    const violations = scanned.filter((input) =>
        FORBIDDEN_PATTERNS.some((pattern) => pattern.test(input))
    )

    if (violations.length > 0) {
        console.error(
            "MCP bundle isolation VIOLATED: forbidden modules in import graph:"
        )
        for (const violation of violations) {
            console.error(`  - ${violation}`)
        }
        process.exit(1)
    }

    console.log(
        `check-mcp-bundle-isolation PASS (${scanned.length} modules scanned)`
    )
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
