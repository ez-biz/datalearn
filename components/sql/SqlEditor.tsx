"use client"

import Editor, { type OnMount } from "@monaco-editor/react"
import { Database, Play } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/Button"
import type { Dialect } from "@/lib/use-problem-db"
import { cn } from "@/lib/utils"

const DIALECT_LABEL: Record<Dialect, string> = {
    DUCKDB: "DuckDB",
    POSTGRES: "Postgres",
}

interface SqlEditorProps {
    value: string
    onChange: (value: string | undefined) => void
    onRun: () => void
    onSubmit?: () => void
    running?: boolean
    /** Currently selected engine. */
    dialect?: Dialect
    /** Engines this problem allows. If only one, the toggle becomes a static badge. */
    allowedDialects?: Dialect[]
    /** Called when learner picks a different engine. */
    onDialectChange?: (d: Dialect) => void
}

export function SqlEditor({
    value,
    onChange,
    onRun,
    onSubmit,
    running,
    dialect = "DUCKDB",
    allowedDialects = ["DUCKDB"],
    onDialectChange,
}: SqlEditorProps) {
    const { resolvedTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])

    // Hold latest callbacks so Monaco's keybindings (registered once) always fire fresh handlers
    const onRunRef = useRef(onRun)
    const onSubmitRef = useRef(onSubmit)
    useEffect(() => {
        onRunRef.current = onRun
        onSubmitRef.current = onSubmit
    })

    const editorTheme = mounted && resolvedTheme === "dark" ? "vs-dark" : "vs"
    const headerBg =
        mounted && resolvedTheme === "dark"
            ? "bg-[#1e1e1e] border-[#333]"
            : "bg-surface-muted border-border"
    const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
    const modKey = isMac ? "⌘" : "Ctrl"

    const handleMount: OnMount = (editor, monaco) => {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
            onRunRef.current?.()
        })
        editor.addCommand(
            monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter,
            () => {
                onSubmitRef.current?.()
            }
        )
    }

    return (
        <div className="h-full flex flex-col rounded-lg border border-border overflow-hidden bg-surface">
            <div
                className={`flex items-center justify-between px-3 py-2 border-b ${headerBg}`}
            >
                <DialectToggle
                    dialect={dialect}
                    allowed={allowedDialects}
                    onChange={onDialectChange}
                    disabled={running}
                />
                <div className="flex items-center gap-2">
                    <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {modKey} ↵
                    </kbd>
                    <Button
                        onClick={onRun}
                        disabled={running}
                        size="sm"
                        variant="primary"
                        className="h-7 px-2.5 text-xs"
                        title={`Run query (${modKey} ↵)`}
                    >
                        <Play className="h-3 w-3 fill-current" />
                        {running ? "Running…" : "Run"}
                    </Button>
                </div>
            </div>
            <div className="flex-1 min-h-0">
                <Editor
                    height="100%"
                    defaultLanguage="sql"
                    theme={editorTheme}
                    value={value}
                    onChange={onChange}
                    onMount={handleMount}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        fontFamily:
                            "var(--font-jetbrains), ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontLigatures: false,
                        padding: { top: 14, bottom: 14 },
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        smoothScrolling: true,
                        renderLineHighlight: "line",
                        cursorBlinking: "smooth",
                        scrollbar: {
                            verticalScrollbarSize: 10,
                            horizontalScrollbarSize: 10,
                        },
                    }}
                />
            </div>
        </div>
    )
}

/**
 * Single-button dialect toggle. Clicking anywhere on the pill flips
 * to the other dialect. The active half is highlighted with a thumb;
 * the inactive half is muted. When only one dialect is allowed, it
 * renders as a static badge with the engine name.
 */
function DialectToggle({
    dialect,
    allowed,
    onChange,
    disabled,
}: {
    dialect: Dialect
    allowed: Dialect[]
    onChange?: (d: Dialect) => void
    disabled?: boolean
}) {
    const isToggleable = allowed.length > 1 && Boolean(onChange)

    if (!isToggleable) {
        return (
            <span
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-muted-foreground"
                title={`Engine: ${DIALECT_LABEL[dialect]}`}
            >
                <Database className="h-3 w-3" />
                {DIALECT_LABEL[dialect]}
            </span>
        )
    }

    // Stable order so the thumb position is deterministic per click.
    const ordered: Dialect[] = ["DUCKDB", "POSTGRES"].filter((d) =>
        allowed.includes(d as Dialect)
    ) as Dialect[]
    const otherDialect = ordered.find((d) => d !== dialect) ?? ordered[0]

    return (
        <button
            type="button"
            onClick={() => onChange?.(otherDialect)}
            disabled={disabled}
            aria-label={`Switch engine to ${DIALECT_LABEL[otherDialect]}`}
            title={`Switch to ${DIALECT_LABEL[otherDialect]}`}
            className={cn(
                "relative inline-flex items-center gap-0 rounded-md border border-border bg-surface p-0.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 transition-colors",
                "hover:border-border-strong"
            )}
        >
            {ordered.map((d) => {
                const active = d === dialect
                return (
                    <span
                        key={d}
                        className={cn(
                            "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-medium transition-colors",
                            active
                                ? "bg-surface-muted text-foreground"
                                : "text-muted-foreground"
                        )}
                    >
                        {active && <Database className="h-3 w-3" />}
                        {DIALECT_LABEL[d]}
                    </span>
                )
            })}
        </button>
    )
}
