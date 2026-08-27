"use client"

import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"
import type { SqlLevel } from "@/lib/onboarding/entry-point"

const OPTIONS: { value: SqlLevel; label: string; detail: string }[] = [
    {
        value: "NEW",
        label: "New to SQL",
        detail: "Start from SELECT and filtering",
    },
    {
        value: "INTERMEDIATE",
        label: "I can write JOINs and GROUP BY",
        detail: "Skip the basics, start at aggregation",
    },
    {
        value: "ADVANCED",
        label: "Prepping for senior interviews",
        detail: "Window functions, CTEs, optimization",
    },
]

export function LevelStep({
    firstName,
    selected,
    onSelect,
    onContinue,
    onSkip,
    busy,
    error,
}: {
    firstName: string | null
    selected: SqlLevel | null
    onSelect: (level: SqlLevel) => void
    onContinue: () => void
    onSkip: () => void
    busy: boolean
    error: string | null
}) {
    return (
        <div className="mx-auto w-full max-w-lg">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {firstName ? `Welcome, ${firstName}.` : "Welcome to Data Learn."}
            </h1>
            <p className="mt-2 text-muted-foreground">
                One question, then we&rsquo;ll point you at a starting lesson.
            </p>

            <fieldset className="mt-8">
                <legend className="text-sm font-medium">
                    How comfortable are you with SQL?
                </legend>
                <div className="mt-3 space-y-2">
                    {OPTIONS.map((option) => {
                        const isSelected = selected === option.value
                        return (
                            <label
                                key={option.value}
                                className={cn(
                                    "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
                                    isSelected
                                        ? "border-primary bg-primary/5"
                                        : "border-border bg-surface hover:border-primary/40",
                                )}
                            >
                                <input
                                    type="radio"
                                    name="sql-level"
                                    value={option.value}
                                    checked={isSelected}
                                    onChange={() => onSelect(option.value)}
                                    className="mt-1 accent-primary"
                                />
                                <span>
                                    <span className="block text-sm font-medium">
                                        {option.label}
                                    </span>
                                    <span className="block text-sm text-muted-foreground">
                                        {option.detail}
                                    </span>
                                </span>
                            </label>
                        )
                    })}
                </div>
            </fieldset>

            {error ? (
                <p className="mt-4 text-sm text-destructive" role="alert">
                    {error}
                </p>
            ) : null}

            <div className="mt-8 flex items-center justify-between gap-4">
                <Button variant="ghost" onClick={onSkip} disabled={busy}>
                    Skip
                </Button>
                <Button onClick={onContinue} disabled={!selected || busy}>
                    Continue
                </Button>
            </div>
        </div>
    )
}
