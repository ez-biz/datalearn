// Unit tests for lib/schema-parser.ts using node:test (built-in, zero deps).
// Run: `node --import tsx --test scripts/test-schema-parser.mjs`
// (tsx is already in devDeps for prisma seed; this leverages it for the .ts import)

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { parseSchema } from "../lib/schema-parser"

describe("parseSchema", () => {
    it("parses a single table with all-numeric INSERTs", () => {
        const sql = `
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                name VARCHAR,
                role VARCHAR
            );
            INSERT INTO users VALUES (1, 'Alice', 'Engineer');
            INSERT INTO users VALUES (2, 'Bob', 'Sales');
        `
        const result = parseSchema(sql)
        assert.equal(result?.length, 1)
        const t = result![0]
        assert.equal(t.name, "users")
        assert.deepEqual(t.columns, [
            { name: "id", type: "INTEGER" },
            { name: "name", type: "VARCHAR" },
            { name: "role", type: "VARCHAR" },
        ])
        assert.equal(t.sampleRows.length, 2)
        assert.deepEqual(t.sampleRows[0], { id: 1, name: "Alice", role: "Engineer" })
        assert.deepEqual(t.sampleRows[1], { id: 2, name: "Bob", role: "Sales" })
    })

    it("handles VARCHAR(N), DOUBLE, DATE columns", () => {
        const sql = `
            CREATE TABLE t (
                id INTEGER,
                name VARCHAR(120),
                price DOUBLE,
                hire_date DATE
            );
            INSERT INTO t VALUES (1, 'Widget', 9.99, '2024-03-01');
        `
        const result = parseSchema(sql)
        assert.equal(result?.length, 1)
        const t = result![0]
        assert.equal(t.columns[1].type, "VARCHAR(120)")
        assert.equal(t.columns[2].type, "DOUBLE")
        assert.equal(t.columns[3].type, "DATE")
        assert.deepEqual(t.sampleRows[0], {
            id: 1,
            name: "Widget",
            price: 9.99,
            hire_date: "2024-03-01",
        })
    })

    it("handles multiple tables in one schema (seed shape)", () => {
        const sql = `
            CREATE TABLE a (id INTEGER);
            CREATE TABLE b (id INTEGER, fk INTEGER);
            INSERT INTO a VALUES (1);
            INSERT INTO b VALUES (10, 1);
            INSERT INTO b VALUES (11, 1);
        `
        const result = parseSchema(sql)
        assert.equal(result?.length, 2)
        assert.equal(result![0].name, "a")
        assert.equal(result![1].name, "b")
        assert.equal(result![0].sampleRows.length, 1)
        assert.equal(result![1].sampleRows.length, 2)
    })

    it("handles NULL literals", () => {
        const sql = `
            CREATE TABLE t (id INTEGER, manager_id INTEGER);
            INSERT INTO t VALUES (1, NULL);
        `
        const result = parseSchema(sql)
        assert.equal(result![0].sampleRows[0].manager_id, null)
    })

    it("handles escaped single quotes in strings", () => {
        const sql = `
            CREATE TABLE t (id INTEGER, name VARCHAR);
            INSERT INTO t VALUES (1, 'O''Brien');
        `
        const result = parseSchema(sql)
        assert.equal(result![0].sampleRows[0].name, "O'Brien")
    })

    it("handles negative + decimal + scientific numerics", () => {
        const sql = `
            CREATE TABLE t (a INTEGER, b DOUBLE, c DOUBLE);
            INSERT INTO t VALUES (-3, 0.5, 1.5e2);
        `
        const result = parseSchema(sql)
        assert.deepEqual(result![0].sampleRows[0], { a: -3, b: 0.5, c: 150 })
    })

    it("strips line and block SQL comments", () => {
        const sql = `
            -- this is a leading line comment
            /* block comment
               spanning lines */
            CREATE TABLE t (id INTEGER); -- trailing comment
            INSERT INTO t VALUES (1); /* another */ -- final
        `
        const result = parseSchema(sql)
        assert.equal(result?.length, 1)
        assert.equal(result![0].sampleRows.length, 1)
    })

    it("ignores table-level PRIMARY KEY / FOREIGN KEY constraints", () => {
        const sql = `
            CREATE TABLE t (
                id INTEGER,
                fk INTEGER,
                PRIMARY KEY (id),
                FOREIGN KEY (fk) REFERENCES other(id)
            );
        `
        const result = parseSchema(sql)
        assert.equal(result![0].columns.length, 2)
        assert.equal(result![0].columns[0].name, "id")
        assert.equal(result![0].columns[1].name, "fk")
    })

    it("strips PRIMARY KEY / NOT NULL modifiers from inline column types", () => {
        const sql = `
            CREATE TABLE t (
                id INTEGER PRIMARY KEY,
                name VARCHAR NOT NULL
            );
        `
        const result = parseSchema(sql)
        assert.equal(result![0].columns[0].type, "INTEGER")
        assert.equal(result![0].columns[1].type, "VARCHAR")
    })

    it("caps sample rows per table at SAMPLE_ROW_LIMIT (8)", () => {
        const inserts = Array.from(
            { length: 20 },
            (_, i) => `INSERT INTO t VALUES (${i});`
        ).join("\n")
        const sql = `CREATE TABLE t (id INTEGER); ${inserts}`
        const result = parseSchema(sql)
        assert.equal(result![0].sampleRows.length, 8)
    })

    it("returns null on empty / whitespace input", () => {
        assert.equal(parseSchema(""), null)
        assert.equal(parseSchema("   \n  "), null)
        assert.equal(parseSchema(null), null)
        assert.equal(parseSchema(undefined), null)
    })

    it("returns null when no CREATE TABLE found (forces fallback)", () => {
        assert.equal(parseSchema("INSERT INTO foo VALUES (1);"), null)
    })

    it("returns null when INSERT arity doesn't match column count (forces fallback)", () => {
        const sql = `
            CREATE TABLE t (a INTEGER, b INTEGER);
            INSERT INTO t VALUES (1);
        `
        assert.equal(parseSchema(sql), null)
    })

    it("honors explicit (col, ...) list on INSERT", () => {
        const sql = `
            CREATE TABLE t (a INTEGER, b INTEGER, c INTEGER);
            INSERT INTO t (a, c) VALUES (1, 3);
        `
        const result = parseSchema(sql)
        assert.deepEqual(result![0].sampleRows[0], { a: 1, c: 3 })
    })

    it("parses the actual seed-data ECOMMERCE_SCHEMA shape", async () => {
        const { ECOMMERCE_SCHEMA } = await import("../lib/seed-data")
        const result = parseSchema(ECOMMERCE_SCHEMA)
        assert.ok(result, "parser should succeed on the bundled seed")
        const tableNames = result!.map((t) => t.name).sort()
        assert.deepEqual(tableNames, [
            "customers",
            "order_items",
            "orders",
            "products",
        ])
        const customers = result!.find((t) => t.name === "customers")!
        assert.deepEqual(customers.columns.map((c) => c.name), [
            "customer_id",
            "name",
            "email",
            "country",
        ])
        assert.deepEqual(customers.sampleRows[0], {
            customer_id: 1,
            name: "John Doe",
            email: "john@example.com",
            country: "USA",
        })
    })

    it("parses the actual seed-data HR_SCHEMA shape", async () => {
        const { HR_SCHEMA } = await import("../lib/seed-data-hr")
        const result = parseSchema(HR_SCHEMA)
        assert.ok(result)
        const tableNames = result!.map((t) => t.name).sort()
        assert.deepEqual(tableNames, ["departments", "employees", "salaries"])
    })
})
