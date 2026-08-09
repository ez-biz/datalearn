import { shouldPersist } from "@/lib/reading-progress"

type ProgressWriteResult = {
    ok: boolean
    percent: number
}

export type ProgressWrite = {
    percent: number
}

export type ProgressWriteAcknowledgement = {
    accepted: boolean
    next: ProgressWrite | null
}

/**
 * Serializes client-side progress writes while keeping the last server-
 * acknowledged value distinct from the latest local reading position.
 */
export class ProgressWriteQueue {
    private pending: number
    private inFlight: ProgressWrite | null = null
    private forcePending = false

    constructor(public acknowledged: number) {
        this.pending = acknowledged
    }

    flush(current: number, force = false): ProgressWrite | null {
        this.pending = Math.max(this.pending, current)
        this.forcePending ||= force
        return this.next()
    }

    acknowledge(
        write: ProgressWrite,
        result: ProgressWriteResult,
    ): ProgressWriteAcknowledgement {
        if (this.inFlight !== write) return { accepted: false, next: null }
        this.inFlight = null
        if (!result.ok) return { accepted: true, next: null }

        this.acknowledged = Math.max(this.acknowledged, result.percent)
        return { accepted: true, next: this.next() }
    }

    reset(percent: number): void {
        this.acknowledged = percent
        this.pending = percent
        this.inFlight = null
        this.forcePending = false
    }

    private next(): ProgressWrite | null {
        if (this.inFlight !== null || this.pending <= this.acknowledged) {
            return null
        }
        if (!this.forcePending && !shouldPersist(this.acknowledged, this.pending)) {
            return null
        }

        this.inFlight = { percent: this.pending }
        this.forcePending = false
        return this.inFlight
    }
}
