"use client"

import {
    DiscussionPanel,
    type DiscussionMode,
} from "@/components/practice/discussion/DiscussionPanel"

interface DiscussionTabProps {
    slug: string
    isSignedIn: boolean
    viewerUserId: string | null
    discussionMode: DiscussionMode
    discussionEnabled: boolean
    prefillMarkdown: string | null
    onPrefillConsumed: () => void
}

/**
 * Thin wrapper over the existing DiscussionPanel.
 *
 * It exists so ProblemTabs holds a strip and five uniform tab bodies rather
 * than one inline exception, and so phase 4's approach composer has an
 * obvious home. LOCKED/HIDDEN handling stays inside DiscussionPanel, which
 * already implements it.
 */
export function DiscussionTab({
    slug,
    isSignedIn,
    viewerUserId,
    discussionMode,
    discussionEnabled,
    prefillMarkdown,
    onPrefillConsumed,
}: DiscussionTabProps) {
    return (
        <DiscussionPanel
            problemSlug={slug}
            isSignedIn={isSignedIn}
            viewerUserId={viewerUserId}
            discussionMode={discussionMode}
            discussionEnabled={discussionEnabled}
            prefillMarkdown={prefillMarkdown}
            onPrefillConsumed={onPrefillConsumed}
        />
    )
}
