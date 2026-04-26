# MCP Server v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a stdio MCP server in `mcp-server/` that lets an MCP-aware assistant author SQL problems on Data Learn via the existing `/api/admin/*` REST endpoints, gated by Bearer-key auth.

**Architecture:** New subdirectory `mcp-server/` with its own `package.json`, bundled by `tsup` into a single `dist/index.js`. The bundler inlines the relative import of `../lib/admin-validation` so the validators stay single-source-of-truth. Talks to the running Next app over HTTPS (or `http://localhost`) using a Bearer key from env. Forces every `create_problem` to land as `DRAFT` by omitting `status` from the tool input shape.

**Tech Stack:** `@modelcontextprotocol/sdk` (MCP server framework, stdio transport), `zod@^4` (input validation, must match parent app), `tsup` (bundler), `vitest` (unit tests), TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-04-26-mcp-server-design.md`

---

## File structure

```
datalearn/
├── lib/admin-validation.ts          # MODIFIED — split ProblemCreateInput into base + refined
└── mcp-server/                      # NEW
    ├── package.json
    ├── tsconfig.json
    ├── tsup.config.ts
    ├── vitest.config.ts
    ├── .gitignore
    ├── README.md
    ├── src/
    │   ├── index.ts                 # entry: env validation, McpServer, register tools, stdio
    │   ├── client.ts                # DataLearnClient: fetch wrapper, Bearer auth, URL safety, response unwrap, ApiError
    │   ├── errors.ts                # toMcpError(): ApiError → McpError
    │   └── tools/
    │       ├── topics.ts            # registerTopicTools: list_topics, create_topic
    │       ├── tags.ts              # registerTagTools: list_tags, create_tag
    │       ├── schemas.ts           # registerSchemaTools: list_schemas, create_schema
    │       └── problems.ts          # registerProblemTools: list_problems, get_problem, create_problem
    └── tests/
        ├── client.test.ts
        ├── errors.test.ts
        └── tools/
            ├── topics.test.ts
            ├── tags.test.ts
            ├── schemas.test.ts
            └── problems.test.ts
```

---

## Task 1: Scaffold the `mcp-server/` package

**Files:**
- Create: `mcp-server/package.json`
- Create: `mcp-server/tsconfig.json`
- Create: `mcp-server/tsup.config.ts`
- Create: `mcp-server/vitest.config.ts`
- Create: `mcp-server/.gitignore`
- Create: `mcp-server/src/index.ts` (placeholder)

This task has no test step — it's pure scaffolding. The build pipeline IS the test: a successful `npm run build` proves the toolchain is wired up.

- [ ] **Step 1: Write `mcp-server/package.json`**

```json
{
  "name": "datalearn-mcp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "datalearn-mcp": "./dist/index.js"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^4.3.5"
  },
  "devDependencies": {
    "@types/node": "^22",
    "tsup": "^8.0.0",
    "typescript": "^5",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Write `mcp-server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": false
  },
  "include": ["src/**/*", "tests/**/*", "../lib/admin-validation.ts"]
}
```

- [ ] **Step 3: Write `mcp-server/tsup.config.ts`**

```ts
import { defineConfig } from "tsup"

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["esm"],
    target: "node20",
    platform: "node",
    bundle: true,
    clean: true,
    sourcemap: true,
    dts: false,
    noExternal: [/.*/], // bundle EVERYTHING into one file, including @modelcontextprotocol/sdk
    banner: { js: "#!/usr/bin/env node" },
})
```

- [ ] **Step 4: Write `mcp-server/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
    },
})
```

- [ ] **Step 5: Write `mcp-server/.gitignore`**

```
node_modules/
dist/
*.log
```

- [ ] **Step 6: Write placeholder `mcp-server/src/index.ts`**

```ts
console.error("[datalearn-mcp] starting (placeholder)")
```

- [ ] **Step 7: Install deps and build**

Run:
```bash
cd mcp-server && npm install && npm run build
```
Expected: `dist/index.js` created. Run `node dist/index.js` and see `[datalearn-mcp] starting (placeholder)` on stderr.

- [ ] **Step 8: Commit**

```bash
cd /Users/anchitgupta/Documents/Github/datalearn
git add mcp-server/package.json mcp-server/package-lock.json mcp-server/tsconfig.json mcp-server/tsup.config.ts mcp-server/vitest.config.ts mcp-server/.gitignore mcp-server/src/index.ts
git commit -m "chore(mcp): scaffold mcp-server package (tsup + vitest)"
```

---

## Task 2: Refactor `lib/admin-validation.ts` to expose `ProblemCreateInputBase`

**Why:** The MCP `create_problem` tool needs to omit the `status` field from its input schema (Q4 decision: forced DRAFT). Zod's `.omit()` only works on `ZodObject`, not on the refined version. Splitting `ProblemCreateInput` into a base object + a refined wrapper keeps the existing exports intact and lets the MCP layer derive a status-less variant.

**Files:**
- Modify: `lib/admin-validation.ts:32-76`

This is a pure refactor with no behavior change. Existing imports of `ProblemCreateInput` continue to work.

- [ ] **Step 1: Apply the refactor**

Replace the existing `export const ProblemCreateInput = ...` block (lines 32-76) with:

```ts
export const ProblemCreateInputBase = z.object({
    title: z.string().min(1).max(200),
    slug: SlugSchema,
    difficulty: Difficulty,
    status: ProblemStatus.default("DRAFT"),
    description: z.string().min(1).max(20_000),
    schemaDescription: z.string().max(2_000).default(""),
    ordered: z.boolean().default(false),
    hints: z.array(z.string().min(1).max(2_000)).max(10).default([]),
    tagSlugs: z.array(SlugSchema).max(10).default([]),
    schemaId: z.string().min(1).optional(),
    schemaInline: SqlSchemaCreateInput.optional(),
    expectedOutput: z.string().min(2).max(2_000_000).optional(),
    solutionSql: z.string().max(20_000).optional(),
})

export const ProblemCreateInput = ProblemCreateInputBase
    .refine(
        (v) => Boolean(v.schemaId) !== Boolean(v.schemaInline),
        {
            message: "Provide exactly one of schemaId or schemaInline.",
            path: ["schemaId"],
        }
    )
    .refine((v) => Boolean(v.expectedOutput), {
        message: "expectedOutput JSON is required.",
        path: ["expectedOutput"],
    })
    .refine(
        (v) => {
            if (!v.expectedOutput) return true
            try {
                const parsed = JSON.parse(v.expectedOutput)
                return Array.isArray(parsed)
            } catch {
                return false
            }
        },
        {
            message: "expectedOutput must be a JSON array of row objects.",
            path: ["expectedOutput"],
        }
    )
```

- [ ] **Step 2: Verify nothing in the Next app broke**

Run from repo root:
```bash
npx tsc --noEmit
```
Expected: clean exit (no TypeScript errors).

- [ ] **Step 3: Run existing E2E suite as a behavioral check**

Run from repo root:
```bash
AUTH_TRUST_HOST=true npx playwright test tests/e2e/security.spec.ts
```
Expected: all tests pass (the refactor shouldn't change runtime behavior).

- [ ] **Step 4: Commit**

```bash
git add lib/admin-validation.ts
git commit -m "refactor(validation): split ProblemCreateInput into base + refined

Pure refactor. Exposes ProblemCreateInputBase as the underlying
ZodObject so downstream consumers (MCP server) can .omit() fields
before re-applying the cross-field refinements. ProblemCreateInput
keeps the same observable shape — existing imports unchanged."
```

---

## Task 3: `DataLearnClient` — fetch wrapper with Bearer auth, URL safety, response unwrap

**Files:**
- Create: `mcp-server/src/client.ts`
- Create: `mcp-server/tests/client.test.ts`

- [ ] **Step 1: Write the failing tests in `mcp-server/tests/client.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest"
import { ApiError, DataLearnClient } from "../src/client"

function ok(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    })
}

describe("DataLearnClient", () => {
    it("rejects http:// for non-localhost hosts at construction", () => {
        expect(
            () => new DataLearnClient("k", "http://datalearn.app")
        ).toThrow(/http:\/\/ only allowed for localhost/i)
    })

    it("allows http:// for localhost", () => {
        expect(
            () => new DataLearnClient("k", "http://localhost:3000")
        ).not.toThrow()
    })

    it("allows http:// for 127.0.0.1", () => {
        expect(
            () => new DataLearnClient("k", "http://127.0.0.1:3000")
        ).not.toThrow()
    })

    it("allows https:// for any host", () => {
        expect(
            () => new DataLearnClient("k", "https://datalearn.app")
        ).not.toThrow()
    })

    it("sends Bearer auth header on requests", async () => {
        const fetch = vi.fn().mockResolvedValue(ok({ data: [] }))
        const c = new DataLearnClient("the-key", "http://localhost:3000", fetch)
        await c.request("GET", "/api/admin/topics")
        expect(fetch).toHaveBeenCalledWith(
            "http://localhost:3000/api/admin/topics",
            expect.objectContaining({
                method: "GET",
                headers: expect.objectContaining({
                    Authorization: "Bearer the-key",
                    "Content-Type": "application/json",
                }),
            })
        )
    })

    it("unwraps { data: ... } on 200", async () => {
        const fetch = vi.fn().mockResolvedValue(ok({ data: [{ id: "t1" }] }))
        const c = new DataLearnClient("k", "http://localhost:3000", fetch)
        const result = await c.request<Array<{ id: string }>>("GET", "/api/admin/topics")
        expect(result).toEqual([{ id: "t1" }])
    })

    it("throws ApiError with body.error on non-2xx", async () => {
        const fetch = vi.fn().mockResolvedValue(
            ok({ error: "Validation failed", details: { x: 1 } }, 400)
        )
        const c = new DataLearnClient("k", "http://localhost:3000", fetch)
        await expect(
            c.request("POST", "/api/admin/topics", {})
        ).rejects.toMatchObject({
            constructor: ApiError,
            status: 400,
            message: "Validation failed",
        })
    })

    it("includes JSON body on POST", async () => {
        const fetch = vi.fn().mockResolvedValue(ok({ data: { id: "t1" } }, 201))
        const c = new DataLearnClient("k", "http://localhost:3000", fetch)
        await c.request("POST", "/api/admin/topics", { slug: "x", title: "X" })
        expect(fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ slug: "x", title: "X" }),
            })
        )
    })

    it("falls back to status text when body is not JSON", async () => {
        const fetch = vi.fn().mockResolvedValue(
            new Response("oops", { status: 500 })
        )
        const c = new DataLearnClient("k", "http://localhost:3000", fetch)
        await expect(c.request("GET", "/api/admin/topics")).rejects.toMatchObject({
            status: 500,
        })
    })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `mcp-server/`:
```bash
npm test
```
Expected: FAIL — `Cannot find module '../src/client'`.

- [ ] **Step 3: Write `mcp-server/src/client.ts`**

```ts
export class ApiError extends Error {
    constructor(
        public status: number,
        message: string,
        public details?: unknown
    ) {
        super(message)
        this.name = "ApiError"
    }
}

export class DataLearnClient {
    private readonly normalizedBase: string

    constructor(
        private readonly apiKey: string,
        baseUrl: string,
        private readonly fetchImpl: typeof globalThis.fetch = globalThis.fetch
    ) {
        const url = new URL(baseUrl)
        const localhostHosts = new Set(["localhost", "127.0.0.1", "::1"])
        if (url.protocol === "http:" && !localhostHosts.has(url.hostname)) {
            throw new Error(
                `http:// only allowed for localhost; got ${baseUrl}. ` +
                    `Use https:// for production hosts.`
            )
        }
        // Strip trailing slash so URL joins are predictable.
        this.normalizedBase = baseUrl.replace(/\/$/, "")
    }

    async request<T>(
        method: string,
        path: string,
        body?: unknown
    ): Promise<T> {
        const url = `${this.normalizedBase}${path.startsWith("/") ? path : `/${path}`}`
        const res = await this.fetchImpl(url, {
            method,
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        })
        const text = await res.text()
        let parsed: unknown
        try {
            parsed = text ? JSON.parse(text) : {}
        } catch {
            parsed = { error: text || `HTTP ${res.status}` }
        }
        if (!res.ok) {
            const errBody = parsed as {
                error?: string
                details?: unknown
            }
            throw new ApiError(
                res.status,
                errBody?.error ?? `HTTP ${res.status}`,
                errBody?.details
            )
        }
        const okBody = parsed as { data?: T }
        return okBody.data as T
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run from `mcp-server/`:
```bash
npm test
```
Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/anchitgupta/Documents/Github/datalearn
git add mcp-server/src/client.ts mcp-server/tests/client.test.ts
git commit -m "feat(mcp): DataLearnClient — Bearer fetch wrapper with localhost-http guard"
```

---

## Task 4: `toMcpError` — translate `ApiError` into `McpError`

**Files:**
- Create: `mcp-server/src/errors.ts`
- Create: `mcp-server/tests/errors.test.ts`

- [ ] **Step 1: Write the failing tests in `mcp-server/tests/errors.test.ts`**

```ts
import { describe, expect, it } from "vitest"
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js"
import { ApiError } from "../src/client"
import { toMcpError } from "../src/errors"

describe("toMcpError", () => {
    it("400 → InvalidParams with the API error message", () => {
        const err = toMcpError(new ApiError(400, "Validation failed"))
        expect(err).toBeInstanceOf(McpError)
        expect(err.code).toBe(ErrorCode.InvalidParams)
        expect(err.message).toContain("Validation failed")
    })

    it("401 → InvalidRequest with auth-failed prefix", () => {
        const err = toMcpError(new ApiError(401, "Invalid API key."))
        expect(err.code).toBe(ErrorCode.InvalidRequest)
        expect(err.message).toMatch(/auth failed: Invalid API key\./)
    })

    it("403 → InvalidRequest with auth-failed prefix", () => {
        const err = toMcpError(new ApiError(403, "Admin access required."))
        expect(err.code).toBe(ErrorCode.InvalidRequest)
        expect(err.message).toMatch(/auth failed: Admin access required\./)
    })

    it("500 → InternalError", () => {
        const err = toMcpError(new ApiError(500, "boom"))
        expect(err.code).toBe(ErrorCode.InternalError)
        expect(err.message).toContain("boom")
    })

    it("passes through existing McpError unchanged", () => {
        const original = new McpError(ErrorCode.InvalidParams, "explicit")
        expect(toMcpError(original)).toBe(original)
    })

    it("wraps unknown errors as InternalError", () => {
        const err = toMcpError(new Error("something else"))
        expect(err.code).toBe(ErrorCode.InternalError)
        expect(err.message).toContain("something else")
    })

    it("wraps non-Error throwables as InternalError", () => {
        const err = toMcpError("string thrown")
        expect(err.code).toBe(ErrorCode.InternalError)
        expect(err.message).toContain("string thrown")
    })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `mcp-server/`:
```bash
npm test tests/errors.test.ts
```
Expected: FAIL — `Cannot find module '../src/errors'`.

- [ ] **Step 3: Write `mcp-server/src/errors.ts`**

```ts
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js"
import { ApiError } from "./client.js"

export function toMcpError(err: unknown): McpError {
    if (err instanceof McpError) return err
    if (err instanceof ApiError) {
        if (err.status === 400) {
            return new McpError(ErrorCode.InvalidParams, err.message)
        }
        if (err.status === 401 || err.status === 403) {
            return new McpError(
                ErrorCode.InvalidRequest,
                `auth failed: ${err.message}`
            )
        }
        return new McpError(ErrorCode.InternalError, err.message)
    }
    if (err instanceof Error) {
        return new McpError(ErrorCode.InternalError, err.message)
    }
    return new McpError(ErrorCode.InternalError, String(err))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run from `mcp-server/`:
```bash
npm test
```
Expected: all client + errors tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/anchitgupta/Documents/Github/datalearn
git add mcp-server/src/errors.ts mcp-server/tests/errors.test.ts
git commit -m "feat(mcp): toMcpError — translate ApiError into McpError codes"
```

---

## Task 5: Topics tools — `list_topics`, `create_topic`

**Files:**
- Create: `mcp-server/src/tools/topics.ts`
- Create: `mcp-server/tests/tools/topics.test.ts`

- [ ] **Step 1: Write the failing tests in `mcp-server/tests/tools/topics.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { DataLearnClient } from "../../src/client"
import { registerTopicTools } from "../../src/tools/topics"

function ok(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    })
}

function makeServer() {
    return new McpServer({ name: "test", version: "0.0.0" })
}

describe("topics tools", () => {
    it("registers list_topics and create_topic", () => {
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            vi.fn()
        )
        registerTopicTools(server, client)
        // McpServer exposes registered tools via internal API; we sniff by
        // listing them through the public method.
        const tools = (server as any)._registeredTools as Record<string, unknown>
        expect(Object.keys(tools)).toContain("list_topics")
        expect(Object.keys(tools)).toContain("create_topic")
    })

    it("list_topics calls GET /api/admin/topics and returns the data", async () => {
        const fetch = vi
            .fn()
            .mockResolvedValue(
                ok({ data: [{ id: "1", slug: "joins", title: "Joins" }] })
            )
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            fetch
        )
        registerTopicTools(server, client)
        const tool = (server as any)._registeredTools.list_topics
        const result = await tool.callback({}, {})
        expect(fetch).toHaveBeenCalledWith(
            "http://localhost:3000/api/admin/topics",
            expect.objectContaining({ method: "GET" })
        )
        expect(result.content[0].text).toContain("joins")
    })

    it("create_topic POSTs the input and returns the created topic", async () => {
        const fetch = vi
            .fn()
            .mockResolvedValue(
                ok(
                    { data: { id: "1", slug: "joins", title: "Joins" } },
                    201
                )
            )
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            fetch
        )
        registerTopicTools(server, client)
        const tool = (server as any)._registeredTools.create_topic
        const result = await tool.callback(
            { slug: "joins", title: "Joins", description: "desc" },
            {}
        )
        expect(fetch).toHaveBeenCalledWith(
            "http://localhost:3000/api/admin/topics",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    slug: "joins",
                    title: "Joins",
                    description: "desc",
                }),
            })
        )
        expect(result.content[0].text).toContain("joins")
    })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `mcp-server/`:
```bash
npm test tests/tools/topics.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write `mcp-server/src/tools/topics.ts`**

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { TopicCreateInput } from "../../../lib/admin-validation"
import { DataLearnClient } from "../client.js"
import { toMcpError } from "../errors.js"

type Topic = {
    id: string
    slug: string
    title: string
    description: string | null
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

export function registerTopicTools(
    server: McpServer,
    client: DataLearnClient
): void {
    server.tool(
        "list_topics",
        "List all topics on Data Learn. Topics group articles; problems use tags, not topics.",
        {},
        async () => {
            try {
                const topics = await client.request<Topic[]>(
                    "GET",
                    "/api/admin/topics"
                )
                return ok(topics)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )

    server.tool(
        "create_topic",
        "Create a new topic. Slug must be kebab-case and unique.",
        TopicCreateInput.shape,
        async (input) => {
            try {
                const created = await client.request<Topic>(
                    "POST",
                    "/api/admin/topics",
                    input
                )
                return ok(created)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run from `mcp-server/`:
```bash
npm test
```
Expected: all topics tests pass alongside existing.

- [ ] **Step 5: Commit**

```bash
cd /Users/anchitgupta/Documents/Github/datalearn
git add mcp-server/src/tools/topics.ts mcp-server/tests/tools/topics.test.ts
git commit -m "feat(mcp): list_topics + create_topic tools"
```

---

## Task 6: Tags tools — `list_tags`, `create_tag`

**Files:**
- Create: `mcp-server/src/tools/tags.ts`
- Create: `mcp-server/tests/tools/tags.test.ts`

- [ ] **Step 1: Write the failing tests in `mcp-server/tests/tools/tags.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { DataLearnClient } from "../../src/client"
import { registerTagTools } from "../../src/tools/tags"

function ok(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    })
}

function makeServer() {
    return new McpServer({ name: "test", version: "0.0.0" })
}

describe("tags tools", () => {
    it("registers list_tags and create_tag", () => {
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            vi.fn()
        )
        registerTagTools(server, client)
        const tools = (server as any)._registeredTools as Record<string, unknown>
        expect(Object.keys(tools)).toContain("list_tags")
        expect(Object.keys(tools)).toContain("create_tag")
    })

    it("list_tags calls GET /api/admin/tags", async () => {
        const fetch = vi
            .fn()
            .mockResolvedValue(ok({ data: [{ id: "1", slug: "join", name: "Join" }] }))
        const server = makeServer()
        const client = new DataLearnClient("k", "http://localhost:3000", fetch)
        registerTagTools(server, client)
        const tool = (server as any)._registeredTools.list_tags
        const result = await tool.callback({}, {})
        expect(fetch).toHaveBeenCalledWith(
            "http://localhost:3000/api/admin/tags",
            expect.objectContaining({ method: "GET" })
        )
        expect(result.content[0].text).toContain("join")
    })

    it("create_tag POSTs the input", async () => {
        const fetch = vi
            .fn()
            .mockResolvedValue(
                ok({ data: { id: "1", slug: "join", name: "Join" } }, 201)
            )
        const server = makeServer()
        const client = new DataLearnClient("k", "http://localhost:3000", fetch)
        registerTagTools(server, client)
        const tool = (server as any)._registeredTools.create_tag
        await tool.callback({ slug: "join", name: "Join" }, {})
        expect(fetch).toHaveBeenCalledWith(
            "http://localhost:3000/api/admin/tags",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ slug: "join", name: "Join" }),
            })
        )
    })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test tests/tools/tags.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `mcp-server/src/tools/tags.ts`**

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { TagCreateInput } from "../../../lib/admin-validation"
import { DataLearnClient } from "../client.js"
import { toMcpError } from "../errors.js"

type Tag = { id: string; slug: string; name: string }

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

export function registerTagTools(
    server: McpServer,
    client: DataLearnClient
): void {
    server.tool(
        "list_tags",
        "List all tags. Tags label problems by topic (joins, aggregations, window-functions, etc.).",
        {},
        async () => {
            try {
                const tags = await client.request<Tag[]>(
                    "GET",
                    "/api/admin/tags"
                )
                return ok(tags)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )

    server.tool(
        "create_tag",
        "Create a new tag. Slug must be kebab-case and unique.",
        TagCreateInput.shape,
        async (input) => {
            try {
                const created = await client.request<Tag>(
                    "POST",
                    "/api/admin/tags",
                    input
                )
                return ok(created)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/anchitgupta/Documents/Github/datalearn
git add mcp-server/src/tools/tags.ts mcp-server/tests/tools/tags.test.ts
git commit -m "feat(mcp): list_tags + create_tag tools"
```

---

## Task 7: Schemas tools — `list_schemas`, `create_schema`

**Files:**
- Create: `mcp-server/src/tools/schemas.ts`
- Create: `mcp-server/tests/tools/schemas.test.ts`

- [ ] **Step 1: Write the failing tests in `mcp-server/tests/tools/schemas.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { DataLearnClient } from "../../src/client"
import { registerSchemaTools } from "../../src/tools/schemas"

function ok(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    })
}

function makeServer() {
    return new McpServer({ name: "test", version: "0.0.0" })
}

describe("schemas tools", () => {
    it("registers list_schemas and create_schema", () => {
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            vi.fn()
        )
        registerSchemaTools(server, client)
        const tools = (server as any)._registeredTools as Record<string, unknown>
        expect(Object.keys(tools)).toContain("list_schemas")
        expect(Object.keys(tools)).toContain("create_schema")
    })

    it("list_schemas calls GET /api/admin/schemas", async () => {
        const fetch = vi.fn().mockResolvedValue(
            ok({ data: [{ id: "1", slug: "orders", name: "Orders", ddl: "CREATE TABLE…" }] })
        )
        const server = makeServer()
        const client = new DataLearnClient("k", "http://localhost:3000", fetch)
        registerSchemaTools(server, client)
        const tool = (server as any)._registeredTools.list_schemas
        const result = await tool.callback({}, {})
        expect(fetch).toHaveBeenCalledWith(
            "http://localhost:3000/api/admin/schemas",
            expect.objectContaining({ method: "GET" })
        )
        expect(result.content[0].text).toContain("orders")
    })

    it("create_schema POSTs the input", async () => {
        const fetch = vi.fn().mockResolvedValue(
            ok({ data: { id: "1", slug: "orders", name: "Orders" } }, 201)
        )
        const server = makeServer()
        const client = new DataLearnClient("k", "http://localhost:3000", fetch)
        registerSchemaTools(server, client)
        const tool = (server as any)._registeredTools.create_schema
        await tool.callback(
            {
                slug: "orders",
                name: "Orders",
                ddl: "CREATE TABLE orders (id INT);",
                seed: "INSERT INTO orders VALUES (1);",
            },
            {}
        )
        expect(fetch).toHaveBeenCalledWith(
            "http://localhost:3000/api/admin/schemas",
            expect.objectContaining({ method: "POST" })
        )
    })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test tests/tools/schemas.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write `mcp-server/src/tools/schemas.ts`**

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { SqlSchemaCreateInput } from "../../../lib/admin-validation"
import { DataLearnClient } from "../client.js"
import { toMcpError } from "../errors.js"

type SqlSchema = {
    id: string
    slug: string
    name: string
    ddl: string
    seed?: string | null
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

export function registerSchemaTools(
    server: McpServer,
    client: DataLearnClient
): void {
    server.tool(
        "list_schemas",
        "List all SQL schemas. Each schema has a DDL (table definitions) and seed (INSERTs). Reuse an existing schema by reference (schemaId) when creating a problem instead of inlining a duplicate.",
        {},
        async () => {
            try {
                const schemas = await client.request<SqlSchema[]>(
                    "GET",
                    "/api/admin/schemas"
                )
                return ok(schemas)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )

    server.tool(
        "create_schema",
        "Create a new SQL schema (DDL + optional seed data). Slug must be kebab-case and unique.",
        SqlSchemaCreateInput.shape,
        async (input) => {
            try {
                const created = await client.request<SqlSchema>(
                    "POST",
                    "/api/admin/schemas",
                    input
                )
                return ok(created)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/anchitgupta/Documents/Github/datalearn
git add mcp-server/src/tools/schemas.ts mcp-server/tests/tools/schemas.test.ts
git commit -m "feat(mcp): list_schemas + create_schema tools"
```

---

## Task 8: Problems tools — `list_problems`, `get_problem`, `create_problem`

This is the largest tool file because it has three tools and the `create_problem` input requires the omit-status dance.

**Files:**
- Create: `mcp-server/src/tools/problems.ts`
- Create: `mcp-server/tests/tools/problems.test.ts`

- [ ] **Step 1: Write the failing tests in `mcp-server/tests/tools/problems.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { DataLearnClient } from "../../src/client"
import { registerProblemTools } from "../../src/tools/problems"

function ok(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    })
}

function fail(error: string, status: number): Response {
    return new Response(JSON.stringify({ error }), {
        status,
        headers: { "Content-Type": "application/json" },
    })
}

function makeServer() {
    return new McpServer({ name: "test", version: "0.0.0" })
}

const sampleFullProblem = {
    id: "1",
    slug: "simple-select",
    title: "Simple Select",
    difficulty: "EASY",
    status: "PUBLISHED",
    description: "…",
    expectedOutput: "[]",
    solutionSql: "SELECT 1",
    tags: [{ id: "t1", slug: "select", name: "Select" }],
    schema: { id: "s1", name: "Orders" },
}

describe("problems tools", () => {
    it("registers list_problems, get_problem, create_problem", () => {
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            vi.fn()
        )
        registerProblemTools(server, client)
        const tools = (server as any)._registeredTools as Record<string, unknown>
        expect(Object.keys(tools)).toContain("list_problems")
        expect(Object.keys(tools)).toContain("get_problem")
        expect(Object.keys(tools)).toContain("create_problem")
    })

    it("list_problems projects fields and excludes expectedOutput/solutionSql", async () => {
        const fetch = vi
            .fn()
            .mockResolvedValue(ok({ data: [sampleFullProblem] }))
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            fetch
        )
        registerProblemTools(server, client)
        const tool = (server as any)._registeredTools.list_problems
        const result = await tool.callback({}, {})
        const text = result.content[0].text
        expect(text).toContain("simple-select")
        expect(text).not.toContain("expectedOutput")
        expect(text).not.toContain("solutionSql")
    })

    it("list_problems filters by difficulty client-side", async () => {
        const fetch = vi.fn().mockResolvedValue(
            ok({
                data: [
                    { ...sampleFullProblem, difficulty: "EASY" },
                    { ...sampleFullProblem, slug: "med", difficulty: "MEDIUM" },
                    { ...sampleFullProblem, slug: "hard", difficulty: "HARD" },
                ],
            })
        )
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            fetch
        )
        registerProblemTools(server, client)
        const tool = (server as any)._registeredTools.list_problems
        const result = await tool.callback({ difficulty: "MEDIUM" }, {})
        const parsed = JSON.parse(result.content[0].text)
        expect(parsed).toHaveLength(1)
        expect(parsed[0].slug).toBe("med")
    })

    it("get_problem returns the full problem on 200", async () => {
        const fetch = vi.fn().mockResolvedValue(ok({ data: sampleFullProblem }))
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            fetch
        )
        registerProblemTools(server, client)
        const tool = (server as any)._registeredTools.get_problem
        const result = await tool.callback({ slug: "simple-select" }, {})
        expect(fetch).toHaveBeenCalledWith(
            "http://localhost:3000/api/admin/problems/simple-select",
            expect.objectContaining({ method: "GET" })
        )
        expect(result.content[0].text).toContain("expectedOutput")
    })

    it("get_problem returns {found:false} on 404", async () => {
        const fetch = vi.fn().mockResolvedValue(fail("Not found", 404))
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            fetch
        )
        registerProblemTools(server, client)
        const tool = (server as any)._registeredTools.get_problem
        const result = await tool.callback({ slug: "nope" }, {})
        expect(JSON.parse(result.content[0].text)).toEqual({ found: false })
    })

    it("create_problem forces DRAFT in the POST body (even if AI tries to set status)", async () => {
        const fetch = vi
            .fn()
            .mockResolvedValue(ok({ data: sampleFullProblem }, 201))
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            fetch
        )
        registerProblemTools(server, client)
        const tool = (server as any)._registeredTools.create_problem

        // Call the handler with status="PUBLISHED" smuggled in. The Zod
        // input shape doesn't declare status, so it's stripped at parse;
        // and even if passthrough were ever enabled, the handler's
        // explicit `status: "DRAFT"` override would win during the spread.
        await tool.callback(
            {
                title: "T",
                slug: "t",
                difficulty: "EASY",
                description: "d",
                schemaInline: {
                    slug: "s",
                    name: "S",
                    ddl: "CREATE TABLE t(id INT);",
                },
                expectedOutput: "[]",
                status: "PUBLISHED",
            } as any,
            {}
        )
        const call = fetch.mock.calls[0]
        const body = JSON.parse(call[1].body as string)
        expect(body.status).toBe("DRAFT")
    })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test tests/tools/problems.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `mcp-server/src/tools/problems.ts`**

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import {
    Difficulty,
    ProblemCreateInputBase,
} from "../../../lib/admin-validation"
import { ApiError, DataLearnClient } from "../client.js"
import { toMcpError } from "../errors.js"

type FullProblem = {
    id: string
    slug: string
    title: string
    difficulty: "EASY" | "MEDIUM" | "HARD"
    status: "DRAFT" | "BETA" | "PUBLISHED" | "ARCHIVED"
    description: string
    expectedOutput?: string | null
    solutionSql?: string | null
    tags?: Array<{ id: string; slug: string; name: string }>
    schema?: { id: string; name: string }
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

// MCP input shape for create_problem — excludes `status` so the AI cannot
// set it. The handler injects status="DRAFT" before sending to the API.
// Cross-field refinements (schemaId XOR schemaInline, expectedOutput
// required, expectedOutput is a JSON array) are validated server-side
// by ProblemCreateInput; a 400 from the API maps to McpError(InvalidParams)
// with the API's message, so the AI sees the actual validation error.
const McpProblemCreateInputShape =
    ProblemCreateInputBase.omit({ status: true }).shape

const ListProblemsShape = {
    difficulty: Difficulty.optional(),
}

export function registerProblemTools(
    server: McpServer,
    client: DataLearnClient
): void {
    server.tool(
        "list_problems",
        "List SQL problems. Returns a minimal projection (slug, title, difficulty, status, tags) — use get_problem to fetch a single problem's full data including expectedOutput.",
        ListProblemsShape,
        async (input) => {
            try {
                const all = await client.request<FullProblem[]>(
                    "GET",
                    "/api/admin/problems"
                )
                const filtered = input.difficulty
                    ? all.filter((p) => p.difficulty === input.difficulty)
                    : all
                const projected = filtered.map((p) => ({
                    slug: p.slug,
                    title: p.title,
                    difficulty: p.difficulty,
                    status: p.status,
                    tags: (p.tags ?? []).map((t) => t.slug),
                }))
                return ok(projected)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )

    server.tool(
        "get_problem",
        "Fetch a single SQL problem's full record by slug, including expectedOutput JSON and solutionSql. Returns {found:false} if no problem with that slug exists. Use this to learn the JSON shape of expectedOutput before authoring new problems.",
        { slug: z.string().min(1) },
        async ({ slug }) => {
            try {
                const problem = await client.request<FullProblem>(
                    "GET",
                    `/api/admin/problems/${encodeURIComponent(slug)}`
                )
                return ok(problem)
            } catch (err) {
                if (err instanceof ApiError && err.status === 404) {
                    return ok({ found: false })
                }
                throw toMcpError(err)
            }
        }
    )

    server.tool(
        "create_problem",
        [
            "Create a new SQL problem. ALWAYS lands as DRAFT — publishing is a deliberate human action via the admin UI; this tool does not accept a status field.",
            "",
            "Required: title, slug (kebab-case), difficulty (EASY|MEDIUM|HARD), description, expectedOutput.",
            "Schema: provide EXACTLY ONE of schemaId (reference an existing schema; check list_schemas first) or schemaInline (create a new schema in the same call).",
            "expectedOutput: must be a JSON-stringified array of row objects. Example: '[{\"id\":1,\"name\":\"a\"}]'.",
            "Optional: hints (string[], max 10), tagSlugs (string[], max 10 — must reference existing tags).",
        ].join("\n"),
        McpProblemCreateInputShape,
        async (input) => {
            try {
                const created = await client.request<FullProblem>(
                    "POST",
                    "/api/admin/problems",
                    { ...input, status: "DRAFT" }
                )
                return ok(created)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass (client + errors + topics + tags + schemas + problems).

- [ ] **Step 5: Commit**

```bash
cd /Users/anchitgupta/Documents/Github/datalearn
git add mcp-server/src/tools/problems.ts mcp-server/tests/tools/problems.test.ts
git commit -m "feat(mcp): list_problems + get_problem + create_problem tools

create_problem omits status from its tool input shape and forces
DRAFT in the request body — AI-authored problems require human
review/publish via the admin UI."
```

---

## Task 9: Server entry — env validation, register tools, stdio transport

**Files:**
- Modify: `mcp-server/src/index.ts` (replace placeholder)
- Create: `mcp-server/src/start.ts` (extracted starter for testability)
- Create: `mcp-server/tests/start.test.ts`

We extract the env-validation + server-construction into `start.ts` so it can be unit tested without `process.exit()`. `index.ts` becomes a thin shim.

- [ ] **Step 1: Write the failing tests in `mcp-server/tests/start.test.ts`**

```ts
import { describe, expect, it } from "vitest"
import { buildServer } from "../src/start"

describe("buildServer", () => {
    it("throws when DATALEARN_API_KEY is missing", () => {
        expect(() =>
            buildServer({ apiKey: "", baseUrl: "http://localhost:3000" })
        ).toThrow(/DATALEARN_API_KEY/)
    })

    it("throws when DATALEARN_BASE_URL is missing", () => {
        expect(() => buildServer({ apiKey: "k", baseUrl: "" })).toThrow(
            /DATALEARN_BASE_URL/
        )
    })

    it("throws when baseUrl is malformed", () => {
        expect(() =>
            buildServer({ apiKey: "k", baseUrl: "not-a-url" })
        ).toThrow()
    })

    it("returns a server with all tools registered", () => {
        const { server } = buildServer({
            apiKey: "k",
            baseUrl: "http://localhost:3000",
        })
        const tools = (server as any)._registeredTools as Record<string, unknown>
        const names = Object.keys(tools).sort()
        expect(names).toEqual(
            [
                "create_problem",
                "create_schema",
                "create_tag",
                "create_topic",
                "get_problem",
                "list_problems",
                "list_schemas",
                "list_tags",
                "list_topics",
            ].sort()
        )
    })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test tests/start.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `mcp-server/src/start.ts`**

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { DataLearnClient } from "./client.js"
import { registerProblemTools } from "./tools/problems.js"
import { registerSchemaTools } from "./tools/schemas.js"
import { registerTagTools } from "./tools/tags.js"
import { registerTopicTools } from "./tools/topics.js"

export interface StartConfig {
    apiKey: string
    baseUrl: string
}

export function buildServer(config: StartConfig): {
    server: McpServer
    client: DataLearnClient
} {
    if (!config.apiKey) {
        throw new Error("DATALEARN_API_KEY is required")
    }
    if (!config.baseUrl) {
        throw new Error("DATALEARN_BASE_URL is required")
    }
    const client = new DataLearnClient(config.apiKey, config.baseUrl)
    const server = new McpServer({
        name: "datalearn",
        version: "0.1.0",
    })
    registerTopicTools(server, client)
    registerTagTools(server, client)
    registerSchemaTools(server, client)
    registerProblemTools(server, client)
    return { server, client }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Replace `mcp-server/src/index.ts` with the real entrypoint**

```ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { buildServer } from "./start.js"

async function main(): Promise<void> {
    const apiKey = process.env.DATALEARN_API_KEY ?? ""
    const baseUrl = process.env.DATALEARN_BASE_URL ?? ""

    let server
    try {
        ;({ server } = buildServer({ apiKey, baseUrl }))
    } catch (err) {
        console.error(
            `[datalearn-mcp] startup failed: ${
                err instanceof Error ? err.message : String(err)
            }`
        )
        process.exit(1)
    }

    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error(`[datalearn-mcp] connected, base=${baseUrl}`)
}

main().catch((err) => {
    console.error("[datalearn-mcp] fatal:", err)
    process.exit(1)
})
```

- [ ] **Step 6: Build and smoke-test the binary**

Run from `mcp-server/`:
```bash
npm run build
DATALEARN_API_KEY=fake DATALEARN_BASE_URL=http://localhost:3000 timeout 2 node dist/index.js < /dev/null
```
Expected: stderr shows `[datalearn-mcp] connected, base=http://localhost:3000`. Process exits via timeout (2s) — that's the expected behavior for a stdio server with no client speaking to it.

Run with missing env to verify the error path:
```bash
DATALEARN_BASE_URL=http://localhost:3000 node dist/index.js
```
Expected: stderr `[datalearn-mcp] startup failed: DATALEARN_API_KEY is required`, exit code 1.

- [ ] **Step 7: Commit**

```bash
cd /Users/anchitgupta/Documents/Github/datalearn
git add mcp-server/src/index.ts mcp-server/src/start.ts mcp-server/tests/start.test.ts
git commit -m "feat(mcp): server entrypoint — env validation + stdio transport"
```

---

## Task 10: README with install + Claude Desktop config + local-dev workflow

**Files:**
- Create: `mcp-server/README.md`

This is a docs-only task — no test step.

- [ ] **Step 1: Write `mcp-server/README.md`**

````markdown
# datalearn-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets an MCP-aware assistant (Claude Desktop, Cursor, etc.) author SQL problems on Data Learn through structured tool calls.

## Tools

| Tool | What it does |
|---|---|
| `list_topics`, `create_topic` | Article topics (problems use tags, not topics). |
| `list_tags`, `create_tag` | Problem tags. |
| `list_schemas`, `create_schema` | SQL schemas (DDL + seed). |
| `list_problems` | List problems (minimal projection, supports `difficulty` filter). |
| `get_problem` | Fetch a single problem's full record (use this to learn the `expectedOutput` JSON shape). |
| `create_problem` | Create a new problem. **Always lands as DRAFT** — publish manually via the admin UI. |

## Install

```bash
cd mcp-server
npm install
npm run build
```

Output: `dist/index.js` (single bundled file with shebang).

## Run

The server expects two env vars:

- `DATALEARN_API_KEY` — Bearer key from `/admin/api-keys` on the running app.
- `DATALEARN_BASE_URL` — e.g. `https://datalearn.app` or `http://localhost:3000`.

`http://` is rejected for any host other than `localhost` / `127.0.0.1` to prevent accidentally leaking the API key over plaintext.

## Claude Desktop config

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) and add:

```json
{
  "mcpServers": {
    "datalearn": {
      "command": "node",
      "args": ["/abs/path/to/datalearn/mcp-server/dist/index.js"],
      "env": {
        "DATALEARN_API_KEY": "dl_live_…",
        "DATALEARN_BASE_URL": "https://datalearn.app"
      }
    }
  }
}
```

Restart Claude Desktop. The tools appear under the `datalearn` namespace.

### Local development

Run alongside a local Next dev server:

1. From repo root: `npm run dev` (starts Next on port 3000).
2. Sign in as ADMIN and generate a key at `http://localhost:3000/admin/api-keys`.
3. Add a second entry to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "datalearn-local": {
      "command": "node",
      "args": ["/abs/path/to/datalearn/mcp-server/dist/index.js"],
      "env": {
        "DATALEARN_API_KEY": "dl_live_local_…",
        "DATALEARN_BASE_URL": "http://localhost:3000"
      }
    },
    "datalearn": {
      "command": "node",
      "args": ["/abs/path/to/datalearn/mcp-server/dist/index.js"],
      "env": {
        "DATALEARN_API_KEY": "dl_live_prod_…",
        "DATALEARN_BASE_URL": "https://datalearn.app"
      }
    }
  }
}
```

The two servers appear under different namespaces (`datalearn-local`, `datalearn`); ask the AI to use whichever you intend.

When you change tool definitions: rerun `npm run build` (or `npm run dev` for watch mode). The Next dev server doesn't need restarting.

## Example prompt

> "Create a MEDIUM problem on the orders schema about window functions. Use the existing `orders` schema if it exists; show me the expectedOutput for an existing problem first so you match the shape."

The AI will:
1. Call `list_schemas` → find `orders`.
2. Call `list_problems` → find an existing problem to model the `expectedOutput` shape.
3. Call `get_problem` on a similar problem → see the full JSON.
4. Call `create_problem` with `schemaId: "<orders-id>"`, generated SQL solution, and a matching `expectedOutput`.
5. Lands as DRAFT in `/admin/problems`. Review, fix, publish.

## Tests

```bash
npm test          # run once
npm run test:watch
npm run typecheck
```

## Safety notes

- All `create_problem` calls land as DRAFT. The `status` field is not exposed at the tool layer; it cannot be set to PUBLISHED via this server.
- Bearer keys have full admin power. Keep them out of source control. Rotate via `/admin/api-keys` if leaked.
- This server is local-only (stdio). HTTP/remote MCP transport is not part of v1.
````

- [ ] **Step 2: Commit**

```bash
cd /Users/anchitgupta/Documents/Github/datalearn
git add mcp-server/README.md
git commit -m "docs(mcp): README with install + Claude Desktop config + local-dev workflow"
```

---

## Task 11: Manual smoke test against running Next app

This task is manual — there's no automated step. The goal is to prove end-to-end that the MCP server can authenticate and successfully `create_problem` against a running Next app.

- [ ] **Step 1: Start the Next dev server**

In one terminal, from repo root:
```bash
npm run dev
```
Wait for `Ready` on `http://localhost:3000`.

- [ ] **Step 2: Generate a Bearer API key**

Sign in as ADMIN at `http://localhost:3000`. Visit `/admin/api-keys`. Click "Create" and copy the `dl_live_...` plaintext (only shown once). Save it temporarily.

- [ ] **Step 3: Test the MCP server with the MCP Inspector**

The MCP SDK ships an inspector. Run from `mcp-server/`:
```bash
DATALEARN_API_KEY=<paste-key> DATALEARN_BASE_URL=http://localhost:3000 \
  npx @modelcontextprotocol/inspector node dist/index.js
```
It opens a browser UI. Verify:
- The 9 tools appear in the left panel.
- Calling `list_topics` returns the topics that exist locally.
- Calling `create_problem` with a minimal valid input (slug + title + difficulty + description + expectedOutput=`"[]"` + schemaInline) creates a DRAFT problem.
- Visit `/admin/problems` in the browser and confirm the new problem is listed with status=DRAFT.

- [ ] **Step 4: Note the result in the PR description**

No code changes. Document what was tested and any edge cases observed; if anything failed, file the gap and fix in a follow-up task before opening the PR.

---

## Task 12: Open PR

- [ ] **Step 1: Final repo-root checks**

Run:
```bash
cd /Users/anchitgupta/Documents/Github/datalearn
npx tsc --noEmit
AUTH_TRUST_HOST=true npx playwright test tests/e2e/security.spec.ts tests/e2e/middleware-and-link-guard.spec.ts
```
Expected: typecheck clean; all E2E tests still pass (the lib/admin-validation refactor is the only Next-app change).

- [ ] **Step 2: Final mcp-server checks**

Run from `mcp-server/`:
```bash
npm test
npm run typecheck
npm run build
```
Expected: all tests pass; clean typecheck; `dist/index.js` produced.

- [ ] **Step 3: Push branch**

```bash
cd /Users/anchitgupta/Documents/Github/datalearn
git push -u origin feat/mcp-server
```

- [ ] **Step 4: Open PR with `gh pr create`**

```bash
gh pr create --title "feat(mcp): MCP server v1 — author SQL problems via Claude Desktop" --body "$(cat <<'EOF'
## Summary

Ships a stdio MCP server in \`mcp-server/\` that lets an MCP-aware assistant (Claude Desktop, Cursor, etc.) author SQL problems on Data Learn through tool calls instead of hand-written REST scripts. v1 scope is the problem-authoring path; articles, updates, and approval flows are out of scope.

Spec: \`docs/superpowers/specs/2026-04-26-mcp-server-design.md\`
Plan: \`docs/superpowers/plans/2026-04-26-mcp-server.md\`

## What's included

**9 tools:**
- \`list_topics\`, \`create_topic\`
- \`list_tags\`, \`create_tag\`
- \`list_schemas\`, \`create_schema\`
- \`list_problems\` (minimal projection, optional difficulty filter)
- \`get_problem\` (full record incl. expectedOutput JSON; returns \`{found:false}\` on 404)
- \`create_problem\` — **status is omitted from the input shape; every call lands as DRAFT.** Cross-field refinements (schemaId XOR schemaInline, expectedOutput required) are validated server-side and surface as \`McpError(InvalidParams)\` so the AI self-corrects.

**Build:** \`tsup\` bundles \`src/\` + the relative import of \`../lib/admin-validation\` into a single \`dist/index.js\`. No workspace setup, no Next config changes. The Next app's only modification is a pure refactor that splits \`ProblemCreateInput\` into \`ProblemCreateInputBase\` + the refined wrapper so the MCP layer can \`.omit()\` status before re-applying refines server-side.

**Auth:** existing Bearer-key path on \`/api/admin/*\` (PR #17 hardened). MCP server reads \`DATALEARN_API_KEY\` and \`DATALEARN_BASE_URL\` from env. Refuses \`http://\` for non-localhost hosts to prevent leaking the key over plaintext.

**Tests:** unit tests for the HTTP client (auth header, URL safety, response unwrap, error mapping), error translation, and each tool's wiring. The existing E2E suite covers the underlying \`/api/admin/*\` Bearer auth paths end-to-end.

## Verification

- \`npx tsc --noEmit\` clean (Next app)
- \`AUTH_TRUST_HOST=true npx playwright test tests/e2e/security.spec.ts tests/e2e/middleware-and-link-guard.spec.ts\` — all pass
- \`mcp-server/\` — \`npm test\` all pass, \`npm run build\` produces \`dist/index.js\`
- Manual smoke test via \`@modelcontextprotocol/inspector\` against local Next dev: list/create on each tool succeeds; \`create_problem\` lands as DRAFT in \`/admin/problems\`

## Test plan (reviewer)

- [ ] CI green
- [ ] Pull branch, \`cd mcp-server && npm install && npm run build\`
- [ ] Generate a local API key at \`/admin/api-keys\`
- [ ] Add the local entry from \`mcp-server/README.md\` to \`claude_desktop_config.json\`
- [ ] Restart Claude Desktop, verify the \`datalearn-local\` server appears with 9 tools
- [ ] Ask: "list all tags on Data Learn" → tools call succeeds
- [ ] Ask: "create a DRAFT problem about JOINs on the orders schema" → confirm new DRAFT in \`/admin/problems\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Verify PR opens**

Note the PR URL printed. The PR body should be untruncated; CI should start. Done.

---

## Self-review notes (resolved during plan authoring)

- Spec coverage: every section of the spec is mapped to a task. Architecture/directory → Tasks 1+10. Tool catalog → Tasks 5–8. Safety on writes → Task 8 (create_problem omits status). Error handling → Task 4. Config & startup → Task 9. Local dev workflow → Task 10 (README). Tests → embedded in Tasks 3–9.
- Type consistency: `DataLearnClient.request<T>()` shape used uniformly across all tools. `FullProblem` typed once in `tools/problems.ts` and not duplicated. `Topic`/`Tag`/`SqlSchema` types declared inline in their tool files (small enough to not warrant extraction).
- The `_registeredTools` introspection used in tests is the SDK's documented internal field; if a future SDK release renames it, tests will need a small update — that's an acceptable cost for the directness of the assertions.
