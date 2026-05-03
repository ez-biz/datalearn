import assert from "node:assert/strict"
import {
    DiscussionCommentCreateInput,
    DiscussionCommentEditInput,
    ModeratorPermissionUpdateInput,
    validateDiscussionSettingsUpdate,
} from "../lib/admin-validation"
import { tierForScore } from "../lib/discussions/reputation"

const settings = {
    trustedMinReputation: 20,
    highTrustMinReputation: 100,
}

assert.equal(tierForScore(0, settings), "NEW")
assert.equal(tierForScore(20, settings), "TRUSTED")
assert.equal(tierForScore(99, settings), "TRUSTED")
assert.equal(tierForScore(100, settings), "HIGH_TRUST")

const currentThresholds = {
    trustedMinReputation: 20,
    highTrustMinReputation: 100,
}

assert.equal(
    validateDiscussionSettingsUpdate(currentThresholds, {
        trustedMinReputation: 500,
    }).success,
    false
)
assert.equal(
    validateDiscussionSettingsUpdate(currentThresholds, {
        highTrustMinReputation: 500,
    }).success,
    true
)

assert.equal(
    ModeratorPermissionUpdateInput.safeParse({
        permissions: ["HIDE_COMMENT", "HIDE_COMMENT"],
    }).success,
    false
)

const overCapPermissions = ModeratorPermissionUpdateInput.safeParse({
    permissions: [
        "VIEW_DISCUSSION_QUEUE",
        "HIDE_COMMENT",
        "RESTORE_COMMENT",
        "DISMISS_REPORT",
        "MARK_SPAM",
        "LOCK_PROBLEM_DISCUSSION",
        "HIDE_PROBLEM_DISCUSSION",
        "HIDE_COMMENT",
    ],
})
assert.equal(overCapPermissions.success, false)
assert.equal(
    !overCapPermissions.success &&
        overCapPermissions.error.issues.some((issue) => issue.code === "too_big"),
    true
)

assert.equal(
    DiscussionCommentCreateInput.safeParse({ bodyMarkdown: "   \n\t" }).success,
    false
)
assert.equal(
    DiscussionCommentEditInput.safeParse({ bodyMarkdown: "   \n\t" }).success,
    false
)

console.log("discussion helper tests passed")
