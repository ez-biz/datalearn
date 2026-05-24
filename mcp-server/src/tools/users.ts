import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { UserRoleSchema } from "../../../lib/admin-validation"
import { ApiError, DataLearnClient } from "../client.js"
import { toMcpError } from "../errors.js"

type User = {
    id: string
    email: string
    name: string | null
    image: string | null
    role: "USER" | "CONTRIBUTOR" | "MODERATOR" | "ADMIN"
    createdAt: string
    _count?: { articles: number }
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

// Tool-input role enum excludes ADMIN — the admin API rejects role=ADMIN
// transitions entirely (must be done via the database). Reflecting that in
// the schema gives the assistant immediate feedback instead of a runtime 403.
const AssignableRole = z.enum(["USER", "CONTRIBUTOR", "MODERATOR"])

export function registerUserTools(
    server: McpServer,
    client: DataLearnClient
): void {
    server.tool(
        "list_users",
        [
            "List users on Data Learn (sorted by role then created-at). Capped at 200 results — use `role` and/or `q` to narrow.",
            "Filters: `role` (USER | CONTRIBUTOR | MODERATOR | ADMIN), `q` (substring of email or name, case-insensitive).",
            "Response includes id, email, name, image, role, createdAt, and an article count (_count.articles).",
        ].join("\n"),
        {
            role: UserRoleSchema.optional(),
            q: z.string().min(1).max(120).optional(),
        },
        async (input) => {
            try {
                const url = new URLSearchParams()
                if (input.role) url.set("role", input.role)
                if (input.q) url.set("q", input.q)
                const qs = url.toString()
                const users = await client.request<User[]>(
                    "GET",
                    qs ? `/api/admin/users?${qs}` : "/api/admin/users"
                )
                return ok(users)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )

    server.tool(
        "update_user_role",
        [
            "Change a user's role to USER, CONTRIBUTOR, or MODERATOR.",
            "",
            "Hard restrictions enforced by the API:",
            "  - Cannot promote to or demote from ADMIN (must be done in psql). The tool schema rejects role=ADMIN.",
            "  - Cannot change your own role (the caller's role is held fixed).",
            "  - Demoting a MODERATOR clears all of their moderator permissions and writes a moderation log.",
            "  - Promoting a USER/CONTRIBUTOR to MODERATOR grants the role with NO permissions; assign permissions separately via grant_moderator or update_moderator_permissions.",
        ].join("\n"),
        {
            id: z.string().min(1),
            role: AssignableRole,
        },
        async ({ id, role }) => {
            try {
                const updated = await client.request<User>(
                    "PATCH",
                    `/api/admin/users/${encodeURIComponent(id)}`,
                    { role }
                )
                return ok(updated)
            } catch (err) {
                if (err instanceof ApiError && err.status === 404) {
                    return ok({ found: false })
                }
                throw toMcpError(err)
            }
        }
    )
}
