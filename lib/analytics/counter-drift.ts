export type ProblemCounters = {
    problemId: string
    number: number
    title: string
    attemptCount: number
    acceptedCount: number
}

export type TrueCounts = {
    attempts: number
    accepted: number
}

export type DriftRow = {
    problemId: string
    number: number
    title: string
    attemptDrift: number
    acceptedDrift: number
}

export type DriftReport = {
    checked: number
    drifted: DriftRow[]
}

export function findDrift(
    counters: ProblemCounters[],
    truth: Map<string, TrueCounts>
): DriftReport {
    const drifted = counters.flatMap((counter) => {
        const counts = truth.get(counter.problemId) ?? { attempts: 0, accepted: 0 }
        const attemptDrift = counter.attemptCount - counts.attempts
        const acceptedDrift = counter.acceptedCount - counts.accepted

        if (attemptDrift === 0 && acceptedDrift === 0) {
            return []
        }

        return [
            {
                problemId: counter.problemId,
                number: counter.number,
                title: counter.title,
                attemptDrift,
                acceptedDrift,
            },
        ]
    })

    drifted.sort(
        (left, right) =>
            Math.abs(right.attemptDrift) + Math.abs(right.acceptedDrift) -
            (Math.abs(left.attemptDrift) + Math.abs(left.acceptedDrift))
    )

    return { checked: counters.length, drifted }
}
