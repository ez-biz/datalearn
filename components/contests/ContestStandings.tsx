import { Card } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { cn } from "@/lib/utils"
import { formatPenalty, type LeaderboardRow } from "@/lib/contests/leaderboard"

type Props = {
    rows: LeaderboardRow[]
    viewerUserId: string | null
    status: "LIVE" | "CLOSED"
}

export function ContestStandings({ rows, viewerUserId, status }: Props) {
    return (
        <div className="mt-8">
            <h2 className="mb-3 text-base font-semibold">Standings</h2>
            {rows.length === 0 ? (
                <EmptyState
                    title={
                        status === "LIVE"
                            ? "No submissions yet"
                            : "No one solved a problem"
                    }
                    description={
                        status === "LIVE"
                            ? "Be the first to solve a problem and take the lead."
                            : "No participant solved a problem in this contest."
                    }
                />
            ) : (
                <Card className="overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                                <th className="px-5 py-3 font-medium">Rank</th>
                                <th className="px-5 py-3 font-medium">
                                    Participant
                                </th>
                                <th className="px-5 py-3 text-right font-medium">
                                    Solved
                                </th>
                                <th className="px-5 py-3 text-right font-medium">
                                    Points
                                </th>
                                <th className="px-5 py-3 text-right font-medium">
                                    Penalty
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {rows.map((row) => {
                                const isViewer = row.userId === viewerUserId
                                return (
                                    <tr
                                        key={row.userId}
                                        className={cn(isViewer && "bg-primary/5")}
                                    >
                                        <td className="px-5 py-3 tabular-nums text-muted-foreground">
                                            {row.rank}
                                        </td>
                                        <td className="px-5 py-3 font-medium">
                                            {isViewer ? "You" : row.participant}
                                        </td>
                                        <td className="px-5 py-3 text-right tabular-nums">
                                            {row.solvedCount}
                                        </td>
                                        <td className="px-5 py-3 text-right tabular-nums">
                                            {row.points}
                                        </td>
                                        <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                                            {formatPenalty(row.penaltySeconds)}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </Card>
            )}
        </div>
    )
}
