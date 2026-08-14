// Four equal steps, purely static — no data dependency, so this never has
// an empty state to worry about. Folds in the retired anonymous page's
// three feature pillars (in-browser execution, instant validation, real
// schemas — see the old `Pillar` cards this branch removed from
// app/page.tsx) as the "how" behind steps 2 and 3, rather than repeating
// them as a separate section.
const STEPS = [
    {
        title: "Pick a problem or lesson",
        body: "Follow the path in order, or jump straight into the open catalog. Real schemas across e-commerce, HR and SaaS data — not toy tables.",
    },
    {
        title: "Write real SQL",
        body: "DuckDB-WASM runs your query in the browser. No install, no server round trip, no queue to wait in.",
    },
    {
        title: "Get an exact verdict",
        body: "Every problem ships an expected result set. Rows, ordering, types and floating-point tolerance are all checked, not eyeballed.",
    },
    {
        title: "See what's next",
        body: "The path always knows the next lesson or problem, so you spend your time solving — not deciding what to study.",
    },
] as const

/**
 * `HowItWorks` — four equal cards with a 2px `primary` top border and
 * square top corners (the accent bar reads as a flat edge, not a rounded
 * chip, which is the point of squaring just the top).
 */
export function HowItWorks() {
    return (
        <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-text-dim">
                How it works
            </p>
            <div className="mt-4 grid gap-[10px] sm:grid-cols-2 lg:grid-cols-4">
                {STEPS.map((step, i) => (
                    <div
                        key={step.title}
                        className="rounded-b-lg border-t-2 border-primary bg-surface p-5"
                    >
                        <span className="font-mono text-xs tabular-nums text-primary">
                            {String(i + 1).padStart(2, "0")}
                        </span>
                        <h3 className="mt-2 text-[15.5px] font-semibold leading-snug text-foreground">
                            {step.title}
                        </h3>
                        <p className="mt-1.5 text-[13.5px] leading-[1.55] text-muted-foreground">
                            {step.body}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    )
}
