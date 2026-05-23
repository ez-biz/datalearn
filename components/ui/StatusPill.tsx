import { cn } from "@/lib/utils"

export type StatusPillStatus = "accepted" | "rejected" | "pending" | "draft"

interface StatusPillProps {
    status: StatusPillStatus
    label?: string
    icon?: React.ReactNode
    className?: string
}

const DEFAULT_LABEL: Record<StatusPillStatus, string> = {
    accepted: "▸ accepted",
    rejected: "✗ rejected",
    pending: "⊗ pending",
    draft: "· draft",
}

export function StatusPill({ status, label, icon, className }: StatusPillProps) {
    return (
        <span className={cn("pill", `pill-${status}`, className)}>
            {icon}
            <span>{label ?? DEFAULT_LABEL[status]}</span>
        </span>
    )
}
