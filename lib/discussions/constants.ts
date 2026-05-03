export const DISCUSSION_SETTINGS_ID = "global"

export const DISCUSSION_PERMISSIONS = [
    "VIEW_DISCUSSION_QUEUE",
    "HIDE_COMMENT",
    "RESTORE_COMMENT",
    "DISMISS_REPORT",
    "MARK_SPAM",
    "LOCK_PROBLEM_DISCUSSION",
    "HIDE_PROBLEM_DISCUSSION",
] as const

export type DiscussionPermission = (typeof DISCUSSION_PERMISSIONS)[number]

export type ReputationTier = "NEW" | "TRUSTED" | "HIGH_TRUST"

export const TIER_LABELS: Record<ReputationTier, string> = {
    NEW: "New",
    TRUSTED: "Trusted",
    HIGH_TRUST: "High trust",
}
