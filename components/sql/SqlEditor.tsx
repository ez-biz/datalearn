"use client"

import Editor from "@monaco-editor/react"

interface SqlEditorProps {
    value: string
    onChange: (value: string | undefined) => void
    onRun: () => void
}

export function SqlEditor({ value, onChange, onRun }: SqlEditorProps) {
    return (
        <div className="h-full flex flex-col border rounded-lg overflow-hidden bg-[#1e1e1e]">
            <div className="flex items-center justify-between p-2 bg-[#252526] border-b border-[#333]">
                <span className="text-xs text-gray-400 font-mono">SQL Editor</span>
                <button
                    onClick={onRun}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded flex items-center gap-2 transition-colors"
                >
                    <span>▶ Run</span>
                </button>
            </div>
            <div className="flex-1">
                <Editor
                    height="100%"
                    defaultLanguage="sql"
                    theme="vs-dark"
                    value={value}
                    onChange={onChange}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        padding: { top: 16 },
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                    }}
                />
            </div>
        </div>
    )
}
