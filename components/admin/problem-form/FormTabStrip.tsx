"use client"

import type { KeyboardEvent } from "react"
import { FORM_TABS, type FormTabId } from "@/lib/admin/form-tabs"
import { cn } from "@/lib/utils"

interface FormTabStripProps {
    activeTab: FormTabId
    erroredTabs: FormTabId[]
    onSelect: (tab: FormTabId) => void
}

/**
 * The tab strip above the problem form. `FORM_TABS` (identity, order,
 * labels) and `erroredTabs` (from `tabsWithErrors`) both come from
 * `lib/admin/form-tabs.ts` — that module is authoritative for tab
 * placement, this component only renders what it's given.
 *
 * Every field in the form stays mounted regardless of which tab is
 * active — switching tabs only toggles the `hidden` attribute on each
 * `role="tabpanel"`. That makes the native ARIA tabs pattern (inactive
 * panels present in the DOM but `hidden`) the CORRECT implementation
 * here, not a workaround: it's simultaneously what accessibility guidance
 * asks for and what the mounted-fields guarantee requires.
 */
export function FormTabStrip({ activeTab, erroredTabs, onSelect }: FormTabStripProps) {
    const erroredSet = new Set(erroredTabs)

    function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
        const idx = FORM_TABS.findIndex((t) => t.id === activeTab)
        if (idx === -1) return
        if (e.key === "ArrowRight") {
            e.preventDefault()
            onSelect(FORM_TABS[(idx + 1) % FORM_TABS.length].id)
        } else if (e.key === "ArrowLeft") {
            e.preventDefault()
            onSelect(FORM_TABS[(idx - 1 + FORM_TABS.length) % FORM_TABS.length].id)
        } else if (e.key === "Home") {
            e.preventDefault()
            onSelect(FORM_TABS[0].id)
        } else if (e.key === "End") {
            e.preventDefault()
            onSelect(FORM_TABS[FORM_TABS.length - 1].id)
        }
    }

    return (
        <div
            role="tablist"
            aria-label="Problem form sections"
            onKeyDown={onKeyDown}
            className="flex gap-1 overflow-x-auto border-b border-border"
        >
            {FORM_TABS.map((tab) => {
                const active = tab.id === activeTab
                const errored = erroredSet.has(tab.id)
                return (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        id={`form-tab-${tab.id}`}
                        aria-selected={active}
                        aria-controls={`form-tabpanel-${tab.id}`}
                        tabIndex={active ? 0 : -1}
                        onClick={() => onSelect(tab.id)}
                        className={cn(
                            "inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors cursor-pointer",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            active
                                ? errored
                                    ? "border-destructive text-destructive"
                                    : "border-primary text-foreground"
                                : errored
                                  ? "border-transparent text-destructive hover:border-destructive/40"
                                  : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {errored && (
                            <span
                                aria-hidden="true"
                                className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive"
                            />
                        )}
                        {tab.label}
                    </button>
                )
            })}
        </div>
    )
}
