"use client"

import { useEffect } from "react"

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error("Application error:", error)
    }, [error])

    return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center text-center px-4">
            <div className="mb-6 text-6xl">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Something went wrong
            </h1>
            <p className="text-gray-500 mb-8 max-w-md">
                An unexpected error occurred. Please try again.
            </p>
            <button
                onClick={reset}
                className="px-6 py-3 bg-black text-white rounded-full font-semibold hover:bg-gray-800 transition-colors"
            >
                Try Again
            </button>
        </div>
    )
}
