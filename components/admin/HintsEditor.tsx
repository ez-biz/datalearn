"use client"

import { GripVertical, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Textarea } from "@/components/ui/Input"

interface HintsEditorProps {
    value: string[]
    onChange: (next: string[]) => void
}

export function HintsEditor({ value, onChange }: HintsEditorProps) {
    function update(i: number, v: string) {
        const next = [...value]
        next[i] = v
        onChange(next)
    }
    function remove(i: number) {
        onChange(value.filter((_, idx) => idx !== i))
    }
    function add() {
        onChange([...value, ""])
    }
    function move(i: number, dir: -1 | 1) {
        const j = i + dir
        if (j < 0 || j >= value.length) return
        const next = [...value]
        ;[next[i], next[j]] = [next[j], next[i]]
        onChange(next)
    }

    return (
        <div className="space-y-2">
            {value.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                    No hints yet. Add one to enable progressive disclosure on the
                    problem page.
                </p>
            )}
            {value.map((hint, i) => (
                <div
                    key={i}
                    className="flex items-start gap-2 rounded-md border border-border bg-surface p-2"
                >
                    <div className="flex flex-col items-center pt-1.5">
                        <button
                            type="button"
                            onClick={() => move(i, -1)}
                            disabled={i === 0}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                            aria-label="Move up"
                        >
                            <GripVertical className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-[10px] tabular-nums text-muted-foreground">
                            {i + 1}
                        </span>
                    </div>
                    <Textarea
                        value={hint}
                        onChange={(e) => update(i, e.target.value)}
                        rows={2}
                        placeholder={`Hint ${i + 1}`}
                        className="font-sans"
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(i)}
                        aria-label="Remove hint"
                        className="text-muted-foreground hover:text-destructive"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ))}
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={add}
                disabled={value.length >= 10}
            >
                <Plus className="h-3.5 w-3.5" />
                Add hint
            </Button>
        </div>
    )
}
