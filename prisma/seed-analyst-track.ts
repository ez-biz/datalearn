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
//   - CURRICULUM below is the only section part 2 needed to touch. Part 2
//     replaced every "TODO(part2)" placeholder body across modules 02
//     (joins), 03 (aggregation), and 05 (interview patterns) with full
//     prose and flipped `status` to "PUBLISHED" — title, slug, summary,
//     readingMinutes, and checkpointProblemSlugs were already final from
//     part 1 and are unchanged (readingMinutes was recomputed to match the
//     real prose). All 5 modules / 17 lessons now carry full prose and
//     `status: "PUBLISHED"`.
//   - Everything below CURRICULUM is generic seeding logic and did not
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
//     a cohort table, or a metric-definition review. Re-checked in part 2
//     against the full published-problem list — still no fit. Left with
//     no checkpoint.
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
    // All 5 modules now carry real, PUBLISHED prose (part 2 complete).
    // Left at "DRAFT" deliberately — flipping the track live is a
    // separate decision outside this task's scope, not a leftover TODO.
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
    // Module 01 (position 1) -- Joins. Full prose (part 2).
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
                readingMinutes: 5,
                status: "PUBLISHED",
                checkpointProblemSlugs: ["total-revenue-per-customer"],
                body: md(
                    "# INNER, LEFT, and the Unmatched Rows",
                    "",
                    "Every join has to answer one question before it runs a single comparison: what happens to a row on one side that has no match on the other? `INNER JOIN` answers \"drop it.\" `LEFT JOIN` answers \"keep it, and fill the missing side with `NULL`.\" That's the entire difference between the two -- everything else about them is identical. Picking the wrong one doesn't crash anything. It silently changes which rows survive the query, and the result still looks like a normal table, with no error to flag that rows are missing.",
                    "",
                    "## The same join, two answers",
                    "",
                    "This schema's `customers` table has four rows; `orders` has four rows belonging to only three of those customers -- Bob Brown has never ordered.",
                    "",
                    "```sql",
                    "SELECT c.customer_id, c.name, o.order_id, o.total_amount",
                    "FROM customers c",
                    "JOIN orders o ON o.customer_id = c.customer_id",
                    "ORDER BY c.customer_id, o.order_id;",
                    "```",
                    "",
                    "```",
                    "customer_id | name          | order_id | total_amount",
                    "1           | John Doe      | 1001     | 1350",
                    "1           | John Doe      | 1003     | 100",
                    "2           | Jane Smith    | 1002     | 800",
                    "3           | Alice Johnson | 1004     | 1350",
                    "```",
                    "",
                    "Four rows, three customers -- Bob Brown isn't there at all. `INNER JOIN` only produces a row when both sides have something to pair up, so a customer with zero matching orders simply never appears. Now the same query with `LEFT JOIN` instead of `JOIN`:",
                    "",
                    "```",
                    "customer_id | name          | order_id | total_amount",
                    "1           | John Doe      | 1001     | 1350",
                    "1           | John Doe      | 1003     | 100",
                    "2           | Jane Smith    | 1002     | 800",
                    "3           | Alice Johnson | 1004     | 1350",
                    "4           | Bob Brown     | NULL     | NULL",
                    "```",
                    "",
                    "Same query, one keyword changed, and now there are five rows instead of four. `LEFT JOIN` keeps every row from the left table -- `customers` -- regardless of whether `orders` has anything to attach to it, and pads the right side with `NULL` when it doesn't. (What to do with those `NULL`s next -- and the specific trap of testing them with the wrong operator -- is the subject of `null-is-not-a-value`; this lesson is about the row surviving or not, not about what you do with it afterward.)",
                    "",
                    "## Letting the question pick the join",
                    "",
                    "The checkpoint for this lesson, `total-revenue-per-customer`, asks for revenue \"generated by each customer who has placed at least one order.\" Read literally, that's an instruction to drop Bob Brown, not an oversight to fix:",
                    "",
                    "```sql",
                    "SELECT c.name, SUM(o.total_amount) AS total_revenue",
                    "FROM customers c",
                    "JOIN orders o ON o.customer_id = c.customer_id",
                    "GROUP BY c.name",
                    "ORDER BY total_revenue DESC;",
                    "```",
                    "",
                    "`INNER JOIN` is the correct choice here on purpose -- a customer who's never ordered has no revenue rows to sum, and the question explicitly scopes itself to customers who have. But change the question slightly -- \"revenue per customer, including customers who haven't ordered yet\" -- and the same `INNER JOIN` becomes a bug: it would drop Bob Brown from a report that's supposed to show him at zero. That version needs `LEFT JOIN` plus `COALESCE` to turn the resulting `NULL` into an honest `0`:",
                    "",
                    "```sql",
                    "SELECT c.name, COALESCE(SUM(o.total_amount), 0) AS total_revenue",
                    "FROM customers c",
                    "LEFT JOIN orders o ON o.customer_id = c.customer_id",
                    "GROUP BY c.name",
                    "ORDER BY total_revenue DESC;",
                    "```",
                    "",
                    "That returns Bob Brown at `0` alongside the other three, instead of omitting him. Both queries are \"correct\" SQL -- neither errors, neither looks obviously wrong on its own -- but only one of them answers the question actually being asked.",
                    "",
                    "## The trap in a chain of joins",
                    "",
                    "The unmatched-row question doesn't only matter for the last join in a query -- it matters for every join in the chain, because an `INNER JOIN` early on can prune rows before a later `LEFT JOIN` ever gets a chance to keep them. Say you extend the query to also show each order's items:",
                    "",
                    "```sql",
                    "SELECT c.name, o.order_id, oi.product_id",
                    "FROM customers c",
                    "JOIN orders o ON o.customer_id = c.customer_id",
                    "LEFT JOIN order_items oi ON oi.order_id = o.order_id",
                    "ORDER BY c.name, o.order_id;",
                    "```",
                    "",
                    "Writing `LEFT JOIN` for `order_items` looks careful -- it means an order with no line items would still show up, with `product_id` as `NULL`. But Bob Brown is still missing from this result, because the earlier `customers JOIN orders` is an `INNER JOIN`, and it already dropped him before `order_items` ever entered the picture. `LEFT JOIN`ing everything downstream of a row that's already gone can't bring it back. If the goal is \"every customer, however deep the join chain goes,\" every join along the path from `customers` outward has to be a `LEFT JOIN`, not just the last one you happened to write.",
                    "",
                    "(A `RIGHT JOIN` is the mirror image of `LEFT JOIN` -- keep every row from the right table instead -- and a `FULL OUTER JOIN` keeps unmatched rows from both sides at once. Both exist and both matter, but `LEFT JOIN` covers the same logic and is what you'll reach for in practice far more often, since you can always reorder `FROM`/`JOIN` to make the table you want to keep the left one.)",
                    "",
                    ":::callout{kind=\"pitfall\"}",
                    "The failure mode here isn't picking the wrong join and being unable to explain why -- it's picking a join out of habit (most people default to `INNER` because it's what they typed first and it \"worked\") without ever asking the one question that determines which is correct: should a row with no match on the other side survive in the output? A candidate who states that question out loud before writing `FROM`/`JOIN` -- rather than writing the query first and discovering the row count looks off -- is showing they understand that INNER vs. LEFT is a decision about the data, not a stylistic default. It's also worth checking row counts before and after a join as a habit: a customer table with 4 rows joined to an unmatched-aware query should never quietly shrink to 3 without you having decided that was correct.",
                    ":::",
                    "",
                    "## Next",
                    "",
                    "Using this same schema, write a query that returns every product alongside how many times it's appeared in `order_items` -- including products that have never been ordered, which should show a count of `0` rather than being absent from the result. Decide which join that requires before you write it.",
                ),
            },
            {
                title: "Semi and Anti Joins",
                slug: "semi-and-anti-joins",
                summary:
                    "EXISTS and NOT EXISTS answer 'does a match exist' without ever pulling columns from the other table -- the right tool whenever a join is being used purely as a filter.",
                readingMinutes: 4,
                status: "PUBLISHED",
                checkpointProblemSlugs: ["customers-with-orders", "customers-with-no-orders"],
                body: md(
                    "# Semi and Anti Joins",
                    "",
                    "`INNER JOIN` and `LEFT JOIN` combine columns from two tables. `EXISTS` and `NOT EXISTS` don't combine anything -- they answer a yes-or-no question about whether a match exists, and pull zero columns from the table they're checking. That distinction sounds academic until you notice how often the actual business question is the yes-or-no one: \"which customers have ordered,\" not \"which customers, joined with the details of what they ordered.\" When the question is existence, reaching for a join that combines data is doing more work than the question asked for, and it opens the door to bugs that `EXISTS` doesn't have.",
                    "",
                    "## The existence question, asked directly",
                    "",
                    "```sql",
                    "SELECT c.customer_id, c.name",
                    "FROM customers c",
                    "WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id)",
                    "ORDER BY c.customer_id;",
                    "```",
                    "",
                    "```",
                    "customer_id | name",
                    "1           | John Doe",
                    "2           | Jane Smith",
                    "3           | Alice Johnson",
                    "```",
                    "",
                    "Three rows -- one per customer who has ordered, no more. That \"no more\" matters: John Doe has placed two orders, but he appears exactly once here, because `EXISTS` stops the moment it finds a single matching row in the subquery and never looks for a second one. It's a semi-join -- half a join -- because it uses the relationship to `orders` purely as a filter on `customers`, without ever surfacing an `orders` column.",
                    "",
                    "Compare that to reaching for a plain `JOIN` to answer the same question:",
                    "",
                    "```sql",
                    "SELECT c.customer_id, c.name",
                    "FROM customers c",
                    "JOIN orders o ON o.customer_id = c.customer_id",
                    "ORDER BY c.customer_id;",
                    "```",
                    "",
                    "```",
                    "customer_id | name",
                    "1           | John Doe",
                    "1           | John Doe",
                    "2           | Jane Smith",
                    "3           | Alice Johnson",
                    "```",
                    "",
                    "Same intent, wrong shape: John Doe now appears twice, once per matching order, because a join produces one output row per matching pair, not one per customer. Getting back to \"one row per customer\" needs a `DISTINCT` bolted on top, which works, but it's a patch for using the wrong tool -- `SELECT DISTINCT c.customer_id, c.name FROM customers c JOIN orders o ON ...` reaches the same three rows `EXISTS` gets to directly, at the cost of building and then deduplicating every matching pair first.",
                    "",
                    "## The mirror image: NOT EXISTS",
                    "",
                    "```sql",
                    "SELECT c.customer_id, c.name",
                    "FROM customers c",
                    "WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id)",
                    "ORDER BY c.customer_id;",
                    "```",
                    "",
                    "```",
                    "customer_id | name",
                    "4           | Bob Brown",
                    "```",
                    "",
                    "`NOT EXISTS` is the anti-join: keep a row from `customers` only when the correlated subquery finds *zero* matches in `orders`. This is the same question `null-is-not-a-value` covers from the `LEFT JOIN ... WHERE ... IS NULL` angle, and the two produce identical results on this data -- but `NOT EXISTS` gets there without ever constructing a join or depending on which output column happens to be `NULL`. That's also exactly why `NOT EXISTS` is the safe default over `NOT IN (SELECT ...)`: `NOT IN` builds a literal list of values and excludes anything matching one of them, and that list poisons itself the instant a single value in it is `NULL` -- covered in full in that lesson. `NOT EXISTS` never builds a list at all; it asks \"does a matching row exist\" once per outer row, so a stray `NULL` inside `orders.customer_id` can never make the whole query silently return nothing.",
                    "",
                    "## Why the plan shape matters too",
                    "",
                    "Beyond correctness, `EXISTS`/`NOT EXISTS` and `IN`/`NOT IN (SELECT ...)` typically get optimized very differently. `EXISTS` is a short-circuiting existence check: the engine can stop scanning `orders` for a given customer the instant it finds one match, and modern query planners recognize the pattern and often execute it as a semi-join without ever materializing the subquery's full result. `IN (SELECT ...)`, by contrast, more often needs the subquery's entire result set built (or at least indexed) before any outer-row comparison can happen. On four rows the difference is invisible; on a real orders table, `EXISTS` scales the way the business question actually intends -- \"does at least one exist\" -- while `IN` scales like \"build the whole list, then check membership.\"",
                    "",
                    ":::callout{kind=\"pitfall\"}",
                    "The tell interviewers are listening for is whether `NOT IN (SELECT ...)` is the pattern you reach for by habit, or whether `NOT EXISTS` comes out first without being prompted. Naming `NOT EXISTS` as the default for \"does a match exist\" -- rather than defaulting to a join-plus-`DISTINCT` for existence, or `IN`/`NOT IN` for exclusion -- signals you've internalized that existence and combination are different questions with different right tools, not two names for the same operation.",
                    ":::",
                    "",
                    "## Next",
                    "",
                    "Write the anti-join version for products instead of customers: which products in this schema have never appeared in any `order_items` row? Use `NOT EXISTS`, and be ready to say why a `LEFT JOIN ... WHERE product_id IS NULL` version would need the join column checked, specifically, rather than just any column from the right-hand table.",
                ),
            },
            {
                title: "Fan-Out and Row Multiplication",
                slug: "fan-out-and-row-multiplication",
                summary:
                    "Joining through a one-to-many relationship multiplies rows before any aggregate runs on them -- the classic way a revenue total quietly doubles without a single wrong value anywhere in the query.",
                readingMinutes: 4,
                status: "PUBLISHED",
                checkpointProblemSlugs: ["top-selling-products"],
                body: md(
                    "# Fan-Out and Row Multiplication",
                    "",
                    "A join to a one-to-many relationship doesn't just add columns -- it adds rows. Every row on the \"one\" side gets repeated once for each matching row on the \"many\" side, and if you then aggregate a column that belongs to the \"one\" side, you're summing that value once per repetition instead of once per original row. Nothing about this raises an error. The query runs, returns a plausible-looking number, and that number is wrong -- which makes fan-out the single most expensive join mistake to leave uncaught, because it corrupts a total silently rather than crashing loudly.",
                    "",
                    "## Watching it happen",
                    "",
                    "This schema's `orders` table has a one-to-many relationship with `order_items` -- most orders have more than one line item:",
                    "",
                    "```sql",
                    "SELECT o.order_id, COUNT(*) AS item_count",
                    "FROM orders o",
                    "JOIN order_items oi ON oi.order_id = o.order_id",
                    "GROUP BY o.order_id",
                    "ORDER BY o.order_id;",
                    "```",
                    "",
                    "```",
                    "order_id | item_count",
                    "1001     | 2",
                    "1002     | 1",
                    "1003     | 1",
                    "1004     | 2",
                    "```",
                    "",
                    "Orders 1001 and 1004 each have two line items; 1002 and 1003 have one each. Now suppose the goal is total revenue per customer, and the query joins all the way out to `order_items` -- maybe because a later part of the report also needs item-level detail:",
                    "",
                    "```sql",
                    "SELECT c.name, SUM(o.total_amount) AS corrupted_total",
                    "FROM customers c",
                    "JOIN orders o ON o.customer_id = c.customer_id",
                    "JOIN order_items oi ON oi.order_id = o.order_id",
                    "GROUP BY c.name",
                    "ORDER BY c.name;",
                    "```",
                    "",
                    "```",
                    "name          | corrupted_total",
                    "Alice Johnson | 2700",
                    "Jane Smith    | 800",
                    "John Doe      | 2800",
                    "```",
                    "",
                    "Compare that to the real totals -- Alice Johnson placed one order worth 1350, John Doe placed two worth 1450 combined, Jane Smith placed one worth 800. Alice's total came back exactly doubled (2700 instead of 1350) because her one order has two line items, so the join produced two copies of her `orders` row, and `SUM(o.total_amount)` added `total_amount` in on both copies. John Doe's total is inflated to 2800 instead of 1450 for the same reason, just asymmetric -- one of his two orders has two items (counted twice) and the other has one (counted once). Jane Smith's total happens to be correct, purely by accident: her single order has exactly one line item, so there's no repetition to inflate it. Nothing in the query signals that three-quarters of these numbers are wrong.",
                    "",
                    "## The fix: don't aggregate a column past the join that repeats it",
                    "",
                    "```sql",
                    "SELECT c.name, SUM(o.total_amount) AS correct_total",
                    "FROM customers c",
                    "JOIN orders o ON o.customer_id = c.customer_id",
                    "GROUP BY c.name",
                    "ORDER BY c.name;",
                    "```",
                    "",
                    "```",
                    "name          | correct_total",
                    "Alice Johnson | 1350",
                    "Jane Smith    | 800",
                    "John Doe      | 1450",
                    "```",
                    "",
                    "Dropping `order_items` from this particular query fixes it, because `total_amount` lives on `orders`, and summing it only requires joining as far as `orders` -- one row per order, no repetition. If item-level detail is genuinely needed *alongside* the customer total, the right move is to aggregate each side independently before combining them -- sum `order_items` down to one row per order in its own subquery or CTE, and only then join that pre-aggregated result to `orders` and `customers` -- rather than joining the raw many-side table and summing a one-side column across the inflated result. `SUM(DISTINCT ...)` is not a safe shortcut here either: it would deduplicate identical *values*, not identical *rows*, so it silently breaks the moment two different orders legitimately share the same `total_amount` -- which they already do in this exact fixture (1001 and 1004 both total 1350).",
                    "",
                    "Notice the checkpoint problem for this lesson, `top-selling-products`, does the opposite of the trap above on purpose: it asks for total quantity sold per product, which is a column that genuinely lives on `order_items` (`quantity`), aggregated by joining `order_items` to `products`. That join doesn't fan out `products`' own columns, because the aggregate target is native to the many-side table, not borrowed from the one-side. The rule isn't \"never join to a many-side table\" -- it's \"know which side the column you're summing actually lives on before you decide how far to join.\"",
                    "",
                    ":::callout{kind=\"pitfall\"}",
                    "This is the join bug interviewers rate as highest-value to catch, because it produces a number that looks completely reasonable -- no crash, no `NULL`, nothing on the screen suggesting anything is wrong -- and it's exactly the shape of bug that makes it into a finance dashboard undetected. The tell is a habit, not a clever trick: before trusting any aggregate computed across a join, check whether the row count grew relative to the table the aggregated column belongs to. If summing `orders.total_amount` produces more rows feeding into that `SUM` than `orders` actually has, something upstream fanned it out, and the total needs to be recomputed either before the fan-out join or from a pre-aggregated source.",
                    ":::",
                    "",
                    "## Next",
                    "",
                    "Write a query that reports, per order, its `total_amount` alongside the number of line items on it -- without letting that count multiply `total_amount` itself. Decide whether you need one join or two pre-aggregated pieces joined together, and check the row count of your result against the row count of `orders` before you trust it.",
                ),
            },
        ],
    },

    // -------------------------------------------------------------------
    // Module 02 (position 2) -- Aggregation. Full prose (part 2).
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
                readingMinutes: 4,
                status: "PUBLISHED",
                checkpointProblemSlugs: ["avg-salary-per-department"],
                body: md(
                    "# GROUP BY and the Grain of a Result",
                    "",
                    "Every `GROUP BY` is a declaration, whether or not you think of it that way: \"the output of this query has exactly one row per distinct combination of these columns.\" That combination is the *grain* of the result -- one row per department, one row per customer, one row per customer per month. Almost every aggregation bug traces back to the same root cause: the query's actual grain, as written, doesn't match the grain the question was asking for. Naming the grain in words before writing `GROUP BY` -- \"one row per what?\" -- turns most of these bugs into non-events, because the mismatch becomes visible before you run anything.",
                    "",
                    "## A grain stated correctly",
                    "",
                    "\"Average salary per department\" names its grain directly: one row per department.",
                    "",
                    "```sql",
                    "SELECT d.name AS department, ROUND(AVG(s.amount)::numeric, 2) AS avg_salary",
                    "FROM departments d",
                    "JOIN employees e ON e.department_id = d.id",
                    "JOIN salaries s ON s.employee_id = e.id",
                    "GROUP BY d.name",
                    "ORDER BY department;",
                    "```",
                    "",
                    "```",
                    "department  | avg_salary",
                    "Engineering | 95250.00",
                    "Marketing   | 67500.00",
                    "Sales       | 95666.67",
                    "```",
                    "",
                    "Three departments in, three rows out. `GROUP BY d.name` is what makes that true -- every employee-and-salary row gets collapsed into the one group its department belongs to, and `AVG(s.amount)` is computed once per group. That's the whole mechanism: `GROUP BY` doesn't just sort or organize rows, it determines how many rows come out the other end, and which values from the original rows are even still visible to `SELECT`.",
                    "",
                    "## The same query, wrong grain",
                    "",
                    "Watch what happens if you add one more column to `GROUP BY` without meaning to change the question:",
                    "",
                    "```sql",
                    "SELECT d.name AS department, e.name AS employee, AVG(s.amount) AS avg_salary",
                    "FROM departments d",
                    "JOIN employees e ON e.department_id = d.id",
                    "JOIN salaries s ON s.employee_id = e.id",
                    "GROUP BY d.name, e.name",
                    "ORDER BY department, employee;",
                    "```",
                    "",
                    "```",
                    "department  | employee | avg_salary",
                    "Engineering | Alice    | 95000",
                    "Engineering | Bob      | 120000",
                    "Engineering | Frank    | 88000",
                    "Engineering | Ian      | 78000",
                    "```",
                    "",
                    "The query still runs. It still has an `AVG` in it. Nothing errors. But the grain silently changed from \"one row per department\" to \"one row per department per employee\" the moment `e.name` joined `d.name` in `GROUP BY`, and at that grain, each group contains exactly one salary -- so `AVG` is just returning that one number back, unchanged. It looks like a department-average query and computes something else entirely. The bug isn't a wrong formula; it's a `GROUP BY` clause that quietly declared a different, finer grain than the one the question asked for.",
                    "",
                    "The opposite mistake is just as common: dropping `GROUP BY` entirely collapses the grain all the way down to \"one row, period\" --",
                    "",
                    "```sql",
                    "SELECT AVG(s.amount) AS avg_salary",
                    "FROM departments d",
                    "JOIN employees e ON e.department_id = d.id",
                    "JOIN salaries s ON s.employee_id = e.id;",
                    "```",
                    "",
                    "returns a single row, `89222.22`, the company-wide average with no department breakdown at all. Also a valid grain, just a much coarser one than \"per department\" -- and a genuinely different, useful answer to a genuinely different question. The point isn't that finer or coarser grain is wrong; it's that the grain has to be a deliberate choice, matched to what's being asked, rather than whatever falls out of which columns happened to land in `SELECT`.",
                    "",
                    "## Why the engine won't let you get this wrong silently, most of the time",
                    "",
                    "Postgres (and DuckDB, and most modern engines) actually enforce grain discipline at the syntax level: every column named in `SELECT` that isn't wrapped in an aggregate function must also appear in `GROUP BY`, or the query is rejected outright rather than producing a nonsensical mix of aggregated and non-aggregated values per row. That's a real guardrail, but it only catches the case where you forget a column entirely -- it says nothing about whether the columns you *did* include define the grain you actually meant. `GROUP BY d.name, e.name` is perfectly legal syntax; the engine has no way to know you meant department-level and typed employee-level by mistake.",
                    "",
                    ":::callout{kind=\"pitfall\"}",
                    "The question interviewers use to probe this is almost always some version of \"what's the grain of this result?\" -- asked right after you produce a working aggregation query. A candidate who can answer immediately, in one sentence (\"one row per department\"), is demonstrating they chose the `GROUP BY` columns deliberately. A candidate who has to look back at the query to figure out what grain it actually produces is revealing they wrote the aggregate first and let the grain fall out as a side effect -- which is exactly how a `GROUP BY d.name, e.name` typo (extra column, or the wrong one) survives code review undetected.",
                    ":::",
                    "",
                    "## Next",
                    "",
                    "State the grain in one sentence, then write the query: \"for each department, how many distinct hire years does it have among its employees?\" Before you write `GROUP BY`, decide whether the grain is per department, per department per year, or something else -- the sentence should make the `GROUP BY` clause obvious before you type it.",
                ),
            },
            {
                title: "HAVING vs WHERE",
                slug: "having-vs-where",
                summary:
                    "WHERE filters rows before grouping; HAVING filters groups after -- which means HAVING is the only clause that can filter on an aggregate, and WHERE is the only one that can filter without paying for a full aggregation first.",
                readingMinutes: 4,
                status: "PUBLISHED",
                checkpointProblemSlugs: ["customers-with-multiple-orders"],
                body: md(
                    "# HAVING vs WHERE",
                    "",
                    "`WHERE` and `HAVING` both filter -- that similarity is the entire source of confusion between them. The difference is *when*: `WHERE` filters individual rows before any grouping happens, and `HAVING` filters groups after they've already been formed. That single fact, straight out of the clause-evaluation order from the foundations module, determines everything else about which one to reach for: `WHERE` can never see an aggregate, because aggregates don't exist yet when `WHERE` runs, and `HAVING` is the only clause in the query that can filter on one.",
                    "",
                    "## HAVING: filtering the groups themselves",
                    "",
                    "The checkpoint for this lesson asks for every customer who's placed more than one order -- a condition on a *count*, which only exists after grouping:",
                    "",
                    "```sql",
                    "SELECT customer_id, COUNT(*) AS order_count",
                    "FROM orders",
                    "GROUP BY customer_id",
                    "HAVING COUNT(*) > 1",
                    "ORDER BY customer_id;",
                    "```",
                    "",
                    "```",
                    "customer_id | order_count",
                    "1           | 2",
                    "```",
                    "",
                    "`GROUP BY customer_id` collapses this schema's four orders into three groups -- customer 1 has two orders, customers 2 and 3 have one each. `HAVING COUNT(*) > 1` then inspects each group's count and keeps only the ones that pass, which leaves exactly customer 1. There's no way to ask this question with `WHERE` at all: `orders.customer_id` alone, one row at a time, has no concept of \"how many total orders does this customer have\" -- that number only exists once the rows have been grouped and counted.",
                    "",
                    "## WHERE and HAVING together, doing different jobs",
                    "",
                    "The two aren't mutually exclusive -- most real queries need both, each filtering a different thing:",
                    "",
                    "```sql",
                    "SELECT customer_id, COUNT(*) AS order_count",
                    "FROM orders",
                    "WHERE order_date >= DATE '2023-02-01'",
                    "GROUP BY customer_id",
                    "HAVING COUNT(*) >= 1",
                    "ORDER BY customer_id;",
                    "```",
                    "",
                    "```",
                    "customer_id | order_count",
                    "1           | 1",
                    "3           | 1",
                    "```",
                    "",
                    "`WHERE order_date >= DATE '2023-02-01'` runs first and throws away every order before February, row by row -- that drops two of the four orders (both from January) before grouping ever happens. `GROUP BY` then collapses what's left. `HAVING COUNT(*) >= 1` runs last, filtering the resulting groups -- here it's not doing much work since every remaining group already has at least one order, but the clause is doing a genuinely different job than `WHERE` did: one filters raw rows on a raw-row condition, the other filters finished groups on a group-level condition.",
                    "",
                    "## Why \"put it in WHERE instead\" isn't a valid rewrite",
                    "",
                    "It's tempting to treat `WHERE` and `HAVING` as interchangeable and just pick whichever reads more naturally. They aren't interchangeable, and the engine won't quietly reinterpret one as the other:",
                    "",
                    "```sql",
                    "SELECT customer_id, COUNT(*) AS order_count",
                    "FROM orders",
                    "WHERE COUNT(*) > 1",
                    "GROUP BY customer_id;",
                    "```",
                    "",
                    "```",
                    "ERROR:  aggregate functions are not allowed in WHERE",
                    "```",
                    "",
                    "This isn't a style complaint from the engine -- it's a hard error, because `COUNT(*)` genuinely does not exist at the point `WHERE` executes. `WHERE` runs against raw table rows, before `GROUP BY` has collapsed anything and before any aggregate function has been evaluated over anything. Asking `WHERE` to filter on `COUNT(*) > 1` is asking it to see something that its position in the execution order guarantees it cannot see yet.",
                    "",
                    "The reverse substitution has a cost even where it's technically legal: `HAVING order_date >= DATE '2023-02-01'` would work syntactically (nothing stops you from putting a non-aggregate condition in `HAVING`), but it throws away the main advantage of filtering early. `WHERE` shrinks the row set *before* the expensive work of grouping and aggregating runs over it; a condition parked in `HAVING` instead means the engine groups and aggregates every row first, including ones that were always going to be filtered out, and only discards the resulting groups afterward. On four rows that's free. On a real orders table, filtering row-level conditions as early as possible -- in `WHERE`, not `HAVING` -- is the difference between aggregating a relevant slice of the table and aggregating all of it.",
                    "",
                    ":::callout{kind=\"pitfall\"}",
                    "The tell interviewers are checking for isn't whether you eventually get `HAVING COUNT(*) > 1` to compile -- it's whether you can say, before hitting the error, that an aggregate can never appear in `WHERE` because `WHERE` executes before grouping exists, full stop. That's a fact about evaluation order, not a syntax rule to memorize case by case. The corollary worth stating unprompted: any condition that doesn't need an aggregate belongs in `WHERE`, even if `HAVING` would also accept it, because filtering rows before aggregating is strictly cheaper than aggregating everything and filtering the leftovers.",
                    ":::",
                    "",
                    "## Next",
                    "",
                    "Write a query that returns each customer's order count, but only for customers whose orders total more than 1000 combined, restricted to orders placed in 2023. Decide, before writing a line of SQL, which condition belongs in `WHERE` and which belongs in `HAVING` -- and be ready to say why swapping them wouldn't just be different style, it would be wrong.",
                ),
            },
            {
                title: "COUNT(*) vs COUNT(column)",
                slug: "count-star-vs-count-col",
                summary:
                    "COUNT(*) counts rows regardless of NULLs; COUNT(column) silently skips them -- a one-character difference that can make two counts on the same table legitimately disagree.",
                readingMinutes: 4,
                status: "PUBLISHED",
                // Checkpoint is an imperfect match -- see the gaps note at
                // the top of this file -- but is the closest available
                // published problem; the lesson body says so explicitly.
                checkpointProblemSlugs: ["orders-per-country"],
                body: md(
                    "# COUNT(*) vs COUNT(column)",
                    "",
                    "`COUNT(*)`, `COUNT(column)`, and `COUNT(DISTINCT column)` all answer \"how many,\" but they're not three spellings of the same question. `COUNT(*)` counts rows -- every row in the group, full stop, regardless of what any particular column contains. `COUNT(column)` counts values -- specifically, non-`NULL` values in that column, silently skipping any row where it's `NULL`. `COUNT(DISTINCT column)` narrows that further to distinct non-`NULL` values. The three can legitimately disagree on the exact same table, and which one is correct depends entirely on what \"how many\" is actually supposed to mean for the question being asked.",
                    "",
                    "## A divergence this fixture can show you directly",
                    "",
                    "`orders.customer_id` is never `NULL` in this schema, but customer 1 has placed two orders -- so `COUNT(*)`, `COUNT(customer_id)`, and `COUNT(DISTINCT customer_id)` already diverge on real data, no hypothetical required:",
                    "",
                    "```sql",
                    "SELECT COUNT(*) AS total_rows,",
                    "       COUNT(customer_id) AS non_null_customer_ids,",
                    "       COUNT(DISTINCT customer_id) AS distinct_customers",
                    "FROM orders;",
                    "```",
                    "",
                    "```",
                    "total_rows | non_null_customer_ids | distinct_customers",
                    "4          | 4                     | 3",
                    "```",
                    "",
                    "`COUNT(*)` and `COUNT(customer_id)` agree here (4 and 4) purely because `customer_id` happens to never be `NULL` in this table -- that's a property of this specific data, not a guarantee `COUNT(*)` and `COUNT(column)` make in general. `COUNT(DISTINCT customer_id)` is the one that diverges concretely: 3, not 4, because customer 1 accounts for two of the four rows. If the question is \"how many orders were placed,\" `COUNT(*)` (or `COUNT(customer_id)`, here) is correct. If the question is \"how many distinct customers ordered,\" only `COUNT(DISTINCT customer_id)` answers it -- `COUNT(*)` would overcount by double-counting repeat customers.",
                    "",
                    "## The divergence this fixture can't show you -- said plainly",
                    "",
                    "The other classic gap -- `COUNT(*)` vs. `COUNT(column)` disagreeing because the column itself has `NULL`s -- can't be demonstrated on this database honestly, because no table in these fixtures has a column that's ever actually `NULL`. Rather than fake a result, here's the mechanism stated with a hypothetical: imagine `orders` had a `shipped_date` column, populated only once a warehouse actually ships the order and `NULL` until then. `COUNT(*)` over that table would still count every order, shipped or not. `COUNT(shipped_date)` would count only the ones with a real date in that column -- i.e., only the ones that have actually shipped. If 4 orders exist and only 3 have shipped, `COUNT(*)` returns 4 and `COUNT(shipped_date)` returns 3, and the *gap between them* -- 1 -- is itself a meaningful number: orders placed but not yet shipped. That gap is precisely what `COUNT(*)` vs. `COUNT(column)` is for, and it's worth knowing how to reason about even without a fixture that happens to have a nullable column sitting around to prove it.",
                    "",
                    "## Where this checkpoint fits, and where it doesn't quite",
                    "",
                    "The checkpoint for this lesson, `orders-per-country`, groups orders by the customer's country and counts them:",
                    "",
                    "```sql",
                    "SELECT c.country, COUNT(*) AS order_count",
                    "FROM customers c",
                    "JOIN orders o ON o.customer_id = c.customer_id",
                    "GROUP BY c.country",
                    "ORDER BY c.country;",
                    "```",
                    "",
                    "```",
                    "country | order_count",
                    "Canada  | 1",
                    "UK      | 1",
                    "USA     | 2",
                    "```",
                    "",
                    "That's a legitimate `COUNT(*)` use -- counting rows per group, which is exactly what `COUNT(*)` is for -- but it's worth being honest that this particular query doesn't exercise the `COUNT(*)`-vs-`COUNT(column)` distinction itself, since there's no nullable column in play here either. It's the closest published problem to this lesson's topic, not a perfect demonstration of it; the real demonstration is the `customer_id` example above, and the `shipped_date` hypothetical for the NULL-skipping half of the story.",
                    "",
                    ":::callout{kind=\"pitfall\"}",
                    "The failure mode interviewers watch for is treating `COUNT(*)` and `COUNT(some_column)` as interchangeable because they happen to agree on whatever data is currently in front of you -- clean seed data, a demo table, a dataset with no NULLs yet. The moment that column picks up even one `NULL` in production -- a field that's optional, a join that didn't match, a not-yet-populated status -- the two start disagreeing, and code that assumed they were the same starts silently under- or over-counting with no error anywhere. The fix is a habit, not a formula: before writing any `COUNT`, decide out loud whether the question is \"how many rows,\" \"how many non-missing values in this specific column,\" or \"how many distinct values\" -- because those are three different questions, and only one of the three `COUNT` variants answers each.",
                    ":::",
                    "",
                    "## Next",
                    "",
                    "Using this `orders` table, write a query that returns, per customer, both their total order count and their distinct count of order dates. On this data the two numbers will match for every customer -- explain, without running anything, what real-world data would have to look like for them to diverge.",
                ),
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
    // Module 04 (position 4) -- Interview patterns. Full prose (part 2).
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
                readingMinutes: 5,
                status: "PUBLISHED",
                // No published problem in this database models an event
                // log -- documented gap, see file header. Re-checked during
                // part 2: none of the 23 published problems fit.
                checkpointProblemSlugs: [],
                body: md(
                    "# Sessionisation",
                    "",
                    "A raw event log is just a table of actor, timestamp, and whatever else happened -- one row per event, with no notion of \"visit\" or \"session\" anywhere in it. Sessionisation is the process of imposing that structure after the fact: grouping a stream of events into sessions by declaring that a long enough gap between two consecutive events, for the same actor, means the earlier one ended a session and the later one starts a new one. The whole pattern reduces to three window-function steps chained together -- `LAG` to see the previous event, arithmetic to measure the gap, and a running `SUM` to turn \"gap exceeded\" flags into session numbers. This lesson assumes the window-functions module, particularly `LAG`/`LEAD` and running sums.",
                    "",
                    "## Borrowing a table as a stand-in event log",
                    "",
                    "This database doesn't have a purpose-built clickstream fixture, so the worked example below repurposes `orders` for the shape of the problem: `customer_id` plays the role of the actor, `order_date` plays the role of the event timestamp, and each order stands in for an event. That's an honest substitution, not a perfect one -- a real session fixture would have many events per actor within a single day, at minute or second granularity, not one event every few weeks -- but the mechanism is identical regardless of the time unit, and the query below runs against real rows in this schema, not invented ones.",
                    "",
                    "## Step one and two: the gap, and the flag",
                    "",
                    "```sql",
                    "WITH gapped AS (",
                    "  SELECT customer_id, order_id, order_date,",
                    "         order_date - LAG(order_date) OVER (",
                    "           PARTITION BY customer_id ORDER BY order_date, order_id",
                    "         ) AS gap_days",
                    "  FROM orders",
                    "),",
                    "flagged AS (",
                    "  SELECT customer_id, order_id, order_date,",
                    "         CASE WHEN gap_days IS NULL OR gap_days > 7 THEN 1 ELSE 0 END AS new_session",
                    "  FROM gapped",
                    ")",
                    "SELECT * FROM flagged ORDER BY customer_id, order_date;",
                    "```",
                    "",
                    "`LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date, order_id)` reaches back to each customer's own previous event -- `PARTITION BY` keeps one customer's events from ever being compared against another's. `order_date - LAG(...)` turns that into a day gap. The `CASE` then applies a threshold -- here, 7 days -- to decide whether this event starts a new session: `gap_days > 7`, meaning \"more than a week since this actor's last event,\" starts one. `gap_days IS NULL` -- the very first event for a given actor, where `LAG` has nothing to look back to -- is explicitly treated as a new session too, which matters: without that `IS NULL` check, the first event of every customer's history would fail to be flagged as a session start at all.",
                    "",
                    "## Step three: the running total that turns flags into session numbers",
                    "",
                    "```sql",
                    "SELECT customer_id, order_id, order_date,",
                    "       SUM(new_session) OVER (",
                    "         PARTITION BY customer_id ORDER BY order_date, order_id",
                    "       ) AS session_id",
                    "FROM flagged",
                    "ORDER BY customer_id, order_date;",
                    "```",
                    "",
                    "```",
                    "customer_id | order_id | order_date | session_id",
                    "1           | 1001     | 2023-01-15 | 1",
                    "1           | 1003     | 2023-02-10 | 2",
                    "2           | 1002     | 2023-01-16 | 1",
                    "3           | 1004     | 2023-02-20 | 1",
                    "```",
                    "",
                    "Customer 1's two orders are 26 days apart -- past the 7-day threshold -- so the running `SUM` of `new_session` climbs from 1 to 2 between them, splitting customer 1's history into two distinct sessions. Customers 2 and 3 each have only one order in this fixture, so each gets a single session by definition; a real clickstream would show the same customer 1 pattern repeated across many actors, with most sessions containing several events rather than one. The running-sum trick is what does the actual grouping: every event within the same session shares the same cumulative count, because no `new_session = 1` flag has fired since the session began, and the count only increments at exactly the rows where a gap did exceed the threshold.",
                    "",
                    "## Choosing the threshold",
                    "",
                    "7 days is a threshold that suits \"did this customer come back within about a week,\" which is a reasonable definition for an orders-as-events stand-in. A genuine web-session definition typically uses 30 minutes of inactivity; a customer-support-ticket definition might use 24 hours. The window-function mechanics don't change based on that choice -- only the number being compared against `gap_days` does. What does need to be explicit, always, is what unit the gap is measured in and what threshold defines \"too long a gap\" -- both of those are business decisions, not something SQL can infer.",
                    "",
                    ":::callout{kind=\"pitfall\"}",
                    "The bug interviewers specifically probe for here is dropping the `gap_days IS NULL` branch and writing `CASE WHEN gap_days > threshold THEN 1 ELSE 0 END` alone. In SQL, `NULL > 7` evaluates to `NULL`, not `TRUE` or `FALSE`, so a bare `CASE WHEN NULL THEN 1 ELSE 0 END` falls through to `ELSE 0` -- meaning the very first event of every single actor's history gets `new_session = 0`. The running `SUM` still produces a number for that first row, but it's an artifact of arithmetic, not a real session id, and if any actor genuinely has zero prior events, their first-ever event is being told it belongs to \"session zero\" rather than starting session one. Explicitly handling the `NULL` case is not optional polish here -- it's the difference between every actor's history starting at session 1 and it silently starting at session 0.",
                    ":::",
                    "",
                    "## Next",
                    "",
                    "Using the same three-step pattern, rewrite the threshold as 20 days instead of 7, and predict -- before running it -- whether customer 1's two orders now land in the same session or different ones.",
                ),
            },
            {
                title: "Cohort Retention",
                slug: "cohort-retention",
                summary:
                    "A retention table buckets users by their first-seen period, then measures what fraction of each cohort is still active N periods later -- built from a self-join between a cohort-assignment query and the activity log it's measured against.",
                readingMinutes: 4,
                status: "PUBLISHED",
                // No published problem in this database models a cohort
                // table -- documented gap, see file header. Re-checked
                // during part 2: none of the 23 published problems fit.
                checkpointProblemSlugs: [],
                body: md(
                    "# Cohort Retention",
                    "",
                    "A cohort retention table answers one recurring product question in tabular form: of the people who first showed up in a given period, what fraction were still active some number of periods later? Building one always has the same two-part shape -- assign every actor to a cohort based on when they *first* appeared, then separately measure which periods they were active in afterward, and join the two together. The join is doing real work: it's connecting \"when did this actor start\" to \"was this actor still around N periods later,\" which are two different questions answered by two different aggregations over the same underlying events.",
                    "",
                    "## The stand-in fixture, named honestly",
                    "",
                    "There's no dedicated signup-and-activity fixture in this database, so the worked example below treats `orders` the same way the sessionisation lesson did: `customer_id` is the actor, and each order's `order_date` is an activity event. A customer's cohort is the calendar month of their *first* order; retention asks whether that same customer placed *another* order in a later month. With only four orders across three customers, this cohort table will be small enough to read in full, but every number in it comes from a real query against real rows.",
                    "",
                    "## Step one: assign each actor to a cohort",
                    "",
                    "```sql",
                    "SELECT customer_id, DATE_TRUNC('month', MIN(order_date))::date AS cohort_month",
                    "FROM orders",
                    "GROUP BY customer_id",
                    "ORDER BY customer_id;",
                    "```",
                    "",
                    "```",
                    "customer_id | cohort_month",
                    "1           | 2023-01-01",
                    "2           | 2023-01-01",
                    "3           | 2023-02-01",
                    "```",
                    "",
                    "The grain here is one row per customer -- `MIN(order_date)` finds each customer's earliest order, and `DATE_TRUNC('month', ...)` buckets that date down to the month it falls in. Customers 1 and 2 both belong to the January 2023 cohort; customer 3 belongs to February. Bob Brown, who never ordered, correctly has no row at all -- a cohort is defined by a first event, and an actor with zero events has never had one.",
                    "",
                    "## Step two: activity by month, independently",
                    "",
                    "```sql",
                    "SELECT customer_id, DATE_TRUNC('month', order_date)::date AS activity_month",
                    "FROM orders",
                    "ORDER BY customer_id, activity_month;",
                    "```",
                    "",
                    "```",
                    "customer_id | activity_month",
                    "1           | 2023-01-01",
                    "1           | 2023-02-01",
                    "2           | 2023-01-01",
                    "3           | 2023-02-01",
                    "```",
                    "",
                    "This is a separate query on purpose -- it doesn't collapse down to one row per customer, because activity is meant to be checked against every month the actor was seen, not just their first one. Customer 1 shows up in both January and February; customers 2 and 3 each show up in exactly the one month they ordered in.",
                    "",
                    "## Step three: joining cohort to activity to compute retention",
                    "",
                    "```sql",
                    "WITH cohorts AS (",
                    "  SELECT customer_id, DATE_TRUNC('month', MIN(order_date))::date AS cohort_month",
                    "  FROM orders GROUP BY customer_id",
                    "),",
                    "activity AS (",
                    "  SELECT DISTINCT customer_id, DATE_TRUNC('month', order_date)::date AS activity_month",
                    "  FROM orders",
                    ")",
                    "SELECT c.cohort_month,",
                    "       DATE_PART('month', AGE(a.activity_month, c.cohort_month)) AS months_since_cohort,",
                    "       COUNT(DISTINCT c.customer_id) AS retained",
                    "FROM cohorts c",
                    "JOIN activity a ON a.customer_id = c.customer_id AND a.activity_month >= c.cohort_month",
                    "GROUP BY c.cohort_month, months_since_cohort",
                    "ORDER BY c.cohort_month, months_since_cohort;",
                    "```",
                    "",
                    "Run against this fixture, the January 2023 cohort has 2 customers total; of those, 2 are \"active\" at month offset 0 (their own first month, trivially true) and only 1 -- customer 1 -- is active again at month offset 1 (February). That's a 50% one-month retention rate for the January cohort, computed from real orders, not assumed. The February 2023 cohort has 1 customer (customer 3), active at offset 0, with no offset-1 row at all -- there's no March data in this fixture to say whether they returned, which is a different, honest state from \"0% retained\": it's \"not enough time has passed to know yet,\" and a real retention report needs to represent that distinction rather than silently rendering it as a zero.",
                    "",
                    "## Self-join framing vs. window framing",
                    "",
                    "The query above joins two independently-aggregated CTEs -- a self-join in spirit, even though it's phrased as `cohorts` joined to `activity` rather than `orders` joined to itself twice. The window-function alternative computes the cohort inline with `MIN(order_date) OVER (PARTITION BY customer_id)` alongside each raw event, skipping the separate `cohorts` CTE. Both reach the same numbers; the CTE-and-join version tends to read more clearly for a multi-period retention table like this one, because the grain change -- from \"one row per event\" to \"one row per cohort per offset\" -- is easier to see as two named, separately-aggregated steps than folded into a single windowed pass.",
                    "",
                    ":::callout{kind=\"pitfall\"}",
                    "The specific bug interviewers watch for is using an `INNER JOIN` (or, equivalently, filtering out unmatched combinations) between the cohort list and the activity list, rather than deliberately choosing whether unmatched `(cohort, month-offset)` pairs should show up as `0%` retained or be absent entirely. Just like the unmatched-row question from the joins module, an inner join here silently drops any cohort-offset combination with zero retained users instead of reporting it as a real, meaningful zero -- and because the missing row is buried inside an aggregated report rather than an obviously blank column, it's far easier to miss than a `NULL` sitting in a result set.",
                    ":::",
                    "",
                    "## Next",
                    "",
                    "Extend the retention query to compute the January 2023 cohort's retention at month offset 2 (March 2023) as well, and explain, using this fixture's actual data, why that row is either a `0%` or entirely absent -- and which of those two you'd choose to report, and why.",
                ),
            },
            {
                title: "Metric Definitions That Survive Review",
                slug: "metric-definitions-that-survive-review",
                summary:
                    "The SQL for 'active user' or 'conversion rate' is easy to write and easy to get subtly wrong -- the durable version states its grain, its filters, and its edge cases explicitly enough that two different analysts compute the same number independently.",
                readingMinutes: 4,
                status: "PUBLISHED",
                // Conceptual -- no single published problem fits, since
                // this lesson isn't about syntax. Documented gap, see file
                // header. Re-checked during part 2: none of the 23
                // published problems fit.
                checkpointProblemSlugs: [],
                body: md(
                    "# Metric Definitions That Survive Review",
                    "",
                    "Every other lesson in this track is about syntax: which clause runs when, which join keeps which rows, which window function sees which neighbors. This one isn't. \"Active user,\" \"conversion rate,\" \"churned customer\" -- these phrases sound precise and are not. Each one hides a handful of decisions -- what counts as an event, over what window, measured from when, inclusive or exclusive of which boundary -- and SQL will happily compute a confident, specific number for any interpretation you hand it. The number being confident and specific is exactly the problem: it looks authoritative regardless of which unstated assumption produced it, and two analysts can both write correct SQL against the same table and land on different, equally defensible numbers.",
                    "",
                    "## Three definitions, one table, three different answers",
                    "",
                    "This isn't a hypothetical. Take \"active customer\" against this schema's real `orders` data and pick three reasonable-sounding definitions, each translated into a real query:",
                    "",
                    "```sql",
                    "SELECT COUNT(DISTINCT customer_id) AS active_customers",
                    "FROM orders;",
                    "```",
                    "",
                    "```sql",
                    "SELECT COUNT(*) AS active_customers",
                    "FROM (SELECT customer_id FROM orders GROUP BY customer_id HAVING COUNT(*) > 1) repeat_customers;",
                    "```",
                    "",
                    "```sql",
                    "SELECT COUNT(DISTINCT customer_id) AS active_customers",
                    "FROM orders",
                    "WHERE order_date >= DATE '2023-02-01' AND order_date < DATE '2023-03-01';",
                    "```",
                    "",
                    "```",
                    "definition            | active_customers",
                    "ever ordered          | 3",
                    "more than one order   | 1",
                    "ordered in Feb 2023   | 2",
                    "```",
                    "",
                    "\"Ever placed an order\" counts 3 customers. \"Has placed more than one order\" -- a stricter, engagement-flavored reading of \"active\" -- counts 1. \"Ordered within the most recent calendar month\" -- a recency-flavored reading -- counts 2. None of these queries has a bug. Every one of them is a correct answer to a slightly different question, and \"active customers: 3\" vs. \"active customers: 1\" is a 3x swing on the exact same underlying data, produced entirely by which unstated assumption got baked into the SQL.",
                    "",
                    "## What makes a definition auditable",
                    "",
                    "A metric definition survives review when a second analyst, given only the written definition and the raw tables, computes the identical number independently -- without needing to read your SQL to figure out what you meant. That requires pinning down, in writing, before any SQL gets typed:",
                    "",
                    "- **The grain.** Per customer? Per customer per day? \"Active\" measured once, ever, or re-evaluated every period?",
                    "- **The time window, with explicit boundaries.** \"This month\" is ambiguous about whether the current, still-in-progress day counts. `select-where-and-evaluation-order` already covers why a half-open range (`>= start AND < end_exclusive`) is the safe default for any window with a time component -- the same discipline applies here, not just to `WHERE` clauses in isolation.",
                    "- **The qualifying event.** An order placed? Paid for? Delivered, not refunded? \"Activity\" can mean any of these, and a refunded order counting as \"active\" is a defensible bug hiding in a metric nobody wrote down precisely.",
                    "- **The edge cases.** A customer who ordered once and refunded it. A customer who signed up but the order hasn't cleared yet. Silence on these isn't neutral -- it just means whoever writes the SQL first decides, implicitly, and nobody downstream knows a decision was even made.",
                    "",
                    "Write those four things down as a short spec *before* SQL, and the SQL becomes close to mechanical -- there's exactly one query that implements a fully-specified definition, whereas there are several plausible queries for an unspecified one.",
                    "",
                    "## Why this actually breaks things, not just annoys people",
                    "",
                    "A metric defined only informally -- \"let's track active users,\" agreed in a meeting with no written follow-up -- drifts the moment more than one person touches it. One analyst builds a dashboard using \"any order ever.\" Another builds a board deck using \"ordered in the last 30 days.\" Both numbers are correct by their own author's logic. Neither author necessarily knows the other's definition differs, because nothing was ever written down to compare against. The two numbers disagree, someone in a room notices, and the conversation that follows is never really about SQL -- it's a scramble to reverse-engineer two definitions that should have been reconciled before either query was written.",
                    "",
                    ":::callout{kind=\"pitfall\"}",
                    "When an interviewer says \"write a query to find active users,\" the failure mode is treating that as a green light to start typing `SELECT`. The candidate who pauses and asks \"active over what window, and does a refund count against it?\" before writing anything is demonstrating they've operated a metric that mattered in production -- because that's precisely the moment those questions get expensive to answer wrong. Writing SQL immediately, against an unstated definition, optimizes for looking fast over being right, and it's the single clearest signal of someone who has defined a metric once and never had to defend it three months later when it disagreed with someone else's number.",
                    ":::",
                    "",
                    "## Next",
                    "",
                    "Pick one of the three \"active customer\" definitions above, write it as a two-sentence spec covering grain, window, and qualifying event, and then write the query that implements exactly that spec -- no more, no less than what the spec says.",
                ),
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
            readingMinutes: true,
            hasVisualBlocks: true,
        },
    })

    // `status` is deliberately excluded from both `changed` and the
    // upsert's `update:` object, same reasoning as Track.upsert in
    // main(): publish state is a moderation decision, not this seed's to
    // make on an update. An admin who unpublishes one of these lessons
    // through the admin portal (e.g. to pull it while fixing an error)
    // must have that decision stick -- this seed re-running to fix a typo
    // in the content must not silently republish it. `status` still
    // appears in `create:` so a genuinely new lesson still publishes.
    const changed =
        !existing ||
        existing.title !== input.title ||
        existing.content !== input.content ||
        existing.summary !== input.summary ||
        existing.topicId !== input.topicId ||
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

    // Guarded the same way upsertLessonArticle() guards Article: Track has
    // `updatedAt @updatedAt`, and Prisma's upsert() fires the update branch
    // (bumping updatedAt) on every run even when the payload is identical
    // to what's already stored. Read first and only upsert when something
    // actually changed, so a second run with unchanged TRACK data is a true
    // no-op for this row too.
    //
    // `status` is deliberately excluded from both the comparison below and
    // the upsert's `update:` object. Global constraint for this plan:
    // attaching curriculum never mutates Track.status -- publishing stays a
    // deliberate human action. TRACK.status is only ever "DRAFT" here, and
    // it's written on `create:` so a brand-new track still starts as a
    // draft, but it must never be written on an update, or a re-run of this
    // script against a track a human already published through the admin
    // portal would silently revert that publish back to DRAFT. A re-run
    // against a published track leaves it published.
    const existingTrack = await prisma.track.findUnique({
        where: { slug: TRACK_SLUG },
        select: {
            id: true,
            slug: true,
            name: true,
            summary: true,
            description: true,
            difficulty: true,
            estimatedMinutes: true,
        },
    })
    const trackChanged =
        !existingTrack ||
        existingTrack.name !== TRACK.name ||
        existingTrack.summary !== TRACK.summary ||
        existingTrack.description !== TRACK.description ||
        existingTrack.difficulty !== TRACK.difficulty ||
        existingTrack.estimatedMinutes !== TRACK.estimatedMinutes

    const track = trackChanged
        ? await prisma.track.upsert({
              where: { slug: TRACK_SLUG },
              update: {
                  name: TRACK.name,
                  summary: TRACK.summary,
                  description: TRACK.description,
                  difficulty: TRACK.difficulty,
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
        : existingTrack
    console.log(`  track: ${track.slug} (${trackChanged ? "created-or-updated" : "unchanged"})`)

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
                } else if (cp.status === 404) {
                    // The problem doesn't exist in this database — e.g. a
                    // fresh checkout seeded only with prisma/seed.ts's 11
                    // problems, missing one of the slugs this track's
                    // checkpoints reference. Record it as a gap, exactly
                    // like the empty-checkpoint path above, rather than
                    // aborting the whole run and leaving a partial track.
                    const gap = `${mod.slug}/${lesson.slug}: checkpoint problem "${problemSlug}" not found in this database (skipped)`
                    gaps.push(gap)
                    console.warn(`  ! ${gap}`)
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
