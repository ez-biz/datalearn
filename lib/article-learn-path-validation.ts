import fs from "node:fs/promises"
import path from "node:path"
import type { ArticleDirectiveError } from "@/lib/admin-validation"

export type LearnFigurePathValidationResult =
    | { ok: true }
    | { ok: false; errors: ArticleDirectiveError[] }

/**
 * Verifies that every `/learn/**` figure src resolves to a regular file
 * under `public/`. Both an existence check and a type check (directories
 * must not satisfy a figure src) and a containment check (no `..`
 * traversal out of `public/`).
 *
 * Blob-backed figures are checked through the Asset table in the publish
 * validator. Repo-static figures need a filesystem check so an authored
 * `/learn/img/...` typo cannot publish into a broken production image.
 */
export async function validateLearnFigurePaths(
    urls: string[]
): Promise<LearnFigurePathValidationResult> {
    const publicDir = path.resolve(process.cwd(), "public")
    const localPaths = urls.filter((url) => url.startsWith("/learn/"))
    const errors: ArticleDirectiveError[] = []

    for (const localPath of localPaths) {
        const relativePath = localPath.replace(/^\/+/, "")
        const onDisk = path.resolve(publicDir, relativePath)
        if (!onDisk.startsWith(`${publicDir}${path.sep}`)) {
            errors.push({
                directive: "figure",
                index: -1,
                message: `figure src "${localPath}" must stay within public/`,
            })
            continue
        }

        try {
            const stats = await fs.stat(onDisk)
            if (!stats.isFile()) {
                errors.push({
                    directive: "figure",
                    index: -1,
                    message: `figure src "${localPath}" is not a regular file (got a directory or special file). Point :::figure at a committed image file.`,
                })
            }
        } catch {
            errors.push({
                directive: "figure",
                index: -1,
                message: `figure src "${localPath}" does not exist in public/. Either commit the file to public${localPath} or use an uploaded *.vercel-storage.com URL.`,
            })
        }
    }

    if (errors.length > 0) return { ok: false, errors }
    return { ok: true }
}
