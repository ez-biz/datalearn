import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ApiError, DataLearnClient } from "../client.js"
import { toMcpError } from "../errors.js"

const AssetStatus = z.enum(["PENDING", "ACTIVE", "DELETING", "DELETED"])

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

export function registerAssetTools(
    server: McpServer,
    client: DataLearnClient
): void {
    server.tool(
        "list_assets",
        [
            "List uploaded assets (figure images stored in Vercel Blob).",
            "Filters: status (PENDING | ACTIVE | DELETING | DELETED), ownerId (user id), limit (1–200, default 50).",
            "Most recent first. Returns id, ownerId, blobUrl, contentType, bytes, status, deletedAt, deletionAttempts, lastDeletionError, createdAt.",
        ].join("\n"),
        {
            status: AssetStatus.optional(),
            ownerId: z.string().min(1).optional(),
            limit: z.coerce.number().int().min(1).max(200).optional(),
        },
        async (input) => {
            try {
                const url = new URLSearchParams()
                if (input.status) url.set("status", input.status)
                if (input.ownerId) url.set("ownerId", input.ownerId)
                if (input.limit) url.set("limit", String(input.limit))
                const qs = url.toString()
                const result = await client.requestRaw<{ items: unknown[] }>(
                    "GET",
                    qs ? `/api/admin/assets?${qs}` : "/api/admin/assets"
                )
                return ok(result)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )

    server.tool(
        "delete_asset",
        [
            "Delete an ACTIVE asset. Marks it for blob deletion, strips :::figure references from any article that uses it, and snapshots an immutable version of any PUBLISHED article that was touched.",
            "",
            "Rejected if the asset is not ACTIVE (409) — already DELETING/DELETED assets can't be re-deleted.",
            "Returns {found:false} if no asset exists at that id.",
            "",
            "Heads-up: this can edit live articles. If the asset is referenced by a PUBLISHED article, the figure is stripped and a new version is snapshotted.",
        ].join("\n"),
        { id: z.string().min(1) },
        async ({ id }) => {
            try {
                const result = await client.requestRaw<unknown>(
                    "DELETE",
                    `/api/admin/assets/${encodeURIComponent(id)}`
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
