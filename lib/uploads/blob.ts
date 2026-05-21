import { del, head, put } from "@vercel/blob"

const RETRY_DELAYS_MS = [200, 1000, 5000]

export interface BlobPutResult {
    url: string
    pathname: string
}

export async function putBlob(
    key: string,
    body: Blob | ArrayBuffer | Buffer,
    contentType: string
): Promise<BlobPutResult> {
    if (
        process.env.NODE_ENV !== "production" &&
        process.env.DATALEARN_FAKE_BLOB === "1"
    ) {
        return {
            url: `https://store.vercel-storage.com/${key}`,
            pathname: key,
        }
    }

    const result = await put(key, body, {
        access: "public",
        addRandomSuffix: false,
        contentType,
    })
    return { url: result.url, pathname: result.pathname }
}

export async function delBlobWithRetry(url: string): Promise<void> {
    if (
        process.env.NODE_ENV !== "production" &&
        process.env.DATALEARN_FORCE_DEL_FAILURE === "1"
    ) {
        throw new Error("forced-del-failure")
    }
    if (
        process.env.NODE_ENV !== "production" &&
        process.env.DATALEARN_FAKE_BLOB === "1"
    ) {
        return
    }

    let lastError: unknown
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        try {
            await del(url)
            return
        } catch (error) {
            lastError = error
            const delay = RETRY_DELAYS_MS[attempt]
            if (delay) {
                await new Promise((resolve) => setTimeout(resolve, delay))
            }
        }
    }
    throw lastError
}

export async function blobExists(url: string): Promise<boolean> {
    if (
        process.env.NODE_ENV !== "production" &&
        process.env.DATALEARN_FAKE_BLOB === "1"
    ) {
        return process.env.DATALEARN_FAKE_BLOB_EXISTS === "1"
    }

    try {
        await head(url)
        return true
    } catch {
        return false
    }
}
