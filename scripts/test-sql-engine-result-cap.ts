import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
    DEFAULT_DISPLAY_ROW_CAP,
    applyRowCap,
    computeValidateRowCap,
    limitQueryResultForDisplay,
    toRowLimitedSql,
} from "../lib/sql-engine/result-cap"

describe("SQL engine result caps", () => {
    it("keeps rows unchanged below the cap", () => {
        const result = applyRowCap([{ id: 1 }, { id: 2 }], 3)

        assert.deepEqual(result, {
            rows: [{ id: 1 }, { id: 2 }],
            rowCount: 2,
            truncated: false,
            cap: 3,
        })
    })

    it("keeps only the visible rows and records truncation metadata", () => {
        const result = applyRowCap([{ id: 1 }, { id: 2 }, { id: 3 }], 2)

        assert.deepEqual(result, {
            rows: [{ id: 1 }, { id: 2 }],
            rowCount: 3,
            truncated: true,
            cap: 2,
        })
    })

    it("supports uncapped callers", () => {
        const rows = [{ id: 1 }, { id: 2 }, { id: 3 }]

        assert.deepEqual(applyRowCap(rows, null), {
            rows,
            rowCount: 3,
            truncated: false,
            cap: null,
        })
    })

    it("uses a 1000 row floor for validation caps", () => {
        assert.equal(computeValidateRowCap(0), DEFAULT_DISPLAY_ROW_CAP)
        assert.equal(computeValidateRowCap(10), DEFAULT_DISPLAY_ROW_CAP)
        assert.equal(computeValidateRowCap(600), 1200)
    })

    it("limits validate results for display without losing original truncation", () => {
        const result = limitQueryResultForDisplay(
            {
                rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
                rowCount: 4,
                truncated: true,
                cap: 3,
            },
            2
        )

        assert.deepEqual(result, {
            rows: [{ id: 1 }, { id: 2 }],
            rowCount: 4,
            truncated: true,
            cap: 2,
        })
    })

    it("wraps select-like statements with cap + 1 so truncation is detectable", () => {
        assert.equal(
            toRowLimitedSql("SELECT * FROM users;", 100),
            "SELECT * FROM (SELECT * FROM users) AS dl_row_cap LIMIT 101"
        )
    })

    it("leaves non-select metadata statements unwrapped", () => {
        assert.equal(toRowLimitedSql("DESCRIBE users", 100), "DESCRIBE users")
    })

    it("strips repeated trailing semicolons before wrapping", () => {
        assert.equal(
            toRowLimitedSql("SELECT 1;;", 100),
            "SELECT * FROM (SELECT 1) AS dl_row_cap LIMIT 101"
        )
        assert.equal(
            toRowLimitedSql("SELECT 1 ;  \n;\n", 100),
            "SELECT * FROM (SELECT 1 ) AS dl_row_cap LIMIT 101"
        )
    })
})
