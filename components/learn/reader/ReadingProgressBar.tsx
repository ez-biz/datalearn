"use client"

import { useReaderProgress } from "./ReaderProgressProvider"

/**
 * The 2px bar pinned under the lesson header. Pure presentation — the
 * provider owns the measurement.
 */
export function ReadingProgressBar() {
    const percent = useReaderProgress()

    return (
        <div
            className="absolute inset-x-0 top-full h-0.5 bg-transparent"
            role="progressbar"
            aria-label="Reading progress"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
        >
            <div
                className="h-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${percent}%` }}
            />
        </div>
    )
}
