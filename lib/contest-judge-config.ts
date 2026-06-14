import * as fs from "node:fs"
import * as path from "node:path"

export function resolveWorkerPath(): string {
    const candidates = [
        path.resolve(process.cwd(), "dist/contest-judge-worker.cjs"),
        path.resolve(process.cwd(), ".next/standalone/dist/contest-judge-worker.cjs"),
    ]

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate
        }
    }

    throw new Error(
        `Contest judge worker artifact not found. Ran 'npm run build:contest-worker'? Searched: ${candidates.join(", ")}`
    )
}
