import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import path from "node:path"

type LoadableManifest = Record<string, { files?: string[] }>

const MERMAID_MANIFEST_KEYS = [
    "components/markdown/directives/Mermaid.tsx -> ./MermaidClient",
    "components/markdown/directives/MermaidClient.tsx -> mermaid",
]

function getMermaidChunkFiles() {
    const manifestPath = path.join(process.cwd(), ".next/react-loadable-manifest.json")
    const manifest = JSON.parse(
        readFileSync(manifestPath, "utf8")
    ) as LoadableManifest

    const files = MERMAID_MANIFEST_KEYS.flatMap(
        (key) => manifest[key]?.files ?? []
    )
    if (files.length === 0) {
        throw new Error("Mermaid loadable chunks were not found in the Next build.")
    }

    return files
}

const mermaidChunkFiles = getMermaidChunkFiles()

function isMermaidChunkUrl(url: string) {
    return mermaidChunkFiles.some((file) => url.includes(`/_next/${file}`))
}

test("mermaid chunk loads only on articles that use :::mermaid", async ({
    page,
}) => {
    const mermaidRequests: string[] = []
    page.on("request", (request) => {
        if (isMermaidChunkUrl(request.url())) {
            mermaidRequests.push(request.url())
        }
    })

    await page.goto("/learn")
    await page.waitForLoadState("networkidle")
    await expect(page.locator(".dl-mermaid")).toHaveCount(0)
    expect(mermaidRequests).toHaveLength(0)

    await page.goto("/learn/joins/how-a-join-works")
    await expect(page.locator(".dl-mermaid svg").first()).toBeVisible()
    expect(mermaidRequests.length).toBeGreaterThan(0)
})
