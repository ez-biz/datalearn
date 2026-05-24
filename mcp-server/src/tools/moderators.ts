import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ModeratorPermission } from "../../../lib/admin-validation"
import { ApiError, DataLearnClient } from "../client.js"
import { toMcpError } from "../errors.js"

type Moderator = {
    id: string
    email: string
    name: string | null
    image: string | null
    role: "MODERATOR"
    createdAt: string
    moderatorPermissions: Array<{
        permission: string
        createdAt: string
        grantedBy: { id: string; name: string | null; email: string } | null
    }>
}

type Candidate = {
    id: string
    email: string
    name: string | null
    image: string | null
    role: "USER"
    createdAt: string
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

const PermissionsArray = z
    .array(ModeratorPermission)
    .max(7)
    .refine((v) => new Set(v).size === v.length, {
        message: "Duplicate moderator permissions are not allowed.",
    })

export function registerModeratorTools(
    server: McpServer,
    client: DataLearnClient
): void {
    server.tool(
        "list_moderators",
        [
            "List current moderators (users with role=MODERATOR) and their granted permissions.",
            "Optional `q` returns matching USER-role candidates (≤ 20 results) for promotion.",
            "",
            "Available permission keys: VIEW_DISCUSSION_QUEUE, HIDE_COMMENT, RESTORE_COMMENT, DISMISS_REPORT, MARK_SPAM, LOCK_PROBLEM_DISCUSSION, HIDE_PROBLEM_DISCUSSION.",
            "",
            "Response shape: { moderators: Moderator[], candidates: User[] }",
        ].join("\n"),
        { q: z.string().min(1).max(120).optional() },
        async (input) => {
            try {
                const url = new URLSearchParams()
                if (input.q) url.set("q", input.q)
                const qs = url.toString()
                const data = await client.request<{
                    moderators: Moderator[]
                    candidates: Candidate[]
                }>(
                    "GET",
                    qs
                        ? `/api/admin/moderators?${qs}`
                        : "/api/admin/moderators"
                )
                return ok(data)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )

    server.tool(
        "grant_moderator",
        [
            "Promote a USER to MODERATOR and grant the listed permissions in one call.",
            "Rejected if the target is already MODERATOR (use update_moderator_permissions instead), or is ADMIN.",
            "",
            "Permissions: array of keys from VIEW_DISCUSSION_QUEUE, HIDE_COMMENT, RESTORE_COMMENT, DISMISS_REPORT, MARK_SPAM, LOCK_PROBLEM_DISCUSSION, HIDE_PROBLEM_DISCUSSION. Pass an empty array to promote without any permissions; the user can still be tagged a moderator but won't be able to act.",
        ].join("\n"),
        {
            userId: z.string().min(1),
            permissions: PermissionsArray,
        },
        async ({ userId, permissions }) => {
            try {
                const created = await client.request<{ id: string }>(
                    "POST",
                    "/api/admin/moderators",
                    { userId, permissions }
                )
                return ok(created)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )

    server.tool(
        "update_moderator_permissions",
        [
            "Replace the full permission set for an existing moderator. Pass-then-replace semantics: the array you send is the new complete set (omitting a permission revokes it).",
            "",
            "Rejected if the target user is not currently MODERATOR (409) or is ADMIN (403).",
            "Pass an empty array to clear all permissions while keeping the MODERATOR role.",
        ].join("\n"),
        {
            id: z.string().min(1),
            permissions: PermissionsArray,
        },
        async ({ id, permissions }) => {
            try {
                const result = await client.request<{ id: string }>(
                    "PATCH",
                    `/api/admin/moderators/${encodeURIComponent(id)}`,
                    { permissions }
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

    server.tool(
        "revoke_moderator",
        [
            "Demote a moderator back to USER. Clears all moderator permissions and writes a per-permission revoke entry to the discussion moderation log.",
            "Rejected if the target is ADMIN (403) or is not currently MODERATOR (409). Returns {found:false} if no user exists at that id.",
        ].join("\n"),
        { id: z.string().min(1) },
        async ({ id }) => {
            try {
                // DELETE /api/admin/moderators/:id wraps its success body in
                // `{ data: { id, role: "USER" } }`, same as the rest of the
                // admin CRUD surface, so use `request<T>` to unwrap.
                const result = await client.request<{
                    id: string
                    role: "USER"
                }>(
                    "DELETE",
                    `/api/admin/moderators/${encodeURIComponent(id)}`
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
