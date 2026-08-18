export type FunnelInput = {
    key: string
    label: string
    count: number
}

export type FunnelStep = FunnelInput & {
    rateFromPrevious: number | null
    rateFromStart: number | null
}

function rate(count: number, denominator: number): number | null {
    return denominator === 0 ? null : count / denominator
}

export function buildFunnel(steps: FunnelInput[]): FunnelStep[] {
    if (steps.length === 0) {
        return []
    }

    const startCount = steps[0].count

    return steps.map((step, index) => ({
        ...step,
        rateFromPrevious:
            index === 0 ? null : rate(step.count, steps[index - 1].count),
        rateFromStart: index === 0 ? null : rate(step.count, startCount),
    }))
}
