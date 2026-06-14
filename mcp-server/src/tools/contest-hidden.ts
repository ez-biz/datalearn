import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import {
    HiddenDataPutInput,
    SlugSchema,
} from "../../../lib/admin-validation"
import { DataLearnClient } from "../client.js"
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

const SetProblemHiddenDatasetShape = {
    slug: SlugSchema,
    hiddenSchemas: HiddenDataPutInput.shape.hiddenSchemas,
    hiddenExpectedOutputs: HiddenDataPutInput.shape.hiddenExpectedOutputs,
}

export function registerContestHiddenTools(
    server: McpServer,
    client: DataLearnClient
): void {
    server.tool(
        "set_problem_hidden_dataset",
        [
            "Write hidden contest test data for a SQL problem by slug.",
            "The server validates the canonical solution against the supplied per-dialect hidden schemas and expected row arrays before persisting.",
            "Hidden test bodies are never returned by readiness checks; this write records a WRITE_HIDDEN_TEST admin audit row.",
        ].join(" "),
        SetProblemHiddenDatasetShape,
        async ({ slug, hiddenSchemas, hiddenExpectedOutputs }) => {
            try {
                const updated = await client.request(
                    "PUT",
                    `/api/admin/problems/${encodeURIComponent(slug)}/hidden-data`,
                    { hiddenSchemas, hiddenExpectedOutputs }
                )
                return ok(updated)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )
}
