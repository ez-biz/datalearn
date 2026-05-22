import { constants } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import type { ArticleDirectiveError } from "@/lib/admin-validation"

export type LearnFigurePathValidationResult =
    | { ok: true; hasVisualBlocks: false }
    | { ok: false; errors: ArticleDirectiveError[] }

/**
 * Verifies that every `/learn/**` figure src has a backing file in `public/`.
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
                message: `figure src "${localPath}" must stay within public/.`,
            })
            continue
        }

        try {
            await fs.access(onDisk, constants.R_OK)
        } catch {
            errors.push({
                directive: "figure",
                index: -1,
                message: `figure src "${localPath}" does not exist in public/. Either commit the file to public${localPath} or use an uploaded *.vercel-storage.com URL.`,
            })
        }
    }

    if (errors.length > 0) return { ok: false, errors }
    return { ok: true, hasVisualBlocks: false }
}
