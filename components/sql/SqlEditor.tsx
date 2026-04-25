"use client"

import Editor, { type OnMount } from "@monaco-editor/react"
import { Play, Terminal } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/Button"

interface SqlEditorProps {
    value: string
    onChange: (value: string | undefined) => void
    onRun: () => void
    onSubmit?: () => void
    running?: boolean
}

export function SqlEditor({ value, onChange, onRun, onSubmit, running }: SqlEditorProps) {
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
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Terminal className="h-3.5 w-3.5" />
                    SQL editor
                </span>
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
