"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Eye, Loader2, PenSquare, Save, Send } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Field, Input, Textarea } from "@/components/ui/Input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { TagPicker } from "@/components/admin/TagPicker"
import { RelatedProblemsPicker } from "@/components/admin/RelatedProblemsPicker"
import { MarkdownPreview } from "@/components/admin/MarkdownPreview"
import { slugify } from "@/lib/admin-validation"
import { cn } from "@/lib/utils"

type ArticleStatus = "DRAFT" | "SUBMITTED" | "PUBLISHED" | "ARCHIVED"

interface TopicOption {
    slug: string
    name: string
}

export interface MyArticleFormInitial {
    mode: "create" | "edit"
    title: string
    slug: string
    topicSlug: string
    content: string
    summary: string
    status: ArticleStatus
    tagSlugs: string[]
    relatedProblemSlugs: string[]
    reviewNotes: string | null
}

const DRAFT_PREFIX = "dl:me-article-draft:"

export function MyArticleForm({
    initial,
    originalSlug,
}: {
    initial: MyArticleFormInitial
    originalSlug?: string
}) {
    const router = useRouter()
    const [title, setTitle] = useState(initial.title)
    const [slug, setSlug] = useState(initial.slug)
    const [slugTouched, setSlugTouched] = useState(initial.mode === "edit")
    const [topicSlug, setTopicSlug] = useState(initial.topicSlug)
    const [content, setContent] = useState(initial.content)
    const [summary, setSummary] = useState(initial.summary)
    const [tagSlugs, setTagSlugs] = useState<string[]>(initial.tagSlugs)
    const [relatedProblemSlugs, setRelatedProblemSlugs] = useState<string[]>(
        initial.relatedProblemSlugs
    )
    const [topics, setTopics] = useState<TopicOption[]>([])
    const [editorTab, setEditorTab] = useState<"write" | "preview">("write")
    const [submitting, setSubmitting] = useState(false)
    const [submittingForReview, setSubmittingForReview] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [savedAt, setSavedAt] = useState<number | null>(null)
    const [draftHydrated, setDraftHydrated] = useState(initial.mode === "edit")

    const isLocked = initial.mode === "edit" && initial.status !== "DRAFT"
    const draftKey = `${DRAFT_PREFIX}${originalSlug ?? "__new__"}`

    // Topics list — uses admin endpoint which is admin-gated; for contributors
    // we'll need to surface it via me/topics — but for now, both ADMIN and
    // CONTRIBUTOR should have access. Let's add a public-ish topics endpoint.
    useEffect(() => {
        ;(async () => {
            const res = await fetch("/api/me/topics")
            if (res.ok) {
                const json = await res.json()
                setTopics(json.data ?? [])
            }
        })()
    }, [])

    useEffect(() => {
        if (!slugTouched) setSlug(slugify(title))
    }, [title, slugTouched])

    useEffect(() => {
        if (initial.mode !== "create") return
        try {
            const saved = localStorage.getItem(draftKey)
            if (saved) {
                const parsed = JSON.parse(saved)
                if (parsed.title) setTitle(parsed.title)
                if (parsed.content) setContent(parsed.content)
                if (parsed.summary) setSummary(parsed.summary)
                if (parsed.topicSlug) setTopicSlug(parsed.topicSlug)
            }
        } catch {}
        setDraftHydrated(true)
    }, [draftKey, initial.mode])

    useEffect(() => {
        if (initial.mode !== "create" || !draftHydrated) return
        const t = setTimeout(() => {
            try {
                if (
                    !title.trim() &&
                    !content.trim() &&
                    !summary.trim()
                ) {
                    localStorage.removeItem(draftKey)
                } else {
                    localStorage.setItem(
                        draftKey,
                        JSON.stringify({ title, content, summary, topicSlug })
                    )
                }
            } catch {}
        }, 600)
        return () => clearTimeout(t)
    }, [title, content, summary, topicSlug, draftKey, draftHydrated, initial.mode])

    useEffect(() => {
        if (savedAt == null) return
        const t = setTimeout(() => setSavedAt(null), 3000)
        return () => clearTimeout(t)
    }, [savedAt])

    function buildPayload() {
        return {
            title: title.trim(),
            slug,
            topicSlug,
            content,
            summary: summary.trim() || null,
            tagSlugs,
            relatedProblemSlugs,
        }
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (isLocked) return
        setError(null)
        setSubmitting(true)
        try {
            const url =
                initial.mode === "create"
                    ? "/api/me/articles"
                    : `/api/me/articles/${originalSlug}`
            const method = initial.mode === "create" ? "POST" : "PATCH"
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildPayload()),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(json.error ?? `Request failed: ${res.status}`)
                return
            }
            const newSlug = json?.data?.slug ?? slug
            if (initial.mode === "create") {
                try {
                    localStorage.removeItem(draftKey)
                } catch {}
                router.push(`/me/articles/${newSlug}/edit`)
                router.refresh()
            } else {
                if (newSlug !== originalSlug) {
                    router.push(`/me/articles/${newSlug}/edit`)
                }
                setSavedAt(Date.now())
                router.refresh()
            }
        } finally {
            setSubmitting(false)
        }
    }

    async function submitForReview() {
        if (!originalSlug) return
        if (
            !confirm(
                "Submit this article for admin review? You won't be able to edit it until it's approved or sent back."
            )
        )
            return
        setError(null)
        setSubmittingForReview(true)
        try {
            const res = await fetch(
                `/api/me/articles/${originalSlug}/submit`,
                { method: "POST" }
            )
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(json.error ?? `Failed to submit: ${res.status}`)
                return
            }
            router.refresh()
        } finally {
            setSubmittingForReview(false)
        }
    }

    return (
        <form onSubmit={onSubmit} className="space-y-6">
            {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            )}

            {isLocked && (
                <div className="rounded-md border border-medium/30 bg-medium-bg/50 px-4 py-3">
                    <div className="text-sm font-semibold text-medium-fg mb-1">
                        Locked — status is {initial.status}
                    </div>
                    <p className="text-sm">
                        {initial.status === "SUBMITTED"
                            ? "An admin is reviewing this article. You'll be able to edit again if it's sent back with feedback."
                            : initial.status === "PUBLISHED"
                                ? "Published articles are admin-managed. Ask an admin to demote it to draft if you need changes."
                                : "Archived articles are admin-managed."}
                    </p>
                </div>
            )}

            {initial.reviewNotes && initial.status === "DRAFT" && (
                <div className="rounded-md border border-medium/30 bg-medium-bg/50 px-4 py-3">
                    <div className="text-sm font-semibold text-medium-fg mb-1">
                        Reviewer feedback
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{initial.reviewNotes}</p>
                </div>
            )}

            <fieldset disabled={isLocked} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Basics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                            <Field label="Title" htmlFor="art-title" required>
                                <Input
                                    id="art-title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    required
                                />
                            </Field>
                            <Field
                                label="Slug"
                                htmlFor="art-slug"
                                description="URL identifier."
                                required
                            >
                                <Input
                                    id="art-slug"
                                    value={slug}
                                    onChange={(e) => {
                                        setSlug(e.target.value)
                                        setSlugTouched(true)
                                    }}
                                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                                    required
                                />
                            </Field>
                        </div>
                        <Field label="Topic" htmlFor="art-topic" required>
                            <select
                                id="art-topic"
                                value={topicSlug}
                                onChange={(e) => setTopicSlug(e.target.value)}
                                className="block w-full h-10 px-3 text-sm rounded-md border border-border bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                required
                            >
                                <option value="">— Select topic —</option>
                                {topics.map((t) => (
                                    <option key={t.slug} value={t.slug}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field
                            label="Summary"
                            htmlFor="art-summary"
                            description="One or two sentences shown on the topic page."
                        >
                            <Textarea
                                id="art-summary"
                                value={summary}
                                onChange={(e) => setSummary(e.target.value)}
                                rows={2}
                                className="font-sans"
                            />
                        </Field>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex items-center justify-between gap-3">
                        <CardTitle>Body</CardTitle>
                        <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1">
                            <button
                                type="button"
                                onClick={() => setEditorTab("write")}
                                aria-pressed={editorTab === "write"}
                                className={cn(
                                    "rounded-sm px-2.5 py-1 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer",
                                    editorTab === "write"
                                        ? "bg-surface-muted text-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <PenSquare className="h-3 w-3" />
                                Write
                            </button>
                            <button
                                type="button"
                                onClick={() => setEditorTab("preview")}
                                aria-pressed={editorTab === "preview"}
                                className={cn(
                                    "rounded-sm px-2.5 py-1 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer",
                                    editorTab === "preview"
                                        ? "bg-surface-muted text-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Eye className="h-3 w-3" />
                                Preview
                            </button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {editorTab === "write" ? (
                            <Textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                rows={24}
                                className="font-mono text-[13px]"
                                placeholder={"# Heading\n\nMarkdown body…"}
                                required
                            />
                        ) : (
                            <div className="rounded-md border border-border bg-surface px-5 py-4 min-h-[24rem]">
                                <MarkdownPreview content={content} />
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Tags</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <TagPicker value={tagSlugs} onChange={setTagSlugs} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Related problems</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <RelatedProblemsPicker
                            value={relatedProblemSlugs}
                            onChange={setRelatedProblemSlugs}
                        />
                    </CardContent>
                </Card>
            </fieldset>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sticky bottom-0 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-background/80 backdrop-blur border-t border-border">
                <Button
                    type="submit"
                    disabled={submitting || submittingForReview || isLocked}
                >
                    {submitting ? (
                        <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Saving…
                        </>
                    ) : (
                        <>
                            <Save className="h-3.5 w-3.5" />
                            {initial.mode === "create" ? "Save draft" : "Save changes"}
                        </>
                    )}
                </Button>
                {initial.mode === "edit" && initial.status === "DRAFT" && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={submitForReview}
                        disabled={submitting || submittingForReview}
                    >
                        {submittingForReview ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Send className="h-3.5 w-3.5" />
                        )}
                        Submit for review
                    </Button>
                )}
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => router.push("/me/articles")}
                    disabled={submitting || submittingForReview}
                >
                    Cancel
                </Button>
                {savedAt && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-easy">
                        <Check className="h-3.5 w-3.5" />
                        Saved
                    </span>
                )}
            </div>
        </form>
    )
}
