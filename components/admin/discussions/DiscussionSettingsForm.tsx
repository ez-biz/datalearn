"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import type { DiscussionSettings } from "@prisma/client"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Field, Input } from "@/components/ui/Input"

type SettingsFormState = Omit<
    DiscussionSettings,
    "id" | "updatedAt" | "updatedById"
>

const NUMBER_FIELDS: Array<{
    key: keyof Omit<SettingsFormState, "globalEnabled">
    label: string
    description: string
    min: number
    max: number
}> = [
    {
        key: "reportThreshold",
        label: "Report threshold",
        description: "Visible comments at or above this count enter review.",
        min: 1,
        max: 100,
    },
    {
        key: "editWindowMinutes",
        label: "Edit window minutes",
        description: "How long authors can edit visible comments.",
        min: 1,
        max: 1440,
    },
    {
        key: "duplicateCooldownSeconds",
        label: "Duplicate cooldown seconds",
        description: "Minimum time before posting the same body again.",
        min: 0,
        max: 86400,
    },
    {
        key: "bodyMaxChars",
        label: "Body max characters",
        description: "Maximum Markdown length for comments and replies.",
        min: 100,
        max: 20000,
    },
    {
        key: "trustedMinReputation",
        label: "Trusted reputation",
        description: "Minimum reputation for trusted rate limits.",
        min: 0,
        max: 1000000,
    },
    {
        key: "highTrustMinReputation",
        label: "High-trust reputation",
        description: "Minimum reputation for high-trust rate limits.",
        min: 0,
        max: 1000000,
    },
]

const RATE_LIMIT_GROUPS = [
    {
        title: "New users",
        fields: [
            ["newTopLevelPerHour", "Top-level per hour"],
            ["newRepliesPerHour", "Replies per hour"],
            ["newPerProblemPerDay", "Per problem per day"],
            ["newMinSecondsBetween", "Seconds between posts"],
            ["newVotesPerHour", "Votes per hour"],
        ],
    },
    {
        title: "Trusted users",
        fields: [
            ["trustedTopLevelPerHour", "Top-level per hour"],
            ["trustedRepliesPerHour", "Replies per hour"],
            ["trustedPerProblemPerDay", "Per problem per day"],
            ["trustedMinSecondsBetween", "Seconds between posts"],
            ["trustedVotesPerHour", "Votes per hour"],
        ],
    },
    {
        title: "High-trust users",
        fields: [
            ["highTopLevelPerHour", "Top-level per hour"],
            ["highRepliesPerHour", "Replies per hour"],
            ["highPerProblemPerDay", "Per problem per day"],
            ["highMinSecondsBetween", "Seconds between posts"],
            ["highVotesPerHour", "Votes per hour"],
        ],
    },
] as const

export function DiscussionSettingsForm({
    initialSettings,
}: {
    initialSettings: DiscussionSettings
}) {
    const router = useRouter()
    const [settings, setSettings] = useState<SettingsFormState>(
        toFormState(initialSettings)
    )
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [saved, setSaved] = useState(false)

    function updateNumber(key: keyof Omit<SettingsFormState, "globalEnabled">) {
        return (value: string) => {
            setSettings((current) => ({
                ...current,
                [key]: Number(value),
            }))
        }
    }

    async function save() {
        setSaving(true)
        setError(null)
        setSaved(false)
        try {
            const res = await fetch("/api/admin/discussions/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(json.error ?? "Failed to save settings.")
                return
            }
            setSettings(toFormState(json.data))
            setSaved(true)
            router.refresh()
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-4">
            <Card className="p-5">
                <label className="flex min-h-10 items-center gap-3">
                    <input
                        type="checkbox"
                        checked={settings.globalEnabled}
                        onChange={(e) =>
                            setSettings((current) => ({
                                ...current,
                                globalEnabled: e.target.checked,
                            }))
                        }
                        className="h-5 w-5 rounded border-border bg-surface text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <span>
                        <span className="block text-sm font-medium">
                            Enable learner discussions globally
                        </span>
                        <span className="block text-xs text-muted-foreground">
                            Problem-level hidden or locked modes still apply.
                        </span>
                    </span>
                </label>
            </Card>

            <Card className="p-5">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Moderation and trust
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                    {NUMBER_FIELDS.map((field) => (
                        <Field
                            key={field.key}
                            label={field.label}
                            htmlFor={field.key}
                            description={field.description}
                        >
                            <Input
                                id={field.key}
                                type="number"
                                min={field.min}
                                max={field.max}
                                value={settings[field.key]}
                                onChange={(e) =>
                                    updateNumber(field.key)(e.target.value)
                                }
                                className="tabular-nums"
                            />
                        </Field>
                    ))}
                </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
                {RATE_LIMIT_GROUPS.map((group) => (
                    <Card key={group.title} className="p-5">
                        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            {group.title}
                        </h2>
                        <div className="space-y-4">
                            {group.fields.map(([key, label]) => (
                                <Field key={key} label={label} htmlFor={key}>
                                    <Input
                                        id={key}
                                        type="number"
                                        min={0}
                                        value={settings[key]}
                                        onChange={(e) =>
                                            updateNumber(key)(e.target.value)
                                        }
                                        className="tabular-nums"
                                    />
                                </Field>
                            ))}
                        </div>
                    </Card>
                ))}
            </div>

            {error && (
                <div
                    role="alert"
                    className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                >
                    {error}
                </div>
            )}
            {saved && (
                <p className="text-sm text-muted-foreground">
                    Settings saved.
                </p>
            )}

            <div className="flex justify-end">
                <Button type="button" onClick={save} disabled={saving}>
                    {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Save className="h-3.5 w-3.5" />
                    )}
                    Save settings
                </Button>
            </div>
        </div>
    )
}

function toFormState(settings: DiscussionSettings): SettingsFormState {
    return {
        globalEnabled: settings.globalEnabled,
        reportThreshold: settings.reportThreshold,
        editWindowMinutes: settings.editWindowMinutes,
        duplicateCooldownSeconds: settings.duplicateCooldownSeconds,
        bodyMaxChars: settings.bodyMaxChars,
        trustedMinReputation: settings.trustedMinReputation,
        highTrustMinReputation: settings.highTrustMinReputation,
        newTopLevelPerHour: settings.newTopLevelPerHour,
        newRepliesPerHour: settings.newRepliesPerHour,
        newPerProblemPerDay: settings.newPerProblemPerDay,
        newMinSecondsBetween: settings.newMinSecondsBetween,
        newVotesPerHour: settings.newVotesPerHour,
        trustedTopLevelPerHour: settings.trustedTopLevelPerHour,
        trustedRepliesPerHour: settings.trustedRepliesPerHour,
        trustedPerProblemPerDay: settings.trustedPerProblemPerDay,
        trustedMinSecondsBetween: settings.trustedMinSecondsBetween,
        trustedVotesPerHour: settings.trustedVotesPerHour,
        highTopLevelPerHour: settings.highTopLevelPerHour,
        highRepliesPerHour: settings.highRepliesPerHour,
        highPerProblemPerDay: settings.highPerProblemPerDay,
        highMinSecondsBetween: settings.highMinSecondsBetween,
        highVotesPerHour: settings.highVotesPerHour,
    }
}
