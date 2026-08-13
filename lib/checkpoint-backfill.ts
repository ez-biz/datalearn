// Pure planner for migrating Article.relatedProblems (the implicit
// ArticleProblems m2m) into LessonCheckpoint. No Prisma — the script in
// scripts/backfill-checkpoints.ts fetches the pairs and applies the plan.
//
// LessonCheckpoint has @@unique([problemId]): a problem checks exactly one
// lesson. Existing data may link one problem to several articles, so the
// planner picks a winner and REPORTS every pair it drops. Silent data loss
// during a migration is not acceptable.

export type BackfillPair = {
    articleId: string
    articleCreatedAt: Date
    problemId: string
}

export type BackfillPlan = {
    create: Array<{ articleId: string; problemId: string; position: number }>
    skipped: Array<{
        problemId: string
        keptArticleId: string
        droppedArticleId: string
    }>
}

/**
 * Non-finite times (e.g. an invalid Date) sort last rather than producing
 * NaN from a raw subtraction, which is unspecified sort behaviour and would
 * break the "deterministic across runs" guarantee.
 */
function timeOf(date: Date): number {
    const t = date.getTime()
    return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY
}

/**
 * Tiebreak: earliest Article.createdAt wins; ties break on articleId
 * ascending so the plan is deterministic across runs.
 */
export function planCheckpointBackfill(pairs: BackfillPair[]): BackfillPlan {
    const byProblem = new Map<string, BackfillPair[]>()
    for (const pair of pairs) {
        const list = byProblem.get(pair.problemId)
        if (list) list.push(pair)
        else byProblem.set(pair.problemId, [pair])
    }

    const winners: BackfillPair[] = []
    const skipped: BackfillPlan["skipped"] = []

    for (const [problemId, candidates] of byProblem) {
        const sorted = [...candidates].sort((a, b) => {
            const byDate = timeOf(a.articleCreatedAt) - timeOf(b.articleCreatedAt)
            if (byDate !== 0) return byDate
            return a.articleId < b.articleId ? -1 : a.articleId > b.articleId ? 1 : 0
        })
        const [winner, ...losers] = sorted
        winners.push(winner)
        for (const loser of losers) {
            skipped.push({
                problemId,
                keptArticleId: winner.articleId,
                droppedArticleId: loser.articleId,
            })
        }
    }

    // Position within each article, 0-based and contiguous. Within one
    // article the winners are ordered by problemId ascending — an opaque
    // cuid order, NOT the original relatedProblems sequence, which the
    // implicit m2m does not record. If a meaningful order is ever needed,
    // it has to come from somewhere else; re-sort the checkpoints after
    // backfilling rather than trusting this one.
    const nextPosition = new Map<string, number>()
    const create = winners
        .sort((a, b) => {
            const byDate = timeOf(a.articleCreatedAt) - timeOf(b.articleCreatedAt)
            if (byDate !== 0) return byDate
            if (a.articleId !== b.articleId)
                return a.articleId < b.articleId ? -1 : 1
            return a.problemId < b.problemId ? -1 : a.problemId > b.problemId ? 1 : 0
        })
        .map((w) => {
            const position = nextPosition.get(w.articleId) ?? 0
            nextPosition.set(w.articleId, position + 1)
            return {
                articleId: w.articleId,
                problemId: w.problemId,
                position,
            }
        })

    return { create, skipped }
}
