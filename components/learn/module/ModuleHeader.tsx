import type { CurriculumModule } from "@/lib/curriculum-read"
import { Container } from "@/components/ui/Container"

interface ModuleHeaderProps {
    trackSlug: string
    mod: CurriculumModule
    totalModules: number
}

/**
 * The module screen's full-bleed breadcrumb bar: `<track-slug> /
 * <module-slug>` on the left, `Module N of M` right-aligned in `primary`.
 *
 * Deliberately just the bar — everything else the design calls "the hero"
 * (eyebrow, locked chip, h1, description, the "Resume" CTA, the progress
 * bar) lives in `page.tsx`'s grid instead, because the spec puts it in the
 * SAME `1fr 340px` grid as Lessons/Attached problems, with `ModuleRail`
 * running alongside all of it — not above the grid, where a full-bleed
 * `<header>` would strand it.
 */
export function ModuleHeader({ trackSlug, mod, totalModules }: ModuleHeaderProps) {
    return (
        <div className="border-b border-line bg-panel-sunken">
            <Container width="lg" className="flex items-center justify-between gap-3 py-2">
                <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
                    <ol className="flex items-center gap-1.5 truncate font-mono text-[11px] text-text-dim">
                        <li className="truncate">{trackSlug}</li>
                        <li aria-hidden="true">/</li>
                        <li className="truncate text-foreground">{mod.slug}</li>
                    </ol>
                </nav>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-primary">
                    Module {mod.position + 1} of {totalModules}
                </span>
            </Container>
        </div>
    )
}
