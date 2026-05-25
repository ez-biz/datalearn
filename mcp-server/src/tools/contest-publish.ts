import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ApiError, DataLearnClient } from "../client.js"
import { toMcpError } from "../errors.js"

type ContestForReadiness = {
    id: string
    status: string
    rated: boolean
    problems: Array<{
        position: number
        problem: {
            id: string
            slug: string
        }
    }>
}

type HiddenDataStatus = {
    dialects: string[]
    presentDialects: string[]
    validatedAt: string | null
    validationStale: boolean
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

const PublishContestShape = {
    contestId: z.string().min(20).max(40),
}

export function registerContestPublishTools(
    server: McpServer,
    client: DataLearnClient
): void {
    server.tool(
        "publish_contest",
        [
            "Validate that a scheduled contest is ready to publish.",
            "For rated contests, every attached problem must have validated, non-stale hidden test data for every dialect.",
            "This tool only reads bodies-free status endpoints and does not change contest state.",
        ].join(" "),
        PublishContestShape,
        async ({ contestId }) => {
            try {
                const contest = await client.request<ContestForReadiness>(
                    "GET",
                    `/api/admin/contests/${encodeURIComponent(contestId)}`
                )

                if (contest.status !== "SCHEDULED") {
                    return ok({
                        ready: false,
                        issues: [
                            `Contest is not SCHEDULED (status=${contest.status})`,
                        ],
                    })
                }
                if (!contest.rated) {
                    return ok({
                        ready: true,
                        note: "Unrated contest - hidden data not required.",
                    })
                }

                const issues: string[] = []
                for (const contestProblem of contest.problems) {
                    await collectProblemReadinessIssues(
                        client,
                        contestProblem,
                        issues
                    )
                }

                return ok({ ready: issues.length === 0, issues })
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )
}

async function collectProblemReadinessIssues(
    client: DataLearnClient,
    contestProblem: ContestForReadiness["problems"][number],
    issues: string[]
): Promise<void> {
    const slug = contestProblem.problem.slug
    let status: HiddenDataStatus
    try {
        status = await client.request<HiddenDataStatus>(
            "GET",
            `/api/admin/problems/${encodeURIComponent(slug)}/hidden-data/status`
        )
    } catch (err) {
        if (err instanceof ApiError) {
            issues.push(
                `Q${contestProblem.position}: failed to read hidden-data status (HTTP ${err.status})`
            )
            return
        }
        throw err
    }

    const presentDialects = new Set(status.presentDialects ?? [])
    for (const dialect of status.dialects ?? []) {
        if (!presentDialects.has(dialect)) {
            issues.push(
                `Q${contestProblem.position} (${slug}): missing hidden data for ${dialect}`
            )
        }
    }
    if (presentDialects.size > 0 && !status.validatedAt) {
        issues.push(
            `Q${contestProblem.position} (${slug}): hidden data has never been validated; re-run set_problem_hidden_dataset`
        )
    }
    if (status.validationStale) {
        issues.push(
            `Q${contestProblem.position} (${slug}): hidden data validation is stale; re-run set_problem_hidden_dataset`
        )
    }
}
