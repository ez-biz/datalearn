import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import {
    SlugSchema,
    TrackCreateInput,
    TrackUpdateInput,
} from "../../../lib/admin-validation"
import { ApiError, DataLearnClient } from "../client.js"
import { toMcpError } from "../errors.js"

type Track = {
    id: string
    slug: string
    name: string
    summary: string
    description?: string
    difficulty: "EASY" | "MEDIUM" | "HARD" | "MIXED"
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
    estimatedMinutes: number
    coverImageUrl: string | null
    items?: Array<{
        id: string
        position: number
        problem: {
            number: number
            slug: string
            title: string
            difficulty: "EASY" | "MEDIUM" | "HARD"
            status: "DRAFT" | "BETA" | "PUBLISHED" | "ARCHIVED"
        }
    }>
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

const TrackUpdateInputShape = {
    slug: SlugSchema,
    name: TrackUpdateInput.shape.name,
    newSlug: SlugSchema.optional(),
    summary: TrackUpdateInput.shape.summary,
    description: TrackUpdateInput.shape.description,
    difficulty: TrackUpdateInput.shape.difficulty,
    status: TrackUpdateInput.shape.status,
    estimatedMinutes: TrackUpdateInput.shape.estimatedMinutes,
    coverImageUrl: TrackUpdateInput.shape.coverImageUrl,
}

export function registerTrackTools(
    server: McpServer,
    client: DataLearnClient,
): void {
    server.tool(
        "list_tracks",
        "List all study-plan tracks with their status, difficulty, and item counts.",
        {},
        async () => {
            try {
                const tracks = await client.request<Track[]>(
                    "GET",
                    "/api/admin/tracks",
                )
                return ok(tracks)
            } catch (err) {
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "get_track",
        "Fetch one study-plan track by slug, including its ordered problem items. Returns {found:false} if no track with that slug exists.",
        { slug: SlugSchema },
        async ({ slug }) => {
            try {
                const track = await client.request<Track>(
                    "GET",
                    `/api/admin/tracks/${encodeURIComponent(slug)}`,
                )
                return ok(track)
            } catch (err) {
                if (err instanceof ApiError && err.status === 404) {
                    return ok({ found: false })
                }
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "create_track",
        "Create a study-plan track. Tracks default to DRAFT; publish deliberately after adding and reviewing items in the admin UI.",
        TrackCreateInput.shape,
        async (input) => {
            try {
                const created = await client.request<Track>(
                    "POST",
                    "/api/admin/tracks",
                    input,
                )
                return ok(created)
            } catch (err) {
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "update_track",
        "Update an existing study-plan track by slug. Use newSlug to rename the URL slug; omitted fields are left untouched.",
        TrackUpdateInputShape,
        async (input) => {
            const { slug, newSlug, ...updates } = input
            const body = {
                ...updates,
                ...(newSlug !== undefined && { slug: newSlug }),
            }
            try {
                const updated = await client.request<Track>(
                    "PATCH",
                    `/api/admin/tracks/${encodeURIComponent(slug)}`,
                    body,
                )
                return ok(updated)
            } catch (err) {
                if (err instanceof ApiError && err.status === 404) {
                    return ok({ found: false })
                }
                throw toMcpError(err)
            }
        },
    )
}
