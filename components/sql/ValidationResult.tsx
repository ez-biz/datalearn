"use client"

import type { ValidationResult as VR } from "@/lib/sql-validator"

interface Props {
    result: VR | null
}

export function ValidationResult({ result }: Props) {
    if (!result) return null

    if (result.ok) {
        return (
            <div className="mt-2 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
                ✅ Correct
            </div>
        )
    }

    return (
        <div className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            <div className="font-semibold">✗ Not quite</div>
            <div className="mt-1">{result.reason}</div>
            {result.diff?.firstMismatch && (
                <details className="mt-2">
                    <summary className="cursor-pointer text-xs">
                        Row {result.diff.firstMismatch.index + 1} detail
                    </summary>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <div className="font-semibold">Your row</div>
                            <pre className="overflow-auto rounded bg-white p-2">
                                {JSON.stringify(result.diff.firstMismatch.user, null, 2)}
                            </pre>
                        </div>
                        <div>
                            <div className="font-semibold">Expected</div>
                            <pre className="overflow-auto rounded bg-white p-2">
                                {JSON.stringify(result.diff.firstMismatch.expected, null, 2)}
                            </pre>
                        </div>
                    </div>
                </details>
            )}
            {result.diff?.userKeys && result.diff.expectedKeys && (
                <div className="mt-2 text-xs">
                    Your columns: [{result.diff.userKeys.join(", ")}] •
                    Expected: [{result.diff.expectedKeys.join(", ")}]
                </div>
            )}
        </div>
    )
}
