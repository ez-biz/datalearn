"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

// Slugs that would shadow first-class app routes. The dynamic [slug]
// catch-all matches anything not matched by a static route, but creating
// a Page named "admin" would still be confusing operationally — so we
// reject these explicitly. Keep this list in sync with app/* directories.
const RESERVED_SLUGS = new Set([
    "admin",
    "api",
    "learn",
    "practice",
    "profile",
    "_next",
    "auth",
    "static",
    "public",
    "favicon",
    "sitemap",
    "robots",
])

const createPageSchema = z.object({
    title: z.string().min(1, "Title is required").max(200),
    slug: z
        .string()
        .min(1, "Slug is required")
        .max(200)
        .regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens only")
        .refine((s) => !RESERVED_SLUGS.has(s), {
            message: "This slug is reserved by the app.",
        }),
    content: z.string().min(1, "Content is required"),
})

export async function createPage(formData: FormData) {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
        redirect("/")
    }

    const parsed = createPageSchema.safeParse({
        title: formData.get("title"),
        slug: formData.get("slug"),
        content: formData.get("content"),
    })

    if (!parsed.success) {
        // For now, just redirect back — TODO: show validation errors in UI
        redirect("/admin")
    }

    const { title, slug, content } = parsed.data

    try {
        await prisma.page.create({
            data: {
                title,
                slug,
                content,
                isActive: true
            }
        })
        revalidatePath('/')
        redirect('/admin')
    } catch (error) {
        redirect("/admin")
    }
}

