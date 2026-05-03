import { describe, expect, it } from "vitest"
import {
    getMissingPublishedDialectMapEntries,
    ProblemCreateInput,
    ProblemUpdateInput,
} from "../../lib/admin-validation"

describe("admin validation", () => {
    it("accepts single-dialect per-dialect maps", () => {
        const parsed = ProblemCreateInput.safeParse({
            title: "DuckDB only",
            slug: "duckdb-only",
            difficulty: "EASY",
            status: "DRAFT",
            description: "Practice a DuckDB-specific function.",
            schemaId: "schema_1",
            dialects: ["DUCKDB"],
            solutions: { DUCKDB: "SELECT 1" },
            expectedOutputs: { DUCKDB: "[]" },
        })

        expect(parsed.success).toBe(true)
    })

    it("accepts partial per-dialect maps for draft updates", () => {
        const parsed = ProblemUpdateInput.safeParse({
            status: "DRAFT",
            dialects: ["DUCKDB", "POSTGRES"],
            solutions: { DUCKDB: "SELECT 1" },
            expectedOutputs: { DUCKDB: "[]" },
        })

        expect(parsed.success).toBe(true)
    })

    it("reports missing map entries for published final state", () => {
        expect(
            getMissingPublishedDialectMapEntries({
                status: "PUBLISHED",
                dialects: ["DUCKDB", "POSTGRES"],
                solutions: { DUCKDB: "SELECT 1" },
                expectedOutputs: { DUCKDB: "[]" },
            })
        ).toEqual(["solutions.POSTGRES", "expectedOutputs.POSTGRES"])
    })

    it("allows partial maps for unpublished final state", () => {
        expect(
            getMissingPublishedDialectMapEntries({
                status: "DRAFT",
                dialects: ["DUCKDB", "POSTGRES"],
                solutions: { DUCKDB: "SELECT 1" },
                expectedOutputs: { DUCKDB: "[]" },
            })
        ).toEqual([])
    })
})
