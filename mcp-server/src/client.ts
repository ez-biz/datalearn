export class ApiError extends Error {
    constructor(
        public readonly status: number,
        message: string,
        public readonly details?: unknown
    ) {
        super(message)
        this.name = "ApiError"
    }
}

export class DataLearnClient {
    private readonly normalizedBase: string

    constructor(
        private readonly apiKey: string,
        baseUrl: string,
        private readonly fetchImpl: typeof globalThis.fetch = globalThis.fetch
    ) {
        const url = new URL(baseUrl)
        const localhostHosts = new Set(["localhost", "127.0.0.1", "::1"])
        if (url.protocol === "http:" && !localhostHosts.has(url.hostname)) {
            throw new Error(
                `http:// only allowed for localhost; got ${baseUrl}. ` +
                    `Set DATALEARN_BASE_URL to https:// for production hosts.`
            )
        }
        // Strip trailing slash so URL joins are predictable.
        this.normalizedBase = baseUrl.replace(/\/$/, "")
    }

    async request<T>(
        method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
        path: string,
        body?: unknown
    ): Promise<T> {
        const url = `${this.normalizedBase}${path.startsWith("/") ? path : `/${path}`}`
        const res = await this.fetchImpl(url, {
            method,
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        })
        const text = await res.text()
        let parsed: unknown
        try {
            parsed = text ? JSON.parse(text) : {}
        } catch {
            parsed = { error: text || `HTTP ${res.status}` }
        }
        if (!res.ok) {
            const errBody = parsed as {
                error?: string
                details?: unknown
            }
            throw new ApiError(
                res.status,
                errBody?.error ?? `HTTP ${res.status}`,
                errBody?.details
            )
        }
        // The Next admin API consistently wraps success bodies as { data: ... };
        // void endpoints (e.g. DELETE) may return {} → callers get undefined as T.
        const okBody = parsed as { data?: T }
        return okBody.data as T
    }
}
