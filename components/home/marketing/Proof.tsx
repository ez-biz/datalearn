import { Check } from "lucide-react"
import { Card } from "@/components/ui/Card"

const CLAIMS = [
    "Every problem validates against a real expected result set — not a fuzzy text diff.",
    "The same DuckDB and Postgres engines the platform runs in your browser are the ones a real interview loop uses.",
    "Problems are grouped by topic and company pattern, not dropped in random order.",
] as const

/**
 * Two-column proof section. Left: the pitch plus three `check`-prefixed
 * claims. Right: a syntax-highlighted "accepted submission" mockup.
 *
 * The right panel is static illustrative markup, not a live query — it
 * exists to show what solving a problem looks like, the same role the
 * retired anonymous hero's decorative editor-preview card played (see the
 * old `app/page.tsx`'s hero, before this branch replaced it). Colors come
 * from the `syntax-*` tokens in app/globals.css (defined for exactly this,
 * previously unused anywhere in the app).
 */
export function Proof() {
    return (
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
                <h2 className="max-w-[22ch] text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-[28px]">
                    Every lesson ends where the interview does — at a
                    prompt.
                </h2>
                <ul className="mt-6 space-y-4">
                    {CLAIMS.map((claim) => (
                        <li
                            key={claim}
                            className="flex items-start gap-2.5 text-sm leading-6 text-muted-foreground"
                        >
                            <Check
                                className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                                aria-hidden="true"
                            />
                            <span>{claim}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <Card className="overflow-hidden">
                <div className="border-b border-border bg-surface-muted px-4 py-3">
                    <p className="font-mono text-xs text-muted-foreground">
                        #247 · second-highest-salary.sql
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 font-mono text-xs font-medium text-primary">
                        <span
                            className="h-1.5 w-1.5 rounded-full bg-primary"
                            aria-hidden="true"
                        />
                        Accepted · 38 ms
                    </p>
                </div>
                <pre className="overflow-x-auto bg-canvas-deep px-5 py-5 font-mono text-[13px] leading-relaxed scrollbar-thin">
                    <code>
                        <span className="text-syntax-comment">
                            {"-- Second-highest distinct salary\n"}
                        </span>
                        <span className="text-syntax-keyword">WITH</span>
                        {" ranked "}
                        <span className="text-syntax-keyword">AS</span>
                        {" (\n  "}
                        <span className="text-syntax-keyword">SELECT</span>
                        {" salary,\n         "}
                        <span className="text-syntax-function">
                            DENSE_RANK
                        </span>
                        {"() "}
                        <span className="text-syntax-keyword">OVER</span>
                        {" ("}
                        <span className="text-syntax-keyword">ORDER BY</span>
                        {" salary "}
                        <span className="text-syntax-keyword">DESC</span>
                        {") AS rnk\n  "}
                        <span className="text-syntax-keyword">FROM</span>
                        {" employees\n)\n"}
                        <span className="text-syntax-keyword">SELECT</span>
                        {" salary "}
                        <span className="text-syntax-keyword">AS</span>
                        {" second_highest_salary\n"}
                        <span className="text-syntax-keyword">FROM</span>
                        {" ranked\n"}
                        <span className="text-syntax-keyword">WHERE</span>
                        {" rnk = "}
                        <span className="text-syntax-literal">2</span>
                        {";"}
                    </code>
                </pre>
                <div className="border-t border-border bg-primary/5 px-5 py-3 text-xs text-primary">
                    Matches the expected output exactly — rows, ordering and
                    types.
                </div>
            </Card>
        </div>
    )
}
