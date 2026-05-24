import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const source = readFileSync(new URL("./mcp-e2e-test.mjs", import.meta.url), "utf8")

test("mcp e2e harness does not log test-created API key identifiers", () => {
    const sensitiveLog = /console\.(?:log|error|warn)\s*\([^)]*testCreatedApiKeyId/s

    assert.equal(
        sensitiveLog.test(source),
        false,
        "testCreatedApiKeyId must not flow into console output"
    )
})
