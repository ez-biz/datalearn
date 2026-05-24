import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ApiKeyCreateInput } from "../../../lib/admin-validation"
import { ApiError, DataLearnClient } from "../client.js"
import { toMcpError } from "../errors.js"

type ApiKey = {
    id: string
    name: string
    prefix: string
    lastUsedAt: string | null
    expiresAt: string | null
    revokedAt: string | null
    createdAt: string
    createdBy?: { id: string; name: string | null; email: string }
}

function ok(payload: unknown) {
    return {
        content: [
            {
                type: "text" as const,
                text: JSON.stringify(payload, null, 2),
            },
        ],
    }
}

export function registerApiKeyTools(
    server: McpServer,
    client: DataLearnClient
): void {
    server.tool(
        "list_api_keys",
        [
            "List all admin API keys (active, expired, and revoked).",
            "Returns id, name, prefix (first few chars — safe to show), expiresAt, revokedAt, lastUsedAt, createdAt, createdBy.",
            "The plaintext key is NOT returned — that's only available at create-time, once.",
        ].join("\n"),
        {},
        async () => {
            try {
                const keys = await client.request<ApiKey[]>(
                    "GET",
                    "/api/admin/api-keys"
                )
                return ok(keys)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )

    server.tool(
        "create_api_key",
        [
            "Mint a new admin API key. THE PLAINTEXT KEY IS RETURNED ONCE in the `plaintext` field — the server stores only a hash. If the caller loses it, the key must be revoked and a new one created.",
            "",
            "When you return this result to the user, surface the plaintext clearly with an explicit 'save now, will not be shown again' warning.",
            "",
            "Lifetime: defaults to 90 days from creation, capped at 365 days. Pass `expiresAt` (ISO 8601 string) to override — must be in the future and within the 365-day cap.",
        ].join("\n"),
        {
            name: ApiKeyCreateInput.shape.name,
            expiresAt: z
                .string()
                .datetime({ offset: true })
                .optional()
                .describe(
                    "ISO 8601 expiry (e.g. 2026-08-22T00:00:00Z). Omit for the 90-day default."
                ),
        },
        async (input) => {
            try {
                const created = await client.request<{
                    id: string
                    name: string
                    prefix: string
                    expiresAt: string
                    createdAt: string
                    plaintext: string
                }>("POST", "/api/admin/api-keys", input)
                return ok({
                    ...created,
                    _warning:
                        "Save `plaintext` NOW — this is the only time the API server returns it. Lost keys must be revoked and replaced.",
                })
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )

    server.tool(
        "revoke_api_key",
        [
            "Revoke an API key by id. Sets revokedAt to now; the key stops authenticating immediately.",
            "Idempotent at the database level (re-revoking an already-revoked key is a 200). Returns {found:false} if no key exists at that id.",
        ].join("\n"),
        { id: z.string().min(1) },
        async ({ id }) => {
            try {
                const result = await client.requestRaw<{ ok: true }>(
                    "DELETE",
                    `/api/admin/api-keys/${encodeURIComponent(id)}`
                )
                return ok(result)
            } catch (err) {
                if (err instanceof ApiError && err.status === 404) {
                    return ok({ found: false })
                }
                throw toMcpError(err)
            }
        }
    )
}
