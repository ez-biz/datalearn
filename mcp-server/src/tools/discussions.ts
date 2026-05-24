import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import {
    DiscussionSettingsUpdateInput,
    ProblemDiscussionMode,
    SlugSchema,
} from "../../../lib/admin-validation"
import { ApiError, DataLearnClient } from "../client.js"
import { toMcpError } from "../errors.js"

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

export function registerDiscussionTools(
    server: McpServer,
    client: DataLearnClient
): void {
    server.tool(
        "list_moderation_queue",
        [
            "Fetch the discussion moderation queue. Returns four buckets plus the current report threshold:",
            "  - needsReview: VISIBLE comments above the reportThreshold",
            "  - hidden: comments currently hidden by a moderator",
            "  - spam: comments flagged as spam",
            "  - dismissedReports: comments whose open reports were dismissed (audit view)",
            "",
            "Each bucket is capped at 100 entries. Requires VIEW_DISCUSSION_QUEUE moderator permission on the calling key.",
        ].join("\n"),
        {},
        async () => {
            try {
                const result = await client.requestRaw<{
                    data: {
                        needsReview: unknown[]
                        hidden: unknown[]
                        dismissedReports: unknown[]
                        spam: unknown[]
                    }
                    settings: { reportThreshold: number }
                }>("GET", "/api/admin/discussions")
                return ok(result)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )

    server.tool(
        "hide_comment",
        [
            "Hide a VISIBLE discussion comment from learners. Soft action — content is preserved, status flips to HIDDEN.",
            "Requires HIDE_COMMENT moderator permission. Rejected if the comment is not currently VISIBLE.",
            "Returns {found:false} if no comment exists at that id.",
        ].join("\n"),
        { commentId: z.string().min(1) },
        async ({ commentId }) => {
            try {
                const result = await client.requestRaw<unknown>(
                    "POST",
                    `/api/admin/discussions/${encodeURIComponent(commentId)}/hide`
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
        "restore_comment",
        [
            "Restore a HIDDEN or SPAM comment back to VISIBLE.",
            "Requires RESTORE_COMMENT moderator permission. Rejected if the comment is not HIDDEN or SPAM.",
            "Returns {found:false} if no comment exists at that id.",
        ].join("\n"),
        { commentId: z.string().min(1) },
        async ({ commentId }) => {
            try {
                const result = await client.requestRaw<unknown>(
                    "POST",
                    `/api/admin/discussions/${encodeURIComponent(commentId)}/restore`
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
        "mark_comment_spam",
        [
            "Flag a VISIBLE or HIDDEN comment as SPAM. Stronger than hide — affects user trust scoring.",
            "Requires MARK_SPAM moderator permission. Rejected if the comment is not VISIBLE or HIDDEN.",
            "Returns {found:false} if no comment exists at that id.",
        ].join("\n"),
        { commentId: z.string().min(1) },
        async ({ commentId }) => {
            try {
                const result = await client.requestRaw<unknown>(
                    "POST",
                    `/api/admin/discussions/${encodeURIComponent(commentId)}/mark-spam`
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
        "dismiss_comment_reports",
        [
            "Mark all OPEN reports against a comment as DISMISSED — false-positive flags.",
            "Requires DISMISS_REPORT moderator permission. Rejected if the comment is DELETED.",
            "Returns {found:false} if no comment exists at that id.",
        ].join("\n"),
        { commentId: z.string().min(1) },
        async ({ commentId }) => {
            try {
                const result = await client.requestRaw<unknown>(
                    "POST",
                    `/api/admin/discussions/${encodeURIComponent(commentId)}/dismiss-reports`
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
        "update_discussion_settings",
        [
            "Update global discussion settings (admin-only — moderator role is not sufficient).",
            "",
            "Available fields (all optional — pass only what you want to change):",
            "  - globalEnabled (boolean): kill-switch for the entire discussion feature",
            "  - reportThreshold (1–100): how many reports auto-flag a comment into needsReview",
            "  - editWindowMinutes (1–1440): how long after posting an author can edit",
            "",
            "Returns the full resolved settings object.",
        ].join("\n"),
        {
            globalEnabled: DiscussionSettingsUpdateInput.shape.globalEnabled,
            reportThreshold:
                DiscussionSettingsUpdateInput.shape.reportThreshold,
            editWindowMinutes:
                DiscussionSettingsUpdateInput.shape.editWindowMinutes,
        },
        async (input) => {
            try {
                const result = await client.requestRaw<unknown>(
                    "PATCH",
                    "/api/admin/discussions/settings",
                    input
                )
                return ok(result)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )

    server.tool(
        "set_problem_discussion_mode",
        [
            "Lock or hide discussions on a specific problem. Affects whether learners can post / read on that problem's discussion tab.",
            "",
            "Modes:",
            "  - OPEN: default — anyone can post and read",
            "  - LOCKED: existing comments remain visible, no new posts (LOCK_PROBLEM_DISCUSSION permission)",
            "  - HIDDEN: comments hidden from learners, no new posts (HIDE_PROBLEM_DISCUSSION permission)",
            "",
            "Returns {found:false} if no problem exists at that slug.",
        ].join("\n"),
        {
            problemSlug: SlugSchema,
            mode: ProblemDiscussionMode,
        },
        async ({ problemSlug, mode }) => {
            try {
                const result = await client.requestRaw<unknown>(
                    "PATCH",
                    "/api/admin/discussions/problem-mode",
                    { problemSlug, mode }
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
