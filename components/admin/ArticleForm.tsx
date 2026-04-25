"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
    Check,
    CheckCircle2,
    Eye,
    Loader2,
    PenSquare,
    Save,
    Send,
    XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Field, Input, Textarea } from "@/components/ui/Input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { TagPicker } from "./TagPicker"
import { RelatedProblemsPicker } from "./RelatedProblemsPicker"
import { MarkdownPreview } from "./MarkdownPreview"
import { slugify } from "@/lib/admin-validation"
import { cn } from "@/lib/utils"

type ArticleStatus = "DRAFT" | "SUBMITTED" | "PUBLISHED" | "ARCHIVED"

interface TopicOption {
    slug: string
    name: string
}

export interface ArticleFormInitial {
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

const DRAFT_PREFIX = "dl:article-draft:"

export function ArticleForm({
    initial,
    originalSlug,
}: {
    initial: ArticleFormInitial
    originalSlug?: string
}) {
    const router = useRouter()
    const [title, setTitle] = useState(initial.title)
    const [slug, setSlug] = useState(initial.slug)
    const [slugTouched, setSlugTouched] = useState(initial.mode === "edit")
    const [topicSlug, setTopicSlug] = useState(initial.topicSlug)
    const [content, setContent] = useState(initial.content)
    const [summary, setSummary] = useState(initial.summary)
    const [status, setStatus] = useState<ArticleStatus>(initial.status)
    const [tagSlugs, setTagSlugs] = useState<string[]>(initial.tagSlugs)
    const [relatedProblemSlugs, setRelatedProblemSlugs] = useState<string[]>(
        initial.relatedProblemSlugs
    )
    const [topics, setTopics] = useState<TopicOption[]>([])
    const [editorTab, setEditorTab] = useState<"write" | "preview">("write")
    const [submitting, setSubmitting] = useState(false)
    const [actionPending, setActionPending] = useState<null | string>(null)
    const [error, setError] = useState<string | null>(null)
    const [savedAt, setSavedAt] = useState<number | null>(null)
    const [draftHydrated, setDraftHydrated] = useState(initial.mode === "edit")

    const draftKey = `${DRAFT_PREFIX}${originalSlug ?? "__new__"}`

    // Load topics
    useEffect(() => {
        ;(async () => {
            const res = await fetch("/api/admin/topics")
            if (res.ok) {
                const json = await res.json()
                setTopics(json.data ?? [])
            }
        })()
    }, [])

    // Slug auto-derive from title
    useEffect(() => {
        if (!slugTouched) setSlug(slugify(title))
    }, [title, slugTouched])

    // Hydrate draft for create mode
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

    // Autosave drafts (create mode only — edit mode persists via the API)
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

    // Auto-clear "Saved"
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
            status,
            tagSlugs,
            relatedProblemSlugs,
        }
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setSubmitting(true)
        try {
            const url =
                initial.mode === "create"
                    ? "/api/admin/articles"
                    : `/api/admin/articles/${originalSlug}`
            const method = initial.mode === "create" ? "POST" : "PATCH"
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildPayload()),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(json.error ?? `Request failed: ${res.status}`)
                if (json.details) console.error("Validation:", json.details)
                return
            }
            const newSlug = json?.data?.slug ?? slug
            if (initial.mode === "create") {
                try {
                    localStorage.removeItem(draftKey)
                } catch {}
                router.push(`/admin/articles/${newSlug}/edit`)
                router.refresh()
            } else {
                if (newSlug !== originalSlug) {
                    router.push(`/admin/articles/${newSlug}/edit`)
                }
                setSavedAt(Date.now())
                router.refresh()
            }
        } finally {
            setSubmitting(false)
        }
    }

    async function runQueueAction(
        action: "submit" | "approve" | "reject" | "archive",
        body?: Record<string, unknown>
    ) {
        if (!originalSlug) return
        setError(null)
        setActionPending(action)
        try {
            const res = await fetch(
                `/api/admin/articles/${originalSlug}/${action}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: body ? JSON.stringify(body) : undefined,
                }
            )
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(json.error ?? `Action failed: ${res.status}`)
                return
            }
            router.refresh()
        } finally {
            setActionPending(null)
        }
    }

    const isCreate = initial.mode === "create"
    const showSubmitBtn = !isCreate && status === "DRAFT"
    const showApproveBtn = !isCreate && status === "SUBMITTED"
    const showRejectBtn = !isCreate && status === "SUBMITTED"
    const showArchiveBtn = !isCreate && status === "PUBLISHED"

    return (
        <form onSubmit={onSubmit} className="space-y-6">
            {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            )}

            {initial.reviewNotes && status === "DRAFT" && (
                <div className="rounded-md border border-medium/30 bg-medium-bg/50 px-4 py-3">
                    <div className="text-sm font-semibold text-medium-fg mb-1">
                        Reviewer feedback
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{initial.reviewNotes}</p>
                </div>
            )}

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
                                placeholder="What is OLAP?"
                                required
                            />
                        </Field>
                        <Field
                            label="Slug"
                            htmlFor="art-slug"
                            description="Lowercase, hyphenated. Used in the URL."
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
                    <div className="grid sm:grid-cols-2 gap-4">
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
                            label="Status"
                            htmlFor="art-status"
                            description="Only PUBLISHED is visible to readers."
                            required
                        >
                            <select
                                id="art-status"
                                value={status}
                                onChange={(e) =>
                                    setStatus(e.target.value as ArticleStatus)
                                }
                                className="block w-full h-10 px-3 text-sm rounded-md border border-border bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <option value="DRAFT">Draft</option>
                                <option value="SUBMITTED">In review</option>
                                <option value="PUBLISHED">Published</option>
                                <option value="ARCHIVED">Archived</option>
                            </select>
                        </Field>
                    </div>
                    <Field
                        label="Summary"
                        htmlFor="art-summary"
                        description="One or two sentences shown on cards and the topic page."
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
                            placeholder={"# Heading\n\nWrite your article in Markdown.\n\n## Section\n\nText, code blocks, lists — all supported."}
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

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sticky bottom-0 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-background/80 backdrop-blur border-t border-border">
                <Button type="submit" disabled={submitting || actionPending != null}>
                    {submitting ? (
                        <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Saving…
                        </>
                    ) : (
                        <>
                            <Save className="h-3.5 w-3.5" />
                            {isCreate ? "Create" : "Save changes"}
                        </>
                    )}
                </Button>
                {showSubmitBtn && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => runQueueAction("submit")}
                        disabled={actionPending != null || submitting}
                    >
                        {actionPending === "submit" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Send className="h-3.5 w-3.5" />
                        )}
                        Submit for review
                    </Button>
                )}
                {showApproveBtn && (
                    <Button
                        type="button"
                        onClick={() => runQueueAction("approve")}
                        disabled={actionPending != null || submitting}
                    >
                        {actionPending === "approve" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Approve
                    </Button>
                )}
                {showRejectBtn && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            const notes = prompt("Reviewer notes (required):")
                            if (!notes) return
                            runQueueAction("reject", { reviewNotes: notes })
                        }}
                        disabled={actionPending != null || submitting}
                    >
                        {actionPending === "reject" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <XCircle className="h-3.5 w-3.5" />
                        )}
                        Reject
                    </Button>
                )}
                {showArchiveBtn && (
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                            if (!confirm("Archive this article? It will be hidden from readers.")) return
                            runQueueAction("archive")
                        }}
                        disabled={actionPending != null || submitting}
                    >
                        {actionPending === "archive" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        Archive
                    </Button>
                )}
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => router.push("/admin/articles")}
                    disabled={submitting || actionPending != null}
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
