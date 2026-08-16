import { AlertTriangle, Circle, CircleCheck, XCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { cn } from "@/lib/utils"

export type ChecklistState = "pass" | "fail" | "warn" | "pending"

export interface ChecklistItem {
    id: string
    label: string
    state: ChecklistState
    detail?: string
}

const STATE_ICON: Record<ChecklistState, typeof CircleCheck> = {
    pass: CircleCheck,
    fail: XCircle,
    warn: AlertTriangle,
    pending: Circle,
}

const STATE_ICON_CLASS: Record<ChecklistState, string> = {
    pass: "text-success",
    fail: "text-destructive",
    warn: "text-warning",
    pending: "text-muted-foreground",
}

const STATE_LABEL_CLASS: Record<ChecklistState, string> = {
    pass: "text-foreground",
    fail: "text-destructive",
    warn: "text-warning",
    pending: "text-muted-foreground",
}

/**
 * Read-only summary of three things the form already tracks in state —
 * it introduces no new validation rules and does not gate submission.
 * See `ProblemForm`'s `checklistItems` for what feeds each row:
 * per-dialect run outcome, per-dialect captured-output presence, and
 * tag count.
 */
export function ValidationChecklist({ items }: { items: ChecklistItem[] }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Before you save</CardTitle>
            </CardHeader>
            <CardContent>
                <ul className="space-y-3">
                    {items.map((item) => {
                        const Icon = STATE_ICON[item.state]
                        return (
                            <li key={item.id} className="flex items-start gap-2.5">
                                <Icon
                                    aria-hidden="true"
                                    className={cn(
                                        "mt-0.5 h-4 w-4 shrink-0",
                                        STATE_ICON_CLASS[item.state]
                                    )}
                                />
                                <div className="min-w-0">
                                    <p
                                        className={cn(
                                            "text-sm font-medium",
                                            STATE_LABEL_CLASS[item.state]
                                        )}
                                    >
                                        {item.label}
                                    </p>
                                    {item.detail && (
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            {item.detail}
                                        </p>
                                    )}
                                </div>
                            </li>
                        )
                    })}
                </ul>
            </CardContent>
        </Card>
    )
}
