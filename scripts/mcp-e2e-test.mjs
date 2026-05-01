#!/usr/bin/env node
// End-to-end smoke test for the MCP server.
// 1. Seed a temporary API key in the dev DB.
// 2. Spawn the MCP server with that key.
// 3. Send JSON-RPC over stdio for each of the 9 tools.
// 4. Revoke the key.

import "dotenv/config"
import { spawn } from "node:child_process"
import { createHmac, randomBytes } from "node:crypto"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const ADMIN_EMAIL = "anchitgupt2012@gmail.com"
const BASE_URL = "http://localhost:3000"

function hashApiKey(plaintext) {
    const secret = process.env.API_KEY_HASH_SECRET
    if (!secret) {
        throw new Error(
            "API_KEY_HASH_SECRET env var is required (matches lib/api-auth.ts)"
        )
    }
    return createHmac("sha256", secret).update(plaintext).digest("hex")
}

function generateKey() {
    const bytes = randomBytes(32).toString("base64url")
    return `dl_live_${bytes}`
}

async function seedKey() {
    const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })
    if (!admin) throw new Error(`No admin user with email ${ADMIN_EMAIL}`)
    const plaintext = generateKey()
    const keyHash = hashApiKey(plaintext)
    const apiKey = await prisma.apiKey.create({
        data: {
            keyHash,
            prefix: plaintext.slice(0, 12),
            name: "MCP E2E test (auto-revoked)",
            createdById: admin.id,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
    })
    return { plaintext, keyId: apiKey.id }
}

async function revokeKey(keyId) {
    await prisma.apiKey.update({
        where: { id: keyId },
        data: { revokedAt: new Date() },
    })
}

class McpClient {
    constructor(child) {
        this.child = child
        this.buffer = ""
        this.pending = new Map()
        this.nextId = 1
        child.stdout.setEncoding("utf-8")
        child.stdout.on("data", (chunk) => {
            this.buffer += chunk
            let nl
            while ((nl = this.buffer.indexOf("\n")) >= 0) {
                const line = this.buffer.slice(0, nl).trim()
                this.buffer = this.buffer.slice(nl + 1)
                if (!line) continue
                try {
                    const msg = JSON.parse(line)
                    if (msg.id != null && this.pending.has(msg.id)) {
                        const { resolve } = this.pending.get(msg.id)
                        this.pending.delete(msg.id)
                        resolve(msg)
                    }
                } catch (e) {
                    console.error("[harness] non-JSON line on stdout:", line)
                }
            }
        })
        child.stderr.setEncoding("utf-8")
        child.stderr.on("data", (chunk) => {
            process.stderr.write(`[mcp-stderr] ${chunk}`)
        })
    }

    async request(method, params = {}) {
        const id = this.nextId++
        const msg = { jsonrpc: "2.0", id, method, params }
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject })
            this.child.stdin.write(JSON.stringify(msg) + "\n")
            setTimeout(() => {
                if (this.pending.has(id)) {
                    this.pending.delete(id)
                    reject(new Error(`timeout for ${method}`))
                }
            }, 10000)
        })
    }

    notify(method, params = {}) {
        const msg = { jsonrpc: "2.0", method, params }
        this.child.stdin.write(JSON.stringify(msg) + "\n")
    }

    async callTool(name, args = {}) {
        return this.request("tools/call", { name, arguments: args })
    }
}

function logResult(label, result) {
    if (result.error) {
        console.log(`  ✗ ${label}: ERROR ${JSON.stringify(result.error)}`)
        return false
    }
    const content = result.result?.content?.[0]?.text ?? "(no content)"
    const preview = content.length > 120 ? content.slice(0, 120) + "..." : content
    console.log(`  ✓ ${label}: ${preview.replace(/\n/g, " ")}`)
    return true
}

async function main() {
    console.log("[harness] seeding API key...")
    const { plaintext, keyId } = await seedKey()
    // Don't log any field returned by seedKey — CodeQL's taint analysis
    // marks the whole tuple sensitive because plaintext flows out of it.
    // keyId is still used internally for the revoke step at the end.
    console.log("[harness] API key seeded")

    let mcp
    let exitCode = 0
    try {
        console.log("[harness] spawning MCP server...")
        const child = spawn(
            "node",
            ["mcp-server/dist/index.js"],
            {
                env: {
                    ...process.env,
                    DATALEARN_API_KEY: plaintext,
                    DATALEARN_BASE_URL: BASE_URL,
                },
                stdio: ["pipe", "pipe", "pipe"],
            }
        )
        mcp = new McpClient(child)

        console.log("[harness] initialize...")
        const init = await mcp.request("initialize", {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "e2e-harness", version: "0" },
        })
        if (init.error) throw new Error(`init failed: ${JSON.stringify(init.error)}`)
        mcp.notify("notifications/initialized")

        console.log("\n[harness] tools/list...")
        const tools = await mcp.request("tools/list")
        const names = tools.result?.tools?.map((t) => t.name).sort() ?? []
        console.log(`  ✓ tools: ${names.join(", ")}`)
        if (names.length !== 9) {
            throw new Error(`expected 9 tools, got ${names.length}`)
        }

        console.log("\n[harness] read-only tools...")
        const passes = []
        passes.push(logResult("list_topics", await mcp.callTool("list_topics")))
        passes.push(logResult("list_tags", await mcp.callTool("list_tags")))
        passes.push(logResult("list_schemas", await mcp.callTool("list_schemas")))
        passes.push(logResult("list_problems", await mcp.callTool("list_problems")))
        passes.push(
            logResult(
                "list_problems(filter=EASY)",
                await mcp.callTool("list_problems", { difficulty: "EASY" })
            )
        )
        passes.push(
            logResult(
                "get_problem(simple-select)",
                await mcp.callTool("get_problem", { slug: "simple-select" })
            )
        )
        passes.push(
            logResult(
                "get_problem(does-not-exist)",
                await mcp.callTool("get_problem", { slug: "definitely-not-real-xyz" })
            )
        )

        const slug404 = await mcp.callTool("get_problem", {
            slug: "definitely-not-real-xyz",
        })
        const text404 = slug404.result?.content?.[0]?.text ?? ""
        const parsed404 = JSON.parse(text404)
        if (parsed404.found !== false) {
            console.log(
                `  ✗ get_problem 404 should return {found:false}, got: ${text404}`
            )
            passes.push(false)
        } else {
            console.log(`  ✓ get_problem 404 path returns {found:false}`)
            passes.push(true)
        }

        console.log("\n[harness] write tools (creates real DRAFT records)...")
        const stamp = Date.now()
        const tagSlug = `mcp-test-${stamp}`
        const tag = await mcp.callTool("create_tag", {
            name: `MCP Test ${stamp}`,
            slug: tagSlug,
        })
        passes.push(logResult("create_tag", tag))

        const topicSlug = `mcp-topic-${stamp}`
        const topic = await mcp.callTool("create_topic", {
            name: `MCP Topic ${stamp}`,
            slug: topicSlug,
            description: "Created by e2e harness; safe to delete.",
        })
        passes.push(logResult("create_topic", topic))

        const schema = await mcp.callTool("create_schema", {
            name: `MCP Schema ${stamp}`,
            sql: "CREATE TABLE t(id INTEGER, name VARCHAR); INSERT INTO t VALUES (1, 'a'); INSERT INTO t VALUES (2, 'b');",
        })
        passes.push(logResult("create_schema", schema))
        const schemaPayload = JSON.parse(schema.result?.content?.[0]?.text ?? "{}")
        const schemaId = schemaPayload.id

        const problemSlug = `mcp-problem-${stamp}`
        const created = await mcp.callTool("create_problem", {
            title: `MCP Test Problem ${stamp}`,
            slug: problemSlug,
            difficulty: "EASY",
            description: "Created by e2e harness; safe to delete.",
            schemaId,
            expectedOutput: '[{"id":1,"name":"a"},{"id":2,"name":"b"}]',
            ordered: false,
            solutionSql: "SELECT id, name FROM t;",
        })
        passes.push(logResult("create_problem", created))

        // Verify it landed as DRAFT
        const createdPayload = JSON.parse(
            created.result?.content?.[0]?.text ?? "{}"
        )
        if (createdPayload.status === "DRAFT") {
            console.log(`  ✓ create_problem result.status === "DRAFT"`)
            passes.push(true)
        } else {
            console.log(
                `  ✗ create_problem expected status=DRAFT, got ${createdPayload.status}`
            )
            passes.push(false)
        }

        // Verify the stable problem number was minted (positive integer)
        if (Number.isInteger(createdPayload.number) && createdPayload.number > 0) {
            console.log(
                `  ✓ create_problem minted stable number=${createdPayload.number}`
            )
            passes.push(true)
        } else {
            console.log(
                `  ✗ create_problem expected positive integer number, got ${createdPayload.number}`
            )
            passes.push(false)
        }

        // Try to smuggle status="PUBLISHED" — should still come back as DRAFT
        const sneakSlug = `mcp-sneak-${stamp}`
        const sneak = await mcp.callTool("create_problem", {
            title: `MCP Sneak ${stamp}`,
            slug: sneakSlug,
            difficulty: "EASY",
            description: "smuggle attempt",
            schemaId,
            expectedOutput: '[{"id":1,"name":"a"},{"id":2,"name":"b"}]',
            status: "PUBLISHED",
        })
        const sneakPayload = JSON.parse(sneak.result?.content?.[0]?.text ?? "{}")
        if (sneakPayload.status === "DRAFT") {
            console.log(
                `  ✓ create_problem status="PUBLISHED" smuggled in input → still DRAFT`
            )
            passes.push(true)
        } else {
            console.log(
                `  ✗ create_problem smuggled status="PUBLISHED" leaked through, got ${sneakPayload.status}`
            )
            passes.push(false)
        }

        // Cleanup the test records
        console.log("\n[harness] cleaning up test records...")
        await prisma.sQLProblem.deleteMany({
            where: { slug: { in: [problemSlug, sneakSlug] } },
        })
        await prisma.sqlSchema.delete({ where: { id: schemaId } })
        await prisma.tag.delete({ where: { slug: tagSlug } })
        await prisma.topic.delete({ where: { slug: topicSlug } })
        console.log("  ✓ test records deleted")

        const failed = passes.filter((p) => !p).length
        const total = passes.length
        console.log(
            `\n[harness] ${total - failed}/${total} checks passed${
                failed === 0 ? " ✅" : ` (${failed} failed ❌)`
            }`
        )
        exitCode = failed === 0 ? 0 : 1

        child.stdin.end()
        child.kill()
    } finally {
        if (mcp?.child && !mcp.child.killed) mcp.child.kill()
        console.log("[harness] revoking API key...")
        await revokeKey(keyId)
        await prisma.$disconnect()
    }
    process.exit(exitCode)
}

main().catch(async (err) => {
    console.error("[harness] FATAL:", err)
    await prisma.$disconnect().catch(() => {})
    process.exit(1)
})
