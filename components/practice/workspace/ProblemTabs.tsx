"use client"

import { CheckCircle2 } from "lucide-react"
import { DifficultyBadge, Badge } from "@/components/ui/Badge"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/shadcn/tabs"
import { HistoryPanel } from "@/components/practice/HistoryPanel"
import type { DiscussionMode } from "@/components/practice/discussion/DiscussionPanel"
import type { Dialect } from "@/lib/sql-engine/types"
import type { ProblemHistoryEntry } from "@/actions/submissions"
import type {
    ProblemTab,
    RelatedArticle,
    TableInfo,
} from "@/lib/workspace/types"
import { DescriptionTab } from "./tabs/DescriptionTab"
import { HintsTab } from "./tabs/HintsTab"
import { SolutionsTab } from "./tabs/SolutionsTab"
import { DiscussionTab } from "./tabs/DiscussionTab"

interface ProblemTabsProps {
    number: number
    title: string
    difficulty: string
    description: string | null
    schemaDescription: string | null
    hints: string[]
    tableInfos: TableInfo[] | null
    tablesLoading: boolean
    expectedRows: Record<string, unknown>[] | null
    expectedColumns: string[] | null
    history: ProblemHistoryEntry[]
    isSolved: boolean
    relatedArticles: RelatedArticle[]
    onLoadCode: (code: string) => void
    onShareApproach?: (code: string) => void
    slug: string
    isSignedIn: boolean
    viewerUserId: string | null
    discussionMode: DiscussionMode
    discussionEnabled: boolean
    discussionPrefill: string | null
    onDiscussionPrefillConsumed: () => void
    firstVisit: boolean | null
    attemptCount: number
    acceptedCount: number
    comesFrom: React.ReactNode | null
    activeTab: ProblemTab
    onTabChange: (tab: ProblemTab) => void
    /** Engines this problem allows, for the solution dialect toggle. */
    dialects: readonly Dialect[]
    /** Engine the learner is currently on. */
    activeDialect: Dialect
    approachPrefill: string | null
    onApproachPrefillConsumed: () => void
}

/**
 * The problem panel's tab strip and bodies.
 *
 * Replaces the 525-line ProblemPanel.tsx: the strip lives here and each tab
 * is its own file, so adding Solutions (Task 9) does not grow this one.
 *
 * The Solutions tab is not wired yet — Task 9 promotes SolutionPanel into
 * it. Until then the strip shows the four tabs that existed before SP5.
 */
export function ProblemTabs({
    number,
    title,
    difficulty,
    description,
    schemaDescription,
    hints,
    tableInfos,
    tablesLoading,
    expectedRows,
    expectedColumns,
    history,
    isSolved,
    relatedArticles,
    onLoadCode,
    onShareApproach,
    slug,
    isSignedIn,
    viewerUserId,
    discussionMode,
    discussionEnabled,
    discussionPrefill,
    onDiscussionPrefillConsumed,
    firstVisit,
    comesFrom,
    attemptCount,
    acceptedCount,
    activeTab,
    onTabChange,
    dialects,
    activeDialect,
    approachPrefill,
    onApproachPrefillConsumed,
}: ProblemTabsProps) {
    const hasHints = hints.length > 0
    const showDiscussion = discussionEnabled && discussionMode !== "HIDDEN"
    // A HIDDEN discussion must not strand the panel on an empty tab.
    const tab =
        activeTab === "discussion" && !showDiscussion ? "description" : activeTab

    const shareApproach = (code: string) => {
        // Lands in the Solutions composer, not the discussion thread.
        onTabChange("solutions")
        onShareApproach?.(code)
    }

    return (
        <div className="flex h-full flex-col bg-surface">
            <div className="border-b border-border px-5 pb-3 pt-5">
                <div className="flex items-start justify-between gap-3">
                    <h1 className="text-xl font-semibold leading-tight tracking-tight">
                        <span className="mr-1.5 font-medium tabular-nums text-muted-foreground">
                            {number}.
                        </span>
                        {title}
                    </h1>
                    <div className="flex shrink-0 items-center gap-2">
                        <DifficultyBadge difficulty={difficulty} />
                        {isSolved && (
                            <Badge
                                variant="primary"
                                className="normal-case tracking-normal"
                            >
                                <CheckCircle2 className="h-3 w-3" />
                                Solved
                            </Badge>
                        )}
                    </div>
                </div>
            </div>

            <Tabs
                value={tab}
                onValueChange={(value) => onTabChange(value as ProblemTab)}
                className="min-h-0 flex-1 gap-0"
            >
                <div className="scrollbar-thin overflow-x-auto border-b border-border px-2">
                    <TabsList
                        variant="line"
                        className="h-auto min-w-max justify-start gap-1 p-0"
                    >
                        <TabsTrigger
                            value="description"
                            className="px-3 py-2.5 text-[13px]"
                        >
                            Description
                        </TabsTrigger>
                        {hasHints && (
                            <TabsTrigger
                                value="hints"
                                className="gap-1.5 px-3 py-2.5 text-[13px]"
                            >
                                Hints
                                <TabCount>{hints.length}</TabCount>
                            </TabsTrigger>
                        )}
                        <TabsTrigger
                            value="solutions"
                            className="px-3 py-2.5 text-[13px]"
                        >
                            Solutions
                        </TabsTrigger>
                        <TabsTrigger
                            value="history"
                            className="gap-1.5 px-3 py-2.5 text-[13px]"
                        >
                            Submissions
                            {history.length > 0 && (
                                <TabCount>{history.length}</TabCount>
                            )}
                        </TabsTrigger>
                        {showDiscussion && (
                            <TabsTrigger
                                value="discussion"
                                aria-label="Discussion"
                                className="px-3 py-2.5 text-[13px]"
                            >
                                Discussion
                            </TabsTrigger>
                        )}
                    </TabsList>
                </div>

                <TabsContent
                    value="description"
                    className="scrollbar-thin min-h-0 overflow-y-auto"
                >
                    <DescriptionTab
                        description={description}
                        schemaDescription={schemaDescription}
                        tableInfos={tableInfos}
                        tablesLoading={tablesLoading}
                        expectedRows={expectedRows}
                        expectedColumns={expectedColumns}
                        relatedArticles={relatedArticles}
                        firstVisit={firstVisit}
                        comesFrom={comesFrom}
                        attemptCount={attemptCount}
                        acceptedCount={acceptedCount}
                    />
                </TabsContent>

                {hasHints && (
                    <TabsContent
                        value="hints"
                        className="scrollbar-thin min-h-0 overflow-y-auto"
                    >
                        <HintsTab hints={hints} />
                    </TabsContent>
                )}

                <TabsContent
                    value="solutions"
                    className="scrollbar-thin min-h-0 overflow-y-auto"
                >
                    <SolutionsTab
                        slug={slug}
                        dialects={dialects}
                        activeDialect={activeDialect}
                        isSignedIn={isSignedIn}
                        isSolved={isSolved}
                        discussionMode={discussionMode}
                        approachPrefill={approachPrefill}
                        onApproachPrefillConsumed={onApproachPrefillConsumed}
                    />
                </TabsContent>

                <TabsContent
                    value="history"
                    className="scrollbar-thin min-h-0 overflow-y-auto"
                >
                    <HistoryPanel
                        history={history}
                        onLoadCode={onLoadCode}
                        onShareApproach={shareApproach}
                    />
                </TabsContent>

                {showDiscussion && (
                    <TabsContent value="discussion" className="min-h-0">
                        <DiscussionTab
                            slug={slug}
                            isSignedIn={isSignedIn}
                            viewerUserId={viewerUserId}
                            discussionMode={discussionMode}
                            discussionEnabled={discussionEnabled}
                            prefillMarkdown={discussionPrefill}
                            onPrefillConsumed={onDiscussionPrefillConsumed}
                        />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    )
}

function TabCount({ children }: { children: React.ReactNode }) {
    return (
        <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-surface-muted px-1.5 font-mono text-[10px] tabular-nums text-muted-foreground">
            {children}
        </span>
    )
}
