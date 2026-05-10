import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { splitSqlStatements } from "../lib/sql-engine/statements.ts"

describe("splitSqlStatements", () => {
    it("splits semicolon-terminated schema statements", () => {
        assert.deepEqual(
            splitSqlStatements(`
                CREATE TABLE users (id INTEGER);
                INSERT INTO users VALUES (1);
            `),
            [
                "CREATE TABLE users (id INTEGER)",
                "INSERT INTO users VALUES (1)",
            ]
        )
    })

    it("ignores whitespace-only fragments", () => {
        assert.deepEqual(splitSqlStatements("  ;\n\n SELECT 1;  "), ["SELECT 1"])
    })
})
