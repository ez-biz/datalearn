// prisma/seed-analyst-track.ts
//
// Idempotent seed for the "Analyst Interview Prep" track.
//
// Task 12 (.superpowers/sdd/2026-08-01-curriculum-spine/task-12-brief.md)
// originally called for authoring this content live through the MCP tools.
// That was superseded: API-authored content is database rows, not repo
// files — it would not appear in the PR, would not be reproducible, and
// could land in the wrong database. This script ships the track as
// committed, re-runnable data instead, built on the same
// lib/admin-curriculum.ts helpers the REST routes and MCP tools call.
//
// Run against LOCAL Postgres only:
//   DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' \
//     npx tsx prisma/seed-analyst-track.ts
// (or `npm run seed:analyst-track` once DATABASE_URL is exported — never
// run this against .env.local's Neon branch or .env.production.local.)
//
// Structure:
//   - CURRICULUM below is the only section part 2 should need to touch.
//     Every lesson in modules 02 (joins), 03 (aggregation), and 05
//     (interview patterns) is marked "TODO(part2)" — title, slug, summary,
//     readingMinutes, and checkpointProblemSlugs are already final; only
//     `body` (currently a one-line placeholder) and `status` (currently
//     "DRAFT") need to change once the real prose lands. Modules 01
//     (foundations) and 04 (window functions) already carry full prose and
//     `status: "PUBLISHED"`.
//   - Everything below CURRICULUM is generic seeding logic and should not
//     need to change for part 2.
//
// Idempotency: every write here is safe to run twice. Track/Topic/User/
// Article go through Prisma `upsert`. `createModule` 409s on an existing
// slug — treated as success, same as `addToList` treats Prisma's P2002.
// `addLessonToModule` and `addCheckpoint` already return 409 for "already
// attached" / "already checked" per lib/admin-curriculum.ts — also treated
// as success. ArticleVersion snapshots only fire on genuine create or
// content change, so re-running never grows that table either.
//
// Checkpoint gaps (documented per the brief's "if there's no good match,
// leave checkpointProblemSlugs: [] and record the gap" instruction):
//   - lag-lead-and-row-to-row-deltas: no published problem uses LAG/LEAD
//     or a row-to-row delta. Left with no checkpoint.
//   - sessionisation, cohort-retention, metric-definitions-that-survive-review
//     (module 05): none of the 23 published problems model an event log,
//     a cohort table, or a metric-definition review. Left with no
//     checkpoint; module 05 also has TODO(part2) prose.
//   - count-star-vs-count-col -> orders-per-country: an imperfect but
//     reasonable match. It exercises COUNT-based aggregation, but no
//     fixture column in the seeded schemas actually contains a NULL, so
//     the problem cannot demonstrate the COUNT(*) vs COUNT(column)
//     divergence the lesson is about. Included anyway as the closest
//     available problem; noted here rather than left silently imperfect.

import "dotenv/config"
import { prisma } from "../lib/prisma"
import {
    computeReadingMinutes,
    validateArticleDirectivesSyntactic,
} from "../lib/admin-validation"
import { snapshotArticleVersion } from "../lib/article-versions"
import {
    addCheckpoint,
    addLessonToModule,
    createModule,
} from "../lib/admin-curriculum"

const md = (...lines: string[]): string => lines.join("\n")

// ---------------------------------------------------------------------------
// Curriculum data
// ---------------------------------------------------------------------------

export type LessonSeed = {
    title: string
    slug: string
    summary: string
    readingMinutes: number
    /** DRAFT for TODO(part2) placeholders; flip to PUBLISHED once `body` is real prose. */
    status: "PUBLISHED" | "DRAFT"
    body: string
    checkpointProblemSlugs: string[]
}

export type ModuleSeed = {
    slug: string
    name: string
    description: string
    /** Article.topicId for every lesson in this module; also doubles as a TOPIC Tag slug. */
    topicSlug: string
    lessons: LessonSeed[]
}

export const TRACK_SLUG = "analyst-interview-prep"

export const TRACK = {
    slug: TRACK_SLUG,
    name: "Analyst Interview Prep",
    summary:
        "Five modules, seventeen lessons: the SQL an analyst interview actually tests, from evaluation order through window functions to composite interview patterns.",
    description: md(
        "A track for analysts prepping for SQL-heavy interviews, built around the failure modes interviewers actually probe for rather than syntax trivia.",
        "It starts with the mental model every later module assumes — clause evaluation order, NULL semantics, deterministic sorting — then moves through joins and aggregation into window functions, and ends with composite patterns (sessionisation, cohort retention, metric definitions) that combine everything before them.",
        "Every lesson ends at a query, not a definition, and names the specific mistake an interviewer is listening for.",
    ),
    // Spans EASY foundational material through HARD interview-pattern composites.
    difficulty: "MIXED" as const,
    // Modules 02, 03, and 05 are still TODO(part2) placeholders — flip to
    // PUBLISHED once every module has real prose.
    status: "DRAFT" as const,
    estimatedMinutes: 210,
}

/**
 * Topics referenced by CURRICULUM below that are NOT part of the existing
 * curriculum-topics seed (scripts/seed-curriculum-topics.ts). Upserted
 * deterministically with `update: {}` so a pre-existing topic (from that
 * script, or a human edit) is never overwritten — only created if missing.
 */
const NEW_TOPICS: Array<{
    slug: string
    name: string
    description: string
    lane: "SQL" | "DATA_ENGINEERING"
    displayOrder: number
}> = [
    {
        slug: "interview-patterns",
        name: "Interview Patterns",
        description:
            "Composite SQL patterns -- sessionisation, cohort retention, metric definitions -- built by combining joins, aggregation, and window functions.",
        lane: "SQL",
        displayOrder: 11,
    },
]

export const CURRICULUM: ModuleSeed[] = [
    // -------------------------------------------------------------------
    // Module 00 (position 0) -- Foundations. Full prose.
    // -------------------------------------------------------------------
    {
        slug: "foundations",
        name: "Foundations",
        description:
            "The clause-by-clause execution model every other module assumes you already have: evaluation order, NULL semantics, and deterministic sorting.",
        topicSlug: "sql-foundations",
        lessons: [
            {
                title: "Reading a Query Plan in Your Head",
                slug: "reading-a-query-plan-in-your-head",
                summary:
                    "SQL's logical execution order -- FROM, WHERE, GROUP BY, HAVING, SELECT, ORDER BY, LIMIT -- is not the order you write it in, and simulating that order mentally is the fastest way to debug a query that isn't the query you meant to write.",
                readingMinutes: 5,
                status: "PUBLISHED",
                checkpointProblemSlugs: ["highest-spending-customer"],
                body: md(
                    "# Reading a Query Plan in Your Head",
                    "",
                    "You write a SELECT statement top to bottom, but the engine doesn't execute it that way. It executes clauses in a fixed logical order, and that order has almost nothing to do with the order you typed them in. If you can hold that order in your head -- as a mental simulation, not a memorized acronym -- you can debug most broken queries in seconds instead of staring at the SQL wondering why it \"should\" work.",
                    "",
                    "To be precise about scope: this isn't about reading an `EXPLAIN` plan, which is a physical execution strategy chosen by the query optimizer (index scans, join algorithms, cost estimates) -- that's a separate skill for a separate topic. This is about the *logical* order every SQL engine guarantees regardless of how it physically executes the query underneath. That logical order is:",
                    "",
                    "1. `FROM` / `JOIN` -- build the working row set",
                    "2. `WHERE` -- filter rows, one at a time, before any grouping happens",
                    "3. `GROUP BY` -- collapse the remaining rows into groups",
                    "4. `HAVING` -- filter groups, after they've been formed",
                    "5. `SELECT` -- compute the output columns, including aggregates",
                    "6. `ORDER BY` -- sort the final result",
                    "7. `LIMIT` -- cut it down to size",
                    "",
                    "Notice `SELECT` is second-to-last, not first, despite being the first word you type. That single fact explains a huge fraction of \"why doesn't my query work\" bugs.",
                    "",
                    "## Walking a query in logical order",
                    "",
                    "Take a concrete question: who is the single highest-spending customer?",
                    "",
                    "```sql",
                    "SELECT c.name, SUM(o.total_amount) AS total_spent",
                    "FROM customers c",
                    "JOIN orders o ON o.customer_id = c.customer_id",
                    "GROUP BY c.name",
                    "ORDER BY total_spent DESC",
                    "LIMIT 1;",
                    "```",
                    "",
                    "Read it in logical order, not lexical order:",
                    "",
                    "- **FROM / JOIN**: pair every customer row with every matching order row. A customer with three orders now appears as three joined rows, each carrying that customer's name alongside one order's `total_amount`.",
                    "- **WHERE**: there isn't one here, so nothing gets dropped at this stage.",
                    "- **GROUP BY `c.name`**: collapse all the joined rows for the same customer into a single group. This is the step where \"three rows for John Doe\" becomes \"one group for John Doe.\"",
                    "- **SELECT**: for each group, compute `SUM(o.total_amount)`. This is also the step where the alias `total_spent` first comes into existence -- it does not exist before this point.",
                    "- **ORDER BY `total_spent DESC`**: sort the one-row-per-customer result by that computed sum.",
                    "- **LIMIT 1**: keep only the top row.",
                    "",
                    "Against the seed data, that query returns exactly one row:",
                    "",
                    "```",
                    "{ \"name\": \"John Doe\", \"total_spent\": 1450 }",
                    "```",
                    "",
                    "If you trace it step by step -- join, no filter, collapse to one group per customer, sum, sort, cut to one -- the answer isn't a mystery. It's the mechanical consequence of the seven steps applied in order. That's the skill: not memorizing that John Doe spent 1450, but being able to predict it (or any similarly-shaped query's output) by simulating the steps before you run anything.",
                    "",
                    "## Why this order actually matters",
                    "",
                    "The reason this isn't just trivia is that clauses can only \"see\" what previous steps have produced. `WHERE` runs before grouping exists, so it can only filter individual rows -- it has no concept of a group total. `HAVING` runs after grouping, so it's the only clause that can filter on an aggregate like `COUNT(*)` or `SUM(...)`. And `SELECT` -- where your aliases are born -- runs *after* `WHERE`, `GROUP BY`, and `HAVING` have all already executed.",
                    "",
                    "That last point is the one that catches people who've only ever read SQL top-to-bottom.",
                    "",
                    ":::callout{kind=\"pitfall\"}",
                    "The single most common way this trips people up in an interview: they write `SELECT ..., SUM(o.total_amount) AS total_spent` and then try to filter on it with `WHERE total_spent > 1000`. It fails -- not because the syntax is wrong, but because `WHERE` executes before `SELECT`, so `total_spent` doesn't exist yet at the point `WHERE` runs. The fix is `HAVING SUM(o.total_amount) > 1000`, since `HAVING` runs after the aggregate has been computed. An interviewer who sees you reach straight for `HAVING` instead of debugging by trial and error knows you're not guessing -- you're simulating the plan.",
                    ":::",
                    "",
                    "Some engines are lenient and let you reference a `SELECT` alias inside `GROUP BY` or `ORDER BY` as a convenience (Postgres and DuckDB both do), but that's an exception carved out specifically for those two clauses -- not a sign that `SELECT` secretly runs earlier. `WHERE` never gets that exception, in any engine. If you're unsure whether a shortcut like that is portable, the safe move is to repeat the expression rather than the alias.",
                    "",
                    "## Try it yourself",
                    "",
                    "The `orders` table for this schema also has an `order_date` column. Without running anything yet, work out what this returns, then check yourself:",
                    "",
                    "```sql",
                    "SELECT c.name, COUNT(o.order_id) AS order_count",
                    "FROM customers c",
                    "JOIN orders o ON o.customer_id = c.customer_id",
                    "WHERE o.order_date >= DATE '2023-02-01'",
                    "GROUP BY c.name",
                    "HAVING COUNT(o.order_id) >= 1",
                    "ORDER BY order_count DESC;",
                    "```",
                    "",
                    "Trace it in the seven-step order above before you run it: which rows does `WHERE` remove first, and does that change which customers even make it into `GROUP BY` at all?",
                ),
            },
            {
                title: "SELECT, WHERE, and Evaluation Order",
                slug: "select-where-and-evaluation-order",
                summary:
                    "WHERE always runs before SELECT, which means date-range filters, alias references, and BETWEEN boundaries all have to be reasoned about in terms of raw columns -- not the computed output you're trying to produce.",
                readingMinutes: 4,
                status: "PUBLISHED",
                checkpointProblemSlugs: ["orders-in-january-2023"],
                body: md(
                    "# SELECT, WHERE, and Evaluation Order",
                    "",
                    "The previous lesson laid out the full seven-step order a query executes in. This one zooms into the two clauses that cause the most day-to-day friction: `SELECT` and `WHERE`. The relationship between them is simple to state and easy to forget under interview pressure: `WHERE` filters rows using only the columns that exist in the source tables, and it does that *before* `SELECT` has computed anything. Whatever you're computing in `SELECT` -- a rename, a calculation, an aggregate -- does not exist yet when `WHERE` runs.",
                    "",
                    "## A clean example: counting orders in a date range",
                    "",
                    "```sql",
                    "SELECT COUNT(*) AS order_count",
                    "FROM orders",
                    "WHERE order_date BETWEEN DATE '2023-01-01' AND DATE '2023-01-31';",
                    "```",
                    "",
                    "Against this schema's `orders` table -- four rows, dated 2023-01-15, 2023-01-16, 2023-02-10, and 2023-02-20 -- `WHERE` evaluates the raw `order_date` column against the literal range, independently of the fact that `SELECT` is about to compute a `COUNT(*)`. Two rows survive the filter (2023-01-15 and 2023-01-16); `COUNT(*)` then runs over just those two surviving rows. The result:",
                    "",
                    "```",
                    "{ \"order_count\": 2 }",
                    "```",
                    "",
                    "That's the mechanical story. But there are two traps hiding in a query that looks this innocent.",
                    "",
                    "## Trap one: BETWEEN's boundaries are inclusive, and that's exactly the danger",
                    "",
                    "`BETWEEN x AND y` is shorthand for `>= x AND <= y` -- both ends are inclusive. That sounds like a feature (and it is, for a `DATE` column with no time component, like this one). But it becomes a silent bug the moment the column is a `TIMESTAMP` instead of a plain `DATE`. If `order_date` carried a time component, `BETWEEN DATE '2023-01-01' AND DATE '2023-01-31'` would translate to `<= '2023-01-31 00:00:00'` -- meaning any order placed after midnight on January 31st would be *excluded*, despite still being \"in January\" by any human reading of the requirement. The fix in that case is a half-open range instead: `order_date >= '2023-01-01' AND order_date < '2023-02-01'`. That pattern -- half-open on the upper bound -- is worth defaulting to any time the column might carry a time component, because it can never silently drop a valid row at the boundary.",
                    "",
                    "## Trap two: the alias that doesn't exist yet",
                    "",
                    "This is the direct consequence of evaluation order, and it's the one that catches people who've internalized SQL as \"a list of instructions run top to bottom\" rather than \"a pipeline with a fixed logical order.\" Suppose you want orders with an unusually large amount, and you write:",
                    "",
                    "```sql",
                    "SELECT order_id, total_amount * 1.0 AS amount_usd",
                    "FROM orders",
                    "WHERE amount_usd > 1000;",
                    "```",
                    "",
                    "This fails in Postgres and DuckDB alike, with some variant of \"column amount_usd does not exist.\" The reason isn't a typo -- it's that `WHERE` runs before `SELECT`, and `amount_usd` is a name that `SELECT` invents. At the point `WHERE` executes, only the real columns from `orders` exist: `order_id`, `customer_id`, `order_date`, `total_amount`. The fix is to repeat the expression:",
                    "",
                    "```sql",
                    "SELECT order_id, total_amount * 1.0 AS amount_usd",
                    "FROM orders",
                    "WHERE total_amount * 1.0 > 1000;",
                    "```",
                    "",
                    "or, to avoid repeating a more complex expression, compute it in a CTE first and filter the CTE's output, where the alias *does* already exist by the time the outer `WHERE` runs:",
                    "",
                    "```sql",
                    "WITH priced AS (",
                    "  SELECT order_id, total_amount * 1.0 AS amount_usd",
                    "  FROM orders",
                    ")",
                    "SELECT * FROM priced WHERE amount_usd > 1000;",
                    "```",
                    "",
                    ":::callout{kind=\"pitfall\"}",
                    "The failure mode interviewers are actually probing for here isn't \"do you know the syntax error message.\" It's whether you can explain *why* it happens without guessing -- whether you reach for \"WHERE runs before SELECT, so the alias isn't in scope yet\" instead of \"SQL is weird sometimes.\" The second answer signals you've been getting by on trial and error; the first signals you've internalized the execution model well enough to predict failures before you hit run. It also signals whether you'll reach for the CTE fix cleanly, rather than duplicating a growing expression three times across a query and introducing a copy-paste bug when you change it in one place and not the others.",
                    ":::",
                    "",
                    "Both traps come from the same root cause: `WHERE` only knows about the columns that exist in the tables named in `FROM`, evaluated before `SELECT` has run. Once that's automatic, boundary conditions and alias errors stop being mysterious and start being predictable.",
                    "",
                    "## One more to reason through",
                    "",
                    "The `orders` table's `total_amount` values in this fixture are 1350, 800, 100, and 1350. Before running anything, work out what this returns, and why the second condition can't reference the first one's alias:",
                    "",
                    "```sql",
                    "SELECT order_id, total_amount,",
                    "       total_amount > 500 AS is_large",
                    "FROM orders",
                    "WHERE total_amount > 500;",
                    "```",
                ),
            },
            {
                title: "NULL Is Not a Value",
                slug: "null-is-not-a-value",
                summary:
                    "NULL means 'unknown,' not 'empty' or 'zero,' and SQL's three-valued logic means comparisons against it are never true -- which turns the innocent-looking NOT IN into the most common silent-data-loss bug in production SQL.",
                readingMinutes: 5,
                status: "PUBLISHED",
                checkpointProblemSlugs: ["products-never-ordered"],
                body: md(
                    "# NULL Is Not a Value",
                    "",
                    "Every other value in SQL -- a number, a string, a date -- is something the engine can compare directly: `5 = 5` is true, `'a' = 'b'` is false. `NULL` breaks that pattern on purpose. `NULL` doesn't mean \"zero,\" \"empty string,\" or \"blank.\" It means *unknown* -- the value could be anything, or nothing, and the engine refuses to guess. That single design decision is why `NULL` needs its own comparison operators (`IS NULL`, `IS NOT NULL`) instead of the ordinary ones, and why forgetting that fact produces one of the most common silent bugs in production SQL: queries that quietly return zero rows, or the wrong rows, with no error at all.",
                    "",
                    "## Three-valued logic, briefly",
                    "",
                    "Ordinary SQL comparisons return `TRUE` or `FALSE`. Any comparison involving `NULL` returns a third value: `UNKNOWN`. `5 = NULL` is not `FALSE` -- it's `UNKNOWN`, because the engine has no way to know whether the missing value equals 5. `NULL = NULL` is also `UNKNOWN`, for the same reason: two unknowns aren't provably equal just because they're both unknown. A `WHERE` clause only keeps rows where the condition evaluates to `TRUE` -- `UNKNOWN` rows get filtered out exactly like `FALSE` ones. That's the whole mechanism, and it's enough to explain every NULL-related bug you'll hit.",
                    "",
                    "## The problem, concretely: products nobody ordered",
                    "",
                    "```sql",
                    "SELECT p.product_id, p.name",
                    "FROM products p",
                    "LEFT JOIN order_items oi ON oi.product_id = p.product_id",
                    "WHERE oi.product_id IS NULL;",
                    "```",
                    "",
                    "The `LEFT JOIN` keeps every product row regardless of whether it has a matching `order_items` row; for a product with no orders, every column from `order_items` -- including `oi.product_id` -- comes back `NULL` in that joined row. `WHERE oi.product_id IS NULL` then isolates exactly those unmatched products. Against this fixture, that's a single row:",
                    "",
                    "```",
                    "{ \"product_id\": 104, \"name\": \"Coffee Table\" }",
                    "```",
                    "",
                    "That's the correct, NULL-aware pattern: use a `LEFT JOIN` and check the outer side for `IS NULL`. It works because `IS NULL` is a special operator carved out specifically to sidestep three-valued logic -- it always returns a definite `TRUE` or `FALSE`, never `UNKNOWN`.",
                    "",
                    "## The trap: the same question, asked with NOT IN",
                    "",
                    "It's tempting to answer \"which products were never ordered\" more directly, with a subquery:",
                    "",
                    "```sql",
                    "SELECT product_id, name",
                    "FROM products",
                    "WHERE product_id NOT IN (SELECT product_id FROM order_items);",
                    "```",
                    "",
                    "On this exact fixture, `order_items.product_id` happens to never be `NULL`, so this version returns the same correct row. But the query is not equivalent to the `LEFT JOIN` version -- it only *looks* equivalent because the current data is clean. The moment a single row in `order_items.product_id` is `NULL` -- an item recorded with a missing or not-yet-linked product, exactly the kind of row real order-processing systems produce -- this query silently returns **zero rows**, for every product, including ones that genuinely were never ordered.",
                    "",
                    "Here's why. `NOT IN (SELECT ...)` expands to a chain of ANDed inequalities: `product_id <> v1 AND product_id <> v2 AND product_id <> v3 AND ...` for every value the subquery returns. If any one of those values is `NULL`, that one comparison evaluates to `UNKNOWN` instead of `TRUE` or `FALSE`. And `UNKNOWN` poisons the whole chain: `TRUE AND TRUE AND UNKNOWN` is `UNKNOWN`, not `TRUE`. Since `WHERE` only keeps rows that evaluate to `TRUE`, every single row gets dropped -- not just the ones related to the `NULL`. One `NULL` anywhere in the subquery's result silently zeroes out the entire query.",
                    "",
                    ":::callout{kind=\"pitfall\"}",
                    "This is the NULL failure mode interviewers reach for most often, because it's realistic and a genuine outage pattern, not a trick of syntax. The tell they're listening for is whether you flag `NOT IN` against a subquery as unsafe *before* being told the data has NULLs in it -- because you can't assume it never will. The safe alternatives are `NOT EXISTS` (a correlated subquery that never has this problem, because it doesn't build an IN-list at all) or `LEFT JOIN ... WHERE ... IS NULL` as above, or filtering the subquery itself with `WHERE product_id IS NOT NULL` if you're committed to `NOT IN`. Naming `NOT EXISTS` unprompted as the default-safe pattern, rather than `NOT IN`, is usually enough on its own to signal you've been burned by this before.",
                    ":::",
                    "",
                    "## Aggregates quietly skip NULLs too",
                    "",
                    "The same \"unknown, not zero\" logic extends past `WHERE`. `SUM()`, `AVG()`, `COUNT(column)`, `MAX()`, and `MIN()` all silently ignore `NULL` inputs rather than treating them as zero -- usually what you want (an unrecorded sale shouldn't drag your average down to zero), but it means a NULL-heavy column can make an aggregate look healthier than the underlying data actually is, with no warning. `COUNT(*)` is the one exception: it counts rows regardless of whether any particular column is `NULL`, which is precisely why `COUNT(*)` and `COUNT(some_column)` can legitimately return different numbers over the same table.",
                    "",
                    "## Next",
                    "",
                    "Given a `LEFT JOIN` between `customers` and `orders`, write the query that returns every customer who has placed *zero* orders -- and be ready to explain why `NOT IN (SELECT customer_id FROM orders)` would be the wrong tool to reach for first.",
                ),
            },
            {
                title: "Sorting, Paging, and Ties",
                slug: "sorting-paging-and-ties",
                summary:
                    "ORDER BY plus LIMIT only returns a stable, repeatable row when the ORDER BY clause fully determines the order -- and 'just add LIMIT 1' is exactly where an undetermined tie turns into a flaky production report.",
                readingMinutes: 4,
                status: "PUBLISHED",
                checkpointProblemSlugs: ["largest-department"],
                body: md(
                    "# Sorting, Paging, and Ties",
                    "",
                    "`ORDER BY ... LIMIT n` reads like it guarantees a stable answer: sort the rows, take the first `n`. It does guarantee that -- but only if the `ORDER BY` clause fully determines a unique order for every row. The moment two or more rows tie on every column you're sorting by, the engine is free to break that tie however it wants, and \"however it wants\" can change between query plans, between database versions, or even between runs against the exact same data. This is the gap between a query that happens to look deterministic on your test data and one that actually is.",
                    "",
                    "## A department query, worked through",
                    "",
                    "```sql",
                    "SELECT d.name AS department_name, COUNT(*) AS employee_count",
                    "FROM departments d",
                    "JOIN employees e ON e.department_id = d.id",
                    "GROUP BY d.name",
                    "ORDER BY employee_count DESC, department_name ASC",
                    "LIMIT 1;",
                    "```",
                    "",
                    "This groups employees by department, counts headcount per department, and returns the single largest one. Against this fixture -- Engineering has 4 employees, Sales has 3, Marketing has 2 -- the result is unambiguous:",
                    "",
                    "```",
                    "{ \"department_name\": \"Engineering\", \"employee_count\": 4 }",
                    "```",
                    "",
                    "Notice the `ORDER BY` has two keys, not one: `employee_count DESC` first, then `department_name ASC`. The second key isn't decoration. It's there so that if two departments ever tie on headcount, the query still has a rule for which one comes first -- alphabetical order -- rather than leaving it to chance. On *this* data, the tiebreaker never actually fires, because no two departments are tied. But the query is correct *as written* precisely because it doesn't depend on that being true. Drop the second key and the query becomes correct only by accident, on this specific dataset, today.",
                    "",
                    "## Why \"no visible tie today\" isn't the same as \"no tie possible\"",
                    "",
                    "Say the same query were written with a single sort key:",
                    "",
                    "```sql",
                    "SELECT d.name AS department_name, COUNT(*) AS employee_count",
                    "FROM departments d",
                    "JOIN employees e ON e.department_id = d.id",
                    "GROUP BY d.name",
                    "ORDER BY employee_count DESC",
                    "LIMIT 1;",
                    "```",
                    "",
                    "It would return the identical row today, because Engineering's headcount (4) is unambiguously the max. But hire one more person into Sales while nothing changes in Engineering, and now there's a genuine tie between the two on `employee_count`. Which one comes back is no longer specified by the query at all -- it's left to whatever order the engine happens to produce the grouped rows in internally, which is an implementation detail, not a contract. It can differ across a version upgrade, an index added later, or a change in how the optimizer decides to execute the `GROUP BY`. A dashboard built on this query would then flip between \"Engineering\" and \"Sales\" as the answer to \"which department is largest\" with no code change and no data anomaly, just because the tie resolved differently. That's the failure mode: not a wrong answer today, but a *non-answer* the moment the data shifts into a tie the query never accounted for.",
                    "",
                    ":::callout{kind=\"pitfall\"}",
                    "This is precisely the question interviewers ask right after you produce a working `ORDER BY ... LIMIT 1` query: \"what happens if there's a tie?\" They're not looking for \"there won't be\" -- they're looking for whether you proactively add a deterministic tiebreaker (often the primary key, or another column guaranteed unique, when there's no natural secondary sort key) *before* being asked, the same way you'd reach for `NOT EXISTS` before being told about NULLs. A candidate who has to be prompted into adding the tiebreaker is revealing that they got the right answer by luck on this dataset, not by reasoning about the guarantee the query actually makes.",
                    ":::",
                    "",
                    "## The same logic applies to paging, not just LIMIT 1",
                    "",
                    "`LIMIT` combined with `OFFSET` for pagination has the identical failure mode, one level up: if page 1 is `ORDER BY created_at DESC LIMIT 20` and two rows share the exact same `created_at` at the page boundary, page 2's `OFFSET 20 LIMIT 20` can return one of them a second time, or skip it entirely, depending on which side of the boundary the tie resolves to on that particular execution. The fix is the same one -- extend `ORDER BY` with a unique tiebreaker column (typically the primary key) so the boundary itself is deterministic, not just the top-1 case.",
                    "",
                    "This is also why cursor-based pagination -- \"give me rows after `(employee_count, department_name) = (4, 'Engineering')`\" -- is preferred over plain `OFFSET` at any real scale: the cursor encodes the full tiebroken sort key, so the next page's starting point is unambiguous even when rows are inserted or deleted between requests. `OFFSET` just counts rows from the top on every call, so it has no memory of what the previous page actually returned, and a deterministic `ORDER BY` only fixes the tie -- it doesn't fix the separate problem of the underlying data shifting under a multi-page scan.",
                    "",
                    "## One to write",
                    "",
                    "`salaries.employee_id` maps to `employees.id`. Write a query that returns the single highest-paid employee overall (name and salary), with a tiebreaker that guarantees the same row comes back every time two employees are tied on salary.",
                ),
            },
        ],
    },

    // -------------------------------------------------------------------
    // Module 01 (position 1) -- Joins. TODO(part2): full prose.
    // -------------------------------------------------------------------
    {
        slug: "joins",
        name: "Joins",
        description:
            "How relational engines combine rows across tables, and the two ways that combination silently goes wrong: dropped rows and multiplied rows.",
        topicSlug: "joins",
        lessons: [
            {
                title: "INNER, LEFT, and the Unmatched Rows",
                slug: "inner-left-and-the-unmatched-rows",
                summary:
                    "INNER JOIN silently drops rows with no match on the other side; LEFT JOIN keeps them with NULLs -- and picking the wrong one is the most common way a join subtly changes which rows survive a query.",
                readingMinutes: 1,
                status: "DRAFT",
                // TODO(part2): replace with full prose per task-12-brief.md
                // (module 01 "Joins", lesson 1). Title/slug/summary/
                // readingMinutes/checkpoints are final; only body + status change.
                body: "TODO(part2): full lesson body -- placeholder only.",
                checkpointProblemSlugs: ["total-revenue-per-customer"],
            },
            {
                title: "Semi and Anti Joins",
                slug: "semi-and-anti-joins",
                summary:
                    "EXISTS and NOT EXISTS answer 'does a match exist' without ever pulling columns from the other table -- the right tool whenever a join is being used purely as a filter.",
                readingMinutes: 1,
                status: "DRAFT",
                // TODO(part2): replace with full prose per task-12-brief.md
                // (module 01 "Joins", lesson 2).
                body: "TODO(part2): full lesson body -- placeholder only.",
                checkpointProblemSlugs: ["customers-with-orders", "customers-with-no-orders"],
            },
            {
                title: "Fan-Out and Row Multiplication",
                slug: "fan-out-and-row-multiplication",
                summary:
                    "Joining through a one-to-many relationship multiplies rows before any aggregate runs on them -- the classic way a revenue total quietly doubles without a single wrong value anywhere in the query.",
                readingMinutes: 1,
                status: "DRAFT",
                // TODO(part2): replace with full prose per task-12-brief.md
                // (module 01 "Joins", lesson 3).
                body: "TODO(part2): full lesson body -- placeholder only.",
                checkpointProblemSlugs: ["top-selling-products"],
            },
        ],
    },

    // -------------------------------------------------------------------
    // Module 02 (position 2) -- Aggregation. TODO(part2): full prose.
    // -------------------------------------------------------------------
    {
        slug: "aggregation",
        name: "Aggregation",
        description:
            "Collapsing many rows into few, and the grain, filter-timing, and NULL-counting decisions that determine whether the collapse says what you think it says.",
        topicSlug: "aggregations",
        lessons: [
            {
                title: "GROUP BY and the Grain of a Result",
                slug: "group-by-and-the-grain-of-a-result",
                summary:
                    "Every GROUP BY declares the grain of the output -- one row per distinct combination of the grouped columns -- and most aggregation bugs come from writing a query whose grain doesn't match the question actually being asked.",
                readingMinutes: 1,
                status: "DRAFT",
                // TODO(part2): replace with full prose per task-12-brief.md
                // (module 02 "Aggregation", lesson 1).
                body: "TODO(part2): full lesson body -- placeholder only.",
                checkpointProblemSlugs: ["avg-salary-per-department"],
            },
            {
                title: "HAVING vs WHERE",
                slug: "having-vs-where",
                summary:
                    "WHERE filters rows before grouping; HAVING filters groups after -- which means HAVING is the only clause that can filter on an aggregate, and WHERE is the only one that can filter without paying for a full aggregation first.",
                readingMinutes: 1,
                status: "DRAFT",
                // TODO(part2): replace with full prose per task-12-brief.md
                // (module 02 "Aggregation", lesson 2).
                body: "TODO(part2): full lesson body -- placeholder only.",
                checkpointProblemSlugs: ["customers-with-multiple-orders"],
            },
            {
                title: "COUNT(*) vs COUNT(column)",
                slug: "count-star-vs-count-col",
                summary:
                    "COUNT(*) counts rows regardless of NULLs; COUNT(column) silently skips them -- a one-character difference that can make two counts on the same table legitimately disagree.",
                readingMinutes: 1,
                status: "DRAFT",
                // TODO(part2): replace with full prose per task-12-brief.md
                // (module 02 "Aggregation", lesson 3). Checkpoint is an
                // imperfect match -- see the gaps note at the top of this
                // file -- but is the closest available published problem.
                body: "TODO(part2): full lesson body -- placeholder only.",
                checkpointProblemSlugs: ["orders-per-country"],
            },
        ],
    },

    // -------------------------------------------------------------------
    // Module 03 (position 3) -- Window functions. Full prose.
    // -------------------------------------------------------------------
    {
        slug: "window-functions",
        name: "Window functions",
        description:
            "Annotating rows with running totals, ranks, and row-to-row comparisons without collapsing them -- the pattern behind most 'per group' interview questions.",
        topicSlug: "window-functions",
        lessons: [
            {
                title: "What a Window Function Actually Is",
                slug: "what-a-window-actually-is",
                summary:
                    "A window function computes a value across a set of related rows without collapsing them into one -- the opposite instinct of GROUP BY, and the single mental model that unlocks running totals, rankings, and row-to-row comparisons.",
                readingMinutes: 4,
                status: "PUBLISHED",
                checkpointProblemSlugs: ["running-revenue"],
                body: md(
                    "# What a Window Function Actually Is",
                    "",
                    "`GROUP BY` and window functions both compute something \"across a group of rows,\" and that surface similarity is exactly what causes the confusion. `GROUP BY` collapses: ten rows going in, however-many-distinct-groups rows coming out. A window function does the opposite: ten rows going in, ten rows coming out, each one now carrying an extra column computed by looking at some set of related rows -- including, often, rows other than itself. The row count never changes. That's the entire concept, and almost everything else about window functions is a variation on it.",
                    "",
                    "## A running total, one row at a time",
                    "",
                    "```sql",
                    "SELECT order_id, order_date, total_amount,",
                    "       SUM(total_amount) OVER (ORDER BY order_date, order_id) AS running_total",
                    "FROM orders",
                    "ORDER BY order_date, order_id;",
                    "```",
                    "",
                    "Against this schema's four orders, the result is:",
                    "",
                    "```",
                    "order_id | order_date | total_amount | running_total",
                    "1001     | 2023-01-15 | 1350         | 1350",
                    "1002     | 2023-01-16 | 800          | 2150",
                    "1003     | 2023-02-10 | 100          | 2250",
                    "1004     | 2023-02-20 | 1350         | 3600",
                    "```",
                    "",
                    "Four rows in, four rows out -- that's the tell that this is a window function and not an aggregate. Every row keeps its own `order_id`, `order_date`, and `total_amount` exactly as they were; `running_total` is just a new column bolted onto each one. Compare that to what a plain `GROUP BY` or a bare `SUM(total_amount)` would do here: collapse all four rows into a single row holding just the grand total, 3600, with no `order_id` left to attach it to. The window function version keeps the detail *and* adds the aggregate -- a combination `GROUP BY` alone cannot produce.",
                    "",
                    "## Reading the syntax",
                    "",
                    "`SUM(total_amount) OVER (ORDER BY order_date, order_id)` has two parts. `SUM(total_amount)` is an ordinary aggregate expression -- nothing new there. `OVER (...)` is what turns it into a window function: it tells the engine \"don't collapse rows; instead, for *each* row, compute this aggregate over some window of related rows, and attach the result to that row.\" The `ORDER BY` inside the `OVER(...)` clause defines what \"related rows\" means here -- specifically, it defines a running window that grows one row at a time as you move down the order, which is exactly why the result is a running total rather than a flat grand total repeated on every row. (The next lesson covers `PARTITION BY`, which resets that window per group, and the frame clause, which controls precisely how far the window extends -- both refinements on this same base idea.)",
                    "",
                    "## The concrete mistake this prevents",
                    "",
                    "The reason this distinction matters in practice, not just in theory: \"show me each row alongside some aggregate context\" is an extremely common interview and real-world request -- each transaction alongside a running total, each employee alongside their department's average salary, each row alongside its rank among its peers. The instinctive first move for someone who's only fluent in `GROUP BY` is to reach for a self-join or a correlated subquery to reattach an aggregate to each row, which usually works but is slower and more code than it needs to be. The instinctive first move for someone fluent in windows is `OVER (...)`, directly.",
                    "",
                    ":::callout{kind=\"pitfall\"}",
                    "The failure mode interviewers watch for is a candidate defaulting to `GROUP BY` for a request that actually needs row-level detail preserved, then discovering midway through that they've lost the very rows they were asked to return -- and either bolting on a self-join to recover them, or, worse, quietly changing the question to \"one row per group\" because that's what their query now produces. If the request is \"each row, plus some aggregate context,\" that's a signal for a window function, not `GROUP BY`, and recognizing that signal immediately -- before writing any SQL -- is the actual skill being tested. The inverse mistake also happens: reaching for a window function when the request genuinely wants fewer rows out than in. A window function alone can annotate rows for that job -- `ROW_NUMBER()` -- but it takes an outer filter on top of it to actually drop the losing rows; the window function by itself never reduces row count.",
                    ":::",
                    "",
                    "## What doesn't change",
                    "",
                    "One more detail worth internalizing early because it stays true no matter how elaborate the window gets: a window function can appear in `SELECT`, and it can be referenced again in `ORDER BY`, but it cannot appear in `WHERE` or `GROUP BY` directly -- those clauses run before window functions are evaluated, for the same evaluation-order reasons covered in the foundations module. Filtering *on* a window function's result means computing it in a CTE or subquery first, then filtering the outer query.",
                    "",
                    "## Next",
                    "",
                    "Using the same `orders` table, write a query that shows each order's `total_amount` next to that same customer's running total across their own orders only -- not the running total across every customer combined.",
                ),
            },
            {
                title: "OVER, PARTITION BY, and Frame Clauses",
                slug: "over-partition-by-and-frame-clauses",
                summary:
                    "PARTITION BY resets a window per group, but the frame clause -- and its silently different default the moment you add an ORDER BY -- is what actually decides which rows a window function can see, and getting it wrong turns a department average into an unintended running average.",
                readingMinutes: 4,
                status: "PUBLISHED",
                checkpointProblemSlugs: ["salary-vs-department-avg", "employee-salary-rank"],
                body: md(
                    "# OVER, PARTITION BY, and Frame Clauses",
                    "",
                    "The previous lesson covered the core idea: a window function annotates each row without collapsing it. This one covers the two pieces that control exactly *which* rows feed into that computation for a given row -- `PARTITION BY`, which most people learn quickly, and the frame clause, which almost nobody learns until it silently breaks something.",
                    "",
                    "## PARTITION BY: resetting the window per group",
                    "",
                    "`PARTITION BY` splits the rows into independent groups and restarts the window fresh inside each one -- the window-function equivalent of `GROUP BY`, except it doesn't collapse anything.",
                    "",
                    "```sql",
                    "SELECT e.name, d.name AS department, s.amount AS salary,",
                    "       AVG(s.amount) OVER (PARTITION BY d.id) AS dept_avg,",
                    "       s.amount - AVG(s.amount) OVER (PARTITION BY d.id) AS diff",
                    "FROM employees e",
                    "JOIN departments d ON d.id = e.department_id",
                    "JOIN salaries s ON s.employee_id = e.id",
                    "ORDER BY department, diff DESC;",
                    "```",
                    "",
                    "Every employee row keeps its own name and salary, and gets `dept_avg` attached -- but `dept_avg` is computed only from that employee's own department, because `PARTITION BY d.id` restarts the average at each department boundary:",
                    "",
                    "```",
                    "name    | department  | salary | dept_avg | diff",
                    "Bob     | Engineering | 120000 | 95250    | 24750",
                    "Alice   | Engineering | 95000  | 95250    | -250",
                    "Frank   | Engineering | 88000  | 95250    | -7250",
                    "Ian     | Engineering | 78000  | 95250    | -17250",
                    "Eve     | Marketing   | 70000  | 67500    | 2500",
                    "Henry   | Marketing   | 65000  | 67500    | -2500",
                    "Diana   | Sales       | 110000 | 95666.7  | 14333.3",
                    "Grace   | Sales       | 92000  | 95666.7  | -3666.7",
                    "Charlie | Sales       | 85000  | 95666.7  | -10666.7",
                    "```",
                    "",
                    "Every Engineering row shows the same `dept_avg` (95250), every Sales row shows the same `dept_avg` (95666.7), and so on -- because there's no `ORDER BY` inside this particular `OVER(...)`, so each partition's window is the *whole partition*, every time, for every row in it.",
                    "",
                    "## The frame clause: what changes when you add ORDER BY inside OVER",
                    "",
                    "That last sentence has a trap folded into it. `AVG(s.amount) OVER (PARTITION BY d.id)` -- no `ORDER BY` inside the parentheses -- defaults to a frame of the entire partition, which is why every row in a department sees the same average. But the moment you add an `ORDER BY` *inside* that same `OVER(...)`, the default frame changes out from under you, silently, to `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` -- meaning \"only the rows up to and including this one, in sort order.\" That's exactly the running-total behavior from the previous lesson, and it's the *correct* choice for a running total. But if you add `ORDER BY` to a window expecting a stable group average and don't realize the frame just changed, you silently get a running average instead of a department average, and every row shows a different, wrong number with no error raised anywhere.",
                    "",
                    "Compare `RANK() OVER (PARTITION BY d.id ORDER BY s.amount DESC)`:",
                    "",
                    "```sql",
                    "SELECT e.name, d.name AS department, s.amount AS salary,",
                    "       RANK() OVER (PARTITION BY d.id ORDER BY s.amount DESC) AS rank",
                    "FROM employees e",
                    "JOIN departments d ON d.id = e.department_id",
                    "JOIN salaries s ON s.employee_id = e.id",
                    "ORDER BY department ASC, rank ASC;",
                    "```",
                    "",
                    "```",
                    "name    | department  | salary | rank",
                    "Bob     | Engineering | 120000 | 1",
                    "Alice   | Engineering | 95000  | 2",
                    "Frank   | Engineering | 88000  | 3",
                    "Ian     | Engineering | 78000  | 4",
                    "Eve     | Marketing   | 70000  | 1",
                    "Henry   | Marketing   | 65000  | 2",
                    "Diana   | Sales       | 110000 | 1",
                    "Grace   | Sales       | 92000  | 2",
                    "Charlie | Sales       | 85000  | 3",
                    "```",
                    "",
                    "Here the `ORDER BY` inside `OVER(...)` is doing exactly what you want -- `RANK()` is defined in terms of rows-so-far in sort order, so the frame default is correct by construction. The danger case is specifically an *aggregate* like `SUM` or `AVG` combined with an `ORDER BY` you added out of habit, or because you copied a pattern from a ranking query, without meaning to change from \"whole partition\" to \"running.\"",
                    "",
                    ":::callout{kind=\"pitfall\"}",
                    "This is one of the most reliable ways an interviewer distinguishes \"has memorized PARTITION BY\" from \"understands window frames.\" The question usually looks like: \"I added `ORDER BY hire_date` to my `AVG(salary) OVER (PARTITION BY department)` so the report reads chronologically -- why did all my averages change?\" The answer isn't a bug in the database; it's that adding `ORDER BY` inside `OVER(...)` silently narrowed the frame from the whole partition to \"unbounded preceding through current row,\" turning a stable department average into a running one. If you need `ORDER BY` for the *output* row order but a full-partition frame for the *computation*, sort in the outer query's `ORDER BY` clause -- the one outside `OVER(...)` -- and either omit `ORDER BY` from inside the window entirely, or make the frame explicit: `AVG(s.amount) OVER (PARTITION BY d.id ORDER BY s.amount DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)` restores the whole-partition behavior even with an `ORDER BY` present, because the explicit frame overrides the default.",
                    ":::",
                    "",
                    "## The general rule",
                    "",
                    "Any time a window aggregate's answer looks unexpectedly cumulative -- later rows showing bigger or smaller numbers than earlier ones when you expected a flat, repeated group value -- the first thing to check is whether an `ORDER BY` snuck into the `OVER(...)` clause and quietly swapped the default frame. Naming the frame explicitly whenever the behavior matters is cheap insurance against ever hitting this by accident again.",
                    "",
                    "## Next",
                    "",
                    "Write the same department-average query, but with an explicit `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING` frame and `hire_date` in the `OVER(...)`'s `ORDER BY` -- confirm every row in a department still shows the identical average despite the `ORDER BY` being present.",
                ),
            },
            {
                title: "LAG, LEAD, and Row-to-Row Deltas",
                slug: "lag-lead-and-row-to-row-deltas",
                summary:
                    "LAG and LEAD reach into a neighboring row in the same result set, which is what period-over-period deltas, streaks, and gap analysis actually need -- and the very first row's LAG is always NULL, which quietly breaks any arithmetic that doesn't expect it.",
                readingMinutes: 4,
                status: "PUBLISHED",
                // No published problem in this database uses LAG/LEAD or a
                // row-to-row delta -- documented gap, see file header.
                checkpointProblemSlugs: [],
                body: md(
                    "# LAG, LEAD, and Row-to-Row Deltas",
                    "",
                    "Every window function covered so far has computed something from a *set* of rows -- a running total, a partition average, a rank. `LAG` and `LEAD` are different in kind: instead of aggregating a set, they reach sideways into one specific neighboring row -- the previous one, or the next one, in whatever order you specify -- and pull a value from it into the current row. That's the entire mechanism, and it's exactly what \"how much did this change from last time\" questions need, which makes it one of the most commonly asked-for patterns in analyst interviews: period-over-period deltas, day-over-day growth, detecting when a value changed from the row before it.",
                    "",
                    "## The basic shape",
                    "",
                    "```sql",
                    "SELECT order_id, order_date, total_amount,",
                    "       LAG(total_amount) OVER (ORDER BY order_date, order_id) AS prev_amount,",
                    "       total_amount - LAG(total_amount) OVER (ORDER BY order_date, order_id) AS delta",
                    "FROM orders",
                    "ORDER BY order_date, order_id;",
                    "```",
                    "",
                    "Against this schema's four orders (1350 on 2023-01-15, 800 on 2023-01-16, 100 on 2023-02-10, 1350 on 2023-02-20), the result is:",
                    "",
                    "```",
                    "order_id | order_date | total_amount | prev_amount | delta",
                    "1001     | 2023-01-15 | 1350         | NULL        | NULL",
                    "1002     | 2023-01-16 | 800          | 1350        | -550",
                    "1003     | 2023-02-10 | 100          | 800         | -700",
                    "1004     | 2023-02-20 | 1350         | 100         | 1250",
                    "```",
                    "",
                    "`LAG(total_amount) OVER (ORDER BY order_date, order_id)` means \"for this row, give me `total_amount` from the row immediately before it in this sort order.\" `LEAD` is the mirror image -- it reaches *forward* to the next row instead of back to the previous one. Both take an optional second argument for how many rows back or forward to reach (`LAG(total_amount, 2)` reaches two rows back), and an optional third argument for what to substitute when there's no such row.",
                    "",
                    "## The one detail that breaks arithmetic if you don't expect it",
                    "",
                    "Look at the first row again: `prev_amount` is `NULL`, and so is `delta`. That's not a bug -- order 1001 genuinely has no previous row to look at, so `LAG` correctly reports \"unknown\" rather than inventing a zero. But `total_amount - NULL` is also `NULL`, by the same three-valued-logic rule that governs every other arithmetic operation involving `NULL`. If this delta feeds into something downstream that assumes every row has a numeric value -- a chart, a `SUM(delta)` meant to reconcile back to the last row's running total, a `WHERE delta > 0` filter meant to catch \"periods that grew\" -- the first row silently vanishes from that computation rather than raising an error. `SUM(delta)` will just quietly skip the `NULL` and add up one fewer row than you assumed, and a naive person cross-checking totals will spend real time hunting for an arithmetic bug that isn't there.",
                    "",
                    "The fix, when a real default makes sense, is the third argument: `LAG(total_amount, 1, 0) OVER (...)` returns `0` instead of `NULL` for rows with no predecessor, which makes `delta` a real number (`1350`) on the first row instead of `NULL`. Whether zero is actually the *right* default is a business-logic question -- \"the first order grew infinitely from nothing\" is a different story than \"the first order has no meaningful delta at all\" -- so this isn't a default to reach for automatically; it's a choice to make deliberately and be able to justify.",
                    "",
                    ":::callout{kind=\"pitfall\"}",
                    "The failure mode interviewers are listening for here has two layers, and good answers hit both without prompting. First: do you flag, unprompted, that the first row's `LAG` is `NULL` and that downstream arithmetic on it will propagate that `NULL` rather than treating it as zero -- the same NULL-poisons-everything behavior from the foundations module, just showing up in a new place. Second, and more subtle: do you get the *direction* right under pressure. \"How much did revenue grow from the previous period\" needs `LAG` (look backward); \"how many days until the next order\" needs `LEAD` (look forward). Mixing them up produces a query that runs cleanly, returns plausible-looking numbers, and answers the wrong question -- which is worse than an error, because nothing flags it as wrong.",
                    ":::",
                    "",
                    "## Where this generalizes",
                    "",
                    "The same `LAG`/`LEAD` mechanism, not just the delta pattern, underlies streak detection (comparing a row's category to the previous row's category to find where a run starts or breaks), gap detection (comparing a timestamp to the previous timestamp to find unusually large jumps), and change-flagging (did this status differ from the last time we saw this entity). All of them reduce to \"attach a neighboring row's value to the current row, then compare.\"",
                    "",
                    "## Next",
                    "",
                    "Using `LEAD` instead of `LAG` on the same `orders` table, write a query that returns each order alongside the number of days until that customer's *next* order -- and decide, before you write the query, what should happen for a customer's most recent order, which has no next one.",
                ),
            },
            {
                title: "Top N Per Group, Three Ways",
                slug: "top-n-per-group-three-ways",
                summary:
                    "Window functions, correlated subqueries, and self-joins each solve 'top N rows per group' with different tradeoffs on readability, portability, and tie-handling -- and 'what happens on a tie' is the question that separates a working query from a correct one.",
                readingMinutes: 5,
                status: "PUBLISHED",
                checkpointProblemSlugs: [
                    "top-2-products-per-category",
                    "highest-paid-per-department",
                    "most-recent-hire-per-dept",
                ],
                body: md(
                    "# Top N Per Group, Three Ways",
                    "",
                    "\"For each category, give me the top 2 products by price\" and its many variants -- top earner per department, most recent hire per team, best-selling item per region -- is one of the most frequently asked analyst-interview patterns, precisely because there are several genuinely different ways to solve it, and the choice between them says something about how you think, not just whether you can produce a correct answer.",
                    "",
                    "## Way one: window function, then filter",
                    "",
                    "```sql",
                    "WITH ranked AS (",
                    "  SELECT category, name, price,",
                    "         ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC) AS rn",
                    "  FROM products",
                    ")",
                    "SELECT category, name, price",
                    "FROM ranked",
                    "WHERE rn <= 2",
                    "ORDER BY category, price DESC;",
                    "```",
                    "",
                    "`ROW_NUMBER()` numbers each row 1, 2, 3, ... within its category, ordered by price descending; the outer `WHERE rn <= 2` keeps the top two per category. Against this schema:",
                    "",
                    "```",
                    "category    | name         | price",
                    "Electronics | Laptop       | 1200",
                    "Electronics | Smartphone   | 800",
                    "Furniture   | Coffee Table | 200",
                    "Furniture   | Desk Chair   | 150",
                    "```",
                    "",
                    "This is usually the cleanest option once you're past the point of needing to explain it: one CTE, one filter, and it generalizes to any N by changing a single number. The catch is the choice between `ROW_NUMBER()`, `RANK()`, and `DENSE_RANK()`, which matters the instant there's a tie -- covered below.",
                    "",
                    "## Way two: correlated subquery",
                    "",
                    "```sql",
                    "SELECT department_name, employee_name, salary",
                    "FROM (",
                    "  SELECT d.name AS department_name, e.name AS employee_name, s.amount AS salary",
                    "  FROM departments d",
                    "  JOIN employees e ON e.department_id = d.id",
                    "  JOIN salaries s ON s.employee_id = e.id",
                    ") ranked",
                    "WHERE (",
                    "  SELECT COUNT(*)",
                    "  FROM departments d2",
                    "  JOIN employees e2 ON e2.department_id = d2.id",
                    "  JOIN salaries s2 ON s2.employee_id = e2.id",
                    "  WHERE d2.name = ranked.department_name AND s2.amount > ranked.salary",
                    ") < 1;",
                    "```",
                    "",
                    "The inner subquery counts how many people in the *same* department earn strictly more than the current row; keeping only rows where that count is zero gives you the top earner per department. This generalizes to top-N by changing `< 1` to `< N`, but it's doing real, repeated work: for every candidate row, it re-scans and re-joins the whole comparison set. On four departments and nine employees that's invisible; at real table sizes, this pattern degrades badly compared to a single windowed pass, because the cost grows roughly with rows times rows-per-group rather than just rows. Its advantage is portability -- it works on any engine with subquery support, including ones with no window functions at all -- and it reads naturally as \"nobody in this group beats me,\" which is sometimes exactly the phrasing a business question uses.",
                    "",
                    "## Way three: self-join on the aggregate",
                    "",
                    "```sql",
                    "SELECT d.name AS department, e.name, e.hire_date",
                    "FROM employees e",
                    "JOIN departments d ON d.id = e.department_id",
                    "WHERE e.hire_date = (",
                    "  SELECT MAX(e2.hire_date)",
                    "  FROM employees e2",
                    "  WHERE e2.department_id = e.department_id",
                    ");",
                    "```",
                    "",
                    "This is really a scalar-subquery variant rather than a true self-*join*, but it belongs in the same family: for each employee row, compare against the pre-aggregated max (or min) for that employee's own group. It's the most natural choice specifically for **N = 1**, where \"top\" collapses to a single `MAX`/`MIN` you can compare against directly -- and it reads exceptionally clearly for that one case. It stops being the right tool the moment N is greater than 1, since there's no clean way to ask \"give me the top 2 hire dates\" with a bare `MAX`.",
                    "",
                    "## Picking one -- and the tiebreak question underneath all three",
                    "",
                    "For N = 1 with a natural aggregate, the self-join/scalar-subquery form is often the most readable. For anything beyond that, or when portability across engines without window support matters, the correlated subquery is the fallback. Otherwise, the window-function form is the default: it's a single pass over the data, it generalizes to any N by changing one number, and -- critically -- it's the only one of the three that gives you an explicit, visible choice about how ties are handled.",
                    "",
                    "That choice is `ROW_NUMBER()` vs `RANK()` vs `DENSE_RANK()`, and it's not cosmetic. `ROW_NUMBER()` assigns 1, 2, 3, 4 with no regard for ties -- if two products in a category are exactly tied for second-highest price, `ROW_NUMBER()` arbitrarily picks one of them for rank 2 and demotes the other to rank 3, silently dropping a legitimately-tied top-2 product from the result. `RANK()` gives tied rows the same number and skips the next one (1, 2, 2, 4) -- correct for \"who's tied for the top spot\" but it means a `rank <= 2` filter can return three or more rows when there's a tie, not exactly two. `DENSE_RANK()` gives tied rows the same number without the skip (1, 2, 2, 3). None of the three is universally \"correct\" -- the right one depends on what the business question actually means by \"top 2,\" and that's a question worth asking out loud rather than guessing silently.",
                    "",
                    ":::callout{kind=\"pitfall\"}",
                    "The failure mode interviewers are checking for here rarely lives in whether the query runs -- all three approaches above produce a correct answer on data with no ties. It's whether you proactively raise \"what should happen if two rows tie for the last spot\" before being asked, and whether you can name why `ROW_NUMBER()` is the wrong default the moment that question's answer is \"keep all of them.\" A candidate who reaches for `ROW_NUMBER()` reflexively, without checking whether the underlying `ORDER BY` key can plausibly tie, is optimizing for \"compiles and looks clean\" over \"matches what the business actually asked for\" -- precisely the gap a senior interviewer is listening for.",
                    ":::",
                    "",
                    "## Next",
                    "",
                    "Using the correlated-subquery pattern from way two, write the top-2 (not top-1) version for `most-recent-hire-per-dept` -- the two most recently hired employees in each department -- and decide which of the three approaches you'd actually reach for first, and why.",
                ),
            },
        ],
    },

    // -------------------------------------------------------------------
    // Module 04 (position 4) -- Interview patterns. TODO(part2): full prose.
    // -------------------------------------------------------------------
    {
        slug: "interview-patterns",
        name: "Interview patterns",
        description:
            "Composite patterns -- sessions, cohorts, metric definitions -- built by combining the foundations, joins, aggregation, and window techniques from the rest of this track.",
        topicSlug: "interview-patterns",
        lessons: [
            {
                title: "Sessionisation",
                slug: "sessionisation",
                summary:
                    "Turning a raw event log into sessions means detecting gaps between consecutive events for the same user and starting a new session whenever the gap exceeds a threshold -- a direct application of LAG over a partitioned, ordered window.",
                readingMinutes: 1,
                status: "DRAFT",
                // TODO(part2): replace with full prose per task-12-brief.md
                // (module 04 "Interview patterns", lesson 1). No published
                // problem models an event log -- documented gap, see file header.
                body: "TODO(part2): full lesson body -- placeholder only.",
                checkpointProblemSlugs: [],
            },
            {
                title: "Cohort Retention",
                slug: "cohort-retention",
                summary:
                    "A retention table buckets users by their first-seen period, then measures what fraction of each cohort is still active N periods later -- built from a self-join between a cohort-assignment query and the activity log it's measured against.",
                readingMinutes: 1,
                status: "DRAFT",
                // TODO(part2): replace with full prose per task-12-brief.md
                // (module 04 "Interview patterns", lesson 2). No published
                // problem models a cohort table -- documented gap, see file header.
                body: "TODO(part2): full lesson body -- placeholder only.",
                checkpointProblemSlugs: [],
            },
            {
                title: "Metric Definitions That Survive Review",
                slug: "metric-definitions-that-survive-review",
                summary:
                    "The SQL for 'active user' or 'conversion rate' is easy to write and easy to get subtly wrong -- the durable version states its grain, its filters, and its edge cases explicitly enough that two different analysts compute the same number independently.",
                readingMinutes: 1,
                status: "DRAFT",
                // TODO(part2): replace with full prose per task-12-brief.md
                // (module 04 "Interview patterns", lesson 3). Conceptual --
                // no single published problem fits -- documented gap, see file header.
                body: "TODO(part2): full lesson body -- placeholder only.",
                checkpointProblemSlugs: [],
            },
        ],
    },
]

// ---------------------------------------------------------------------------
// Seeding logic -- generic; should not need to change for part 2.
// ---------------------------------------------------------------------------

/** Reuse an existing ADMIN user as the author; upsert a deterministic fallback if none exists. */
async function resolveAuthorId(): Promise<string> {
    const admin = await prisma.user.findFirst({
        where: { role: "ADMIN" },
        orderBy: { createdAt: "asc" },
        select: { id: true },
    })
    if (admin) return admin.id

    const fallback = await prisma.user.upsert({
        where: { email: "curriculum-seed-author@learndatanow.com" },
        update: {},
        create: {
            email: "curriculum-seed-author@learndatanow.com",
            name: "Curriculum Author",
            role: "ADMIN",
        },
        select: { id: true },
    })
    return fallback.id
}

/**
 * Look up a topic by slug; if it's one of the new topics this track
 * introduces, upsert it deterministically. `update: {}` means an existing
 * topic (from scripts/seed-curriculum-topics.ts, or a human edit) is never
 * mutated -- only created if genuinely missing.
 */
async function resolveTopicId(topicSlug: string): Promise<string> {
    const existing = await prisma.topic.findUnique({
        where: { slug: topicSlug },
        select: { id: true },
    })
    if (existing) return existing.id

    const spec = NEW_TOPICS.find((t) => t.slug === topicSlug)
    if (!spec) {
        throw new Error(
            `seed-analyst-track: topic "${topicSlug}" does not exist and is not in NEW_TOPICS.`,
        )
    }
    const created = await prisma.topic.upsert({
        where: { slug: spec.slug },
        update: {},
        create: {
            slug: spec.slug,
            name: spec.name,
            description: spec.description,
            lane: spec.lane,
            displayOrder: spec.displayOrder,
        },
        select: { id: true },
    })
    return created.id
}

/** A TOPIC-kind Tag sharing a module's topic slug, satisfying "carries at least one TOPIC tag." */
async function upsertTopicTag(slug: string): Promise<string> {
    const tag = await prisma.tag.upsert({
        where: { slug },
        update: {},
        create: { slug, name: slug.replace(/-/g, " "), kind: "TOPIC" },
        select: { id: true },
    })
    return tag.id
}

type UpsertArticleInput = {
    slug: string
    title: string
    topicId: string
    authorId: string
    content: string
    summary: string
    readingMinutes: number
    status: "PUBLISHED" | "DRAFT"
    tagIds: string[]
}

/**
 * Create or update a lesson's backing Article. Only writes (and only
 * snapshots a new ArticleVersion) when something actually changed, so a
 * second run with identical CURRICULUM data is a true no-op for this
 * article -- no duplicate version rows, no needless updatedAt bump.
 */
async function upsertLessonArticle(
    input: UpsertArticleInput,
): Promise<{ id: string; created: boolean; changed: boolean }> {
    const validated = validateArticleDirectivesSyntactic(input.content)
    if (!validated.ok) {
        throw new Error(
            `seed-analyst-track: invalid content for ${input.slug}: ${JSON.stringify(validated.errors)}`,
        )
    }

    const existing = await prisma.article.findUnique({
        where: { slug: input.slug },
        select: {
            id: true,
            title: true,
            content: true,
            summary: true,
            topicId: true,
            status: true,
            readingMinutes: true,
            hasVisualBlocks: true,
        },
    })

    const changed =
        !existing ||
        existing.title !== input.title ||
        existing.content !== input.content ||
        existing.summary !== input.summary ||
        existing.topicId !== input.topicId ||
        existing.status !== input.status ||
        existing.readingMinutes !== input.readingMinutes ||
        existing.hasVisualBlocks !== validated.hasVisualBlocks

    const articleId = await prisma.$transaction(async (tx) => {
        const article = await tx.article.upsert({
            where: { slug: input.slug },
            create: {
                slug: input.slug,
                title: input.title,
                content: input.content,
                summary: input.summary,
                status: input.status,
                topicId: input.topicId,
                authorId: input.authorId,
                readingMinutes: input.readingMinutes,
                hasVisualBlocks: validated.hasVisualBlocks,
                tags: { connect: input.tagIds.map((id) => ({ id })) },
            },
            update: changed
                ? {
                      title: input.title,
                      content: input.content,
                      summary: input.summary,
                      status: input.status,
                      topicId: input.topicId,
                      readingMinutes: input.readingMinutes,
                      hasVisualBlocks: validated.hasVisualBlocks,
                      tags: { connect: input.tagIds.map((id) => ({ id })) },
                  }
                : {},
            select: { id: true },
        })

        if (input.status === "PUBLISHED" && (!existing || changed)) {
            await snapshotArticleVersion(tx, article.id, input.authorId)
        }
        return article.id
    })

    return { id: articleId, created: !existing, changed }
}

async function main() {
    console.log(`seed-analyst-track: starting against ${process.env.DATABASE_URL?.replace(/:[^:@]*@/, ":***@")}`)

    const authorId = await resolveAuthorId()
    console.log(`  author: ${authorId}`)

    const track = await prisma.track.upsert({
        where: { slug: TRACK_SLUG },
        update: {
            name: TRACK.name,
            summary: TRACK.summary,
            description: TRACK.description,
            difficulty: TRACK.difficulty,
            status: TRACK.status,
            estimatedMinutes: TRACK.estimatedMinutes,
        },
        create: {
            slug: TRACK_SLUG,
            name: TRACK.name,
            summary: TRACK.summary,
            description: TRACK.description,
            difficulty: TRACK.difficulty,
            status: TRACK.status,
            estimatedMinutes: TRACK.estimatedMinutes,
        },
        select: { id: true, slug: true },
    })
    console.log(`  track: ${track.slug}`)

    const topicCache = new Map<string, string>()
    const tagCache = new Map<string, string>()

    let modulesCreated = 0
    let modulesExisting = 0
    let articlesCreated = 0
    let articlesUpdated = 0
    let articlesUnchanged = 0
    let lessonsAttached = 0
    let lessonsAlreadyAttached = 0
    let checkpointsAdded = 0
    let checkpointsAlreadyThere = 0
    const gaps: string[] = []

    for (const mod of CURRICULUM) {
        let topicId = topicCache.get(mod.topicSlug)
        if (!topicId) {
            topicId = await resolveTopicId(mod.topicSlug)
            topicCache.set(mod.topicSlug, topicId)
        }

        let tagId = tagCache.get(mod.topicSlug)
        if (!tagId) {
            tagId = await upsertTopicTag(mod.topicSlug)
            tagCache.set(mod.topicSlug, tagId)
        }

        const moduleResult = await createModule(TRACK_SLUG, {
            name: mod.name,
            slug: mod.slug,
            description: mod.description,
        })
        if (moduleResult.ok) {
            modulesCreated++
            console.log(`  + module ${mod.slug}`)
        } else if (moduleResult.status === 409) {
            modulesExisting++
            console.log(`  . module ${mod.slug} already exists`)
        } else {
            throw new Error(`createModule(${mod.slug}) failed: ${moduleResult.error}`)
        }

        for (const lesson of mod.lessons) {
            const computed = computeReadingMinutes(lesson.body)
            if (lesson.status === "PUBLISHED" && Math.abs(computed - lesson.readingMinutes) > 1) {
                console.warn(
                    `  ! ${lesson.slug}: declared readingMinutes=${lesson.readingMinutes} but computed=${computed}`,
                )
            }

            const articleResult = await upsertLessonArticle({
                slug: lesson.slug,
                title: lesson.title,
                topicId,
                authorId,
                content: lesson.body,
                summary: lesson.summary,
                readingMinutes: lesson.readingMinutes,
                status: lesson.status,
                tagIds: [tagId],
            })
            if (articleResult.created) articlesCreated++
            else if (articleResult.changed) articlesUpdated++
            else articlesUnchanged++

            const attach = await addLessonToModule(TRACK_SLUG, mod.slug, {
                articleSlug: lesson.slug,
            })
            if (attach.ok) {
                lessonsAttached++
            } else if (attach.status === 409) {
                lessonsAlreadyAttached++
            } else {
                throw new Error(`addLessonToModule(${lesson.slug}) failed: ${attach.error}`)
            }

            if (lesson.checkpointProblemSlugs.length === 0) {
                gaps.push(`${mod.slug}/${lesson.slug}: no checkpoint (documented gap, see file header)`)
            }
            for (const problemSlug of lesson.checkpointProblemSlugs) {
                const cp = await addCheckpoint(lesson.slug, { problemSlug })
                if (cp.ok) {
                    checkpointsAdded++
                } else if (cp.status === 409) {
                    checkpointsAlreadyThere++
                } else {
                    throw new Error(
                        `addCheckpoint(${lesson.slug}, ${problemSlug}) failed: ${cp.error}`,
                    )
                }
            }
        }
    }

    console.log("")
    console.log("seed-analyst-track: done")
    console.log(`  modules      created=${modulesCreated} existing=${modulesExisting}`)
    console.log(
        `  articles     created=${articlesCreated} updated=${articlesUpdated} unchanged=${articlesUnchanged}`,
    )
    console.log(`  lessons      attached=${lessonsAttached} already-attached=${lessonsAlreadyAttached}`)
    console.log(`  checkpoints  added=${checkpointsAdded} already-there=${checkpointsAlreadyThere}`)
    if (gaps.length) {
        console.log(`  checkpoint gaps (${gaps.length}):`)
        for (const gap of gaps) console.log(`    - ${gap}`)
    }
}

// Only run when executed directly (`tsx prisma/seed-analyst-track.ts`), not
// when another script imports CURRICULUM for inspection or testing.
const isMainModule = import.meta.url === `file://${process.argv[1]}`
if (isMainModule) {
    main()
        .catch((error) => {
            console.error(error)
            process.exit(1)
        })
        .finally(() => prisma.$disconnect())
}
