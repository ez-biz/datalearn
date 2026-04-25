"use client"

import Editor from "@monaco-editor/react"
import { Play, Terminal } from "lucide-react"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/Button"

interface SqlEditorProps {
    value: string
    onChange: (value: string | undefined) => void
    onRun: () => void
    running?: boolean
}

export function SqlEditor({ value, onChange, onRun, running }: SqlEditorProps) {
    const { resolvedTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])

    const editorTheme = mounted && resolvedTheme === "dark" ? "vs-dark" : "vs"
    const headerBg =
        mounted && resolvedTheme === "dark"
            ? "bg-[#1e1e1e] border-[#333]"
            : "bg-surface-muted border-border"

    return (
        <div className="h-full flex flex-col rounded-lg border border-border overflow-hidden bg-surface">
            <div
                className={`flex items-center justify-between px-3 py-2 border-b ${headerBg}`}
            >
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Terminal className="h-3.5 w-3.5" />
                    SQL editor
                </span>
                <Button
                    onClick={onRun}
                    disabled={running}
                    size="sm"
                    variant="primary"
                    className="h-7 px-2.5 text-xs"
                >
                    <Play className="h-3 w-3 fill-current" />
                    {running ? "Running…" : "Run"}
                </Button>
            </div>
            <div className="flex-1 min-h-0">
                <Editor
                    height="100%"
                    defaultLanguage="sql"
                    theme={editorTheme}
                    value={value}
                    onChange={onChange}
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
