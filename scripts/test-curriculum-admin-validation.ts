// Unit tests for the curriculum Zod schemas. No database, no Prisma.
//
// Run: node --import tsx --test scripts/test-curriculum-admin-validation.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    CheckpointAddInput,
    CheckpointReorderInput,
    ModuleCreateInput,
    ModuleLessonAddInput,
    ModuleLessonReorderInput,
    ModuleReorderInput,
    ModuleUpdateInput,
} from "../lib/admin-validation"

describe("ModuleCreateInput", () => {
    it("accepts a minimal module", () => {
        const r = ModuleCreateInput.safeParse({
            name: "Window functions",
            description: "Frames, partitions, and the ranking family.",
        })
        assert.equal(r.success, true)
    })

    it("accepts an explicit slug and position", () => {
        const r = ModuleCreateInput.safeParse({
            name: "Window functions",
            slug: "window-functions",
            description: "d",
            position: 3,
        })
        assert.equal(r.success, true)
        assert.equal(r.data?.position, 3)
    })

    it("rejects a slug with uppercase or spaces", () => {
        assert.equal(
            ModuleCreateInput.safeParse({
                name: "n",
                slug: "Window Functions",
                description: "d",
            }).success,
            false,
        )
    })

    it("rejects an empty description", () => {
        assert.equal(
            ModuleCreateInput.safeParse({ name: "n", description: "" }).success,
            false,
        )
    })

    it("rejects a negative position", () => {
        assert.equal(
            ModuleCreateInput.safeParse({
                name: "n",
                description: "d",
                position: -1,
            }).success,
            false,
        )
    })
})

describe("ModuleUpdateInput", () => {
    it("accepts a partial update", () => {
        const r = ModuleUpdateInput.safeParse({ name: "Renamed" })
        assert.equal(r.success, true)
    })

    it("REJECTS position — positions move only through reorder", () => {
        const r = ModuleUpdateInput.safeParse({ name: "n", position: 2 })
        assert.equal(r.success, false)
    })

    it("rejects any other unknown key", () => {
        assert.equal(
            ModuleUpdateInput.safeParse({ trackId: "abc" }).success,
            false,
        )
    })
})

describe("ModuleReorderInput", () => {
    it("accepts a list of slugs", () => {
        const r = ModuleReorderInput.safeParse({
            moduleSlugs: ["foundations", "joins"],
        })
        assert.equal(r.success, true)
    })

    it("rejects an empty list", () => {
        assert.equal(
            ModuleReorderInput.safeParse({ moduleSlugs: [] }).success,
            false,
        )
    })

    it("rejects a non-slug entry", () => {
        assert.equal(
            ModuleReorderInput.safeParse({ moduleSlugs: ["Not A Slug"] })
                .success,
            false,
        )
    })
})

describe("attach inputs", () => {
    it("ModuleLessonAddInput accepts an articleSlug", () => {
        assert.equal(
            ModuleLessonAddInput.safeParse({ articleSlug: "null-is-not-a-value" })
                .success,
            true,
        )
    })

    it("ModuleLessonAddInput rejects a missing articleSlug", () => {
        assert.equal(ModuleLessonAddInput.safeParse({}).success, false)
    })

    it("CheckpointAddInput accepts a problemSlug and position", () => {
        const r = CheckpointAddInput.safeParse({
            problemSlug: "second-highest-salary-per-department",
            position: 0,
        })
        assert.equal(r.success, true)
    })

    it("CheckpointAddInput rejects a missing problemSlug", () => {
        assert.equal(CheckpointAddInput.safeParse({}).success, false)
    })
})

describe("reorder inputs", () => {
    it("ModuleLessonReorderInput accepts article slugs", () => {
        assert.equal(
            ModuleLessonReorderInput.safeParse({ articleSlugs: ["a", "b"] })
                .success,
            true,
        )
    })

    it("CheckpointReorderInput accepts problem slugs", () => {
        assert.equal(
            CheckpointReorderInput.safeParse({ problemSlugs: ["a", "b"] })
                .success,
            true,
        )
    })

    it("CheckpointReorderInput rejects an empty list", () => {
        assert.equal(
            CheckpointReorderInput.safeParse({ problemSlugs: [] }).success,
            false,
        )
    })
})
