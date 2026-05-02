// /learn/[topicSlug]/[articleSlug] — long-form article reader with TOC + related problems.
function ArticleReader({ article, onProblem, onBack }) {
  const a = article || { topic: "SQL fundamentals", title: "How GROUP BY actually works", summary: "From row groups to aggregate functions: a precise mental model that survives JOINs, HAVING, and window functions.", date: "Mar 12, 2026", read: 8 };
  const toc = [
    { id: "intro", label: "What aggregation actually means", active: true },
    { id: "rows", label: "Rows in, groups out" },
    { id: "agg", label: "Choosing an aggregate" },
    { id: "having", label: "WHERE vs HAVING" },
    { id: "joins", label: "GROUP BY across JOINs" },
    { id: "wrap", label: "Wrapping up" },
  ];
  const related = [
    { slug: "duplicate-emails", title: "Find duplicate emails", level: "easy" },
    { slug: "top-customers", title: "Top 3 customers by revenue", level: "easy" },
    { slug: "active-accounts", title: "Active accounts in last 30 days", level: "medium" },
  ];
  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px", display: "grid", gridTemplateColumns: "1fr 260px", gap: 48 }}>
      <article style={{ minWidth: 0, maxWidth: 720 }}>
        <a href="#" onClick={(e)=>{e.preventDefault();onBack?.();}} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "hsl(220 9% 46%)", textDecoration: "none", marginBottom: 24 }}>
          <i data-lucide="chevron-left" style={{ width: 14, height: 14 }}></i>
          {a.topic}
        </a>
        <header style={{ borderBottom: "1px solid hsl(220 13% 91%)", paddingBottom: 24, marginBottom: 28 }}>
          <h1 style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.015em", margin: 0, textWrap: "balance" }}>{a.title}</h1>
          <p style={{ marginTop: 12, fontSize: 18, lineHeight: 1.6, color: "hsl(220 9% 46%)", textWrap: "pretty" }}>{a.summary}</p>
          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 10, fontSize: 13, color: "hsl(220 9% 46%)", alignItems: "center" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ height: 24, width: 24, borderRadius: 9999, background: "hsl(220 14% 96%)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: "hsl(222 47% 11%)" }}>JK</span>
              By Jia Khatri
            </span>
            <span>·</span>
            <span>{a.date}</span>
            <span>·</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} className="tabular-nums"><i data-lucide="clock" style={{ width: 13, height: 13 }}></i>{a.read} min read</span>
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 6 }}>
            <Tag>group-by</Tag><Tag>aggregation</Tag><Tag>fundamentals</Tag>
          </div>
        </header>

        <div style={{ fontSize: 16, lineHeight: 1.75, color: "hsl(222 47% 16%)", display: "flex", flexDirection: "column", gap: 18 }}>
          <h2 id="intro" style={{ scrollMarginTop: 96, fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", margin: "8px 0 4px" }}>What aggregation actually means</h2>
          <p style={{ margin: 0, textWrap: "pretty" }}>Most engineers learn GROUP BY as a recipe: <em>"collapse rows that share the same key, then run COUNT/SUM/AVG."</em> That's not wrong, but it's unhelpful the moment your query gets a JOIN, a HAVING clause, or a window function next to it. Here's a more precise mental model.</p>
          <p style={{ margin: 0, textWrap: "pretty" }}>A SELECT without GROUP BY produces one output row per input row. A SELECT <em>with</em> GROUP BY produces one output row per <strong>group</strong>, where a group is the set of input rows that share the same value(s) in the grouping columns.</p>

          <pre style={{ margin: "8px 0", padding: 16, borderRadius: 8, border: "1px solid hsl(220 13% 91%)", background: "hsl(222 47% 6%)", fontFamily: "JetBrains Mono", fontSize: 13, color: "hsl(210 20% 92%)", lineHeight: 1.65, overflowX: "auto" }}><span style={{ color: "hsl(142 71% 60%)" }}>SELECT</span> region,
       <span style={{ color: "hsl(280 70% 75%)" }}>COUNT</span>(*) <span style={{ color: "hsl(142 71% 60%)" }}>AS</span> n_customers,
       <span style={{ color: "hsl(280 70% 75%)" }}>SUM</span>(o.amount) <span style={{ color: "hsl(142 71% 60%)" }}>AS</span> revenue
{"\n"}<span style={{ color: "hsl(142 71% 60%)" }}>FROM</span> customers c
{"\n"}<span style={{ color: "hsl(142 71% 60%)" }}>JOIN</span> orders o <span style={{ color: "hsl(142 71% 60%)" }}>ON</span> o.customer_id = c.customer_id
{"\n"}<span style={{ color: "hsl(142 71% 60%)" }}>GROUP BY</span> region;</pre>

          <h2 id="rows" style={{ scrollMarginTop: 96, fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", margin: "12px 0 4px" }}>Rows in, groups out</h2>
          <p style={{ margin: 0, textWrap: "pretty" }}>Every aggregate function operates over a group, not the whole table. <code style={{ fontFamily: "JetBrains Mono", fontSize: 14, padding: "1px 6px", background: "hsl(220 14% 96%)", borderRadius: 4 }}>SUM(o.amount)</code> in the query above is "sum of amounts <em>within this group of customers</em>."</p>

          <div style={{ borderLeft: "3px solid hsl(142 71% 45%)", padding: "12px 16px", background: "hsl(142 76% 96% / 0.5)", borderRadius: "0 6px 6px 0" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "hsl(142 84% 24%)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Note</div>
            <div style={{ fontSize: 14, color: "hsl(142 84% 24%)", lineHeight: 1.6 }}>If a non-aggregated column appears in the SELECT list, it must also appear in GROUP BY. DuckDB will raise <code style={{ fontFamily: "JetBrains Mono", fontSize: 13 }}>BinderException</code> otherwise.</div>
          </div>

          <h2 id="having" style={{ scrollMarginTop: 96, fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", margin: "12px 0 4px" }}>WHERE vs HAVING</h2>
          <p style={{ margin: 0, textWrap: "pretty" }}>WHERE filters rows <em>before</em> they're grouped. HAVING filters groups <em>after</em>. They look similar, but their inputs are completely different shapes.</p>
        </div>

        <nav style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid hsl(220 13% 91%)", display: "flex", justifyContent: "space-between", gap: 14 }}>
          <a href="#" style={{ flex: 1, display: "block", padding: 14, borderRadius: 8, border: "1px solid hsl(220 13% 91%)", textDecoration: "none", color: "hsl(222 47% 11%)" }}>
            <div style={{ fontSize: 11, color: "hsl(220 9% 46%)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4, display: "inline-flex", alignItems: "center", gap: 4 }}><i data-lucide="arrow-left" style={{ width: 11, height: 11 }}></i>Previous</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>SELECT, deeply</div>
          </a>
          <a href="#" style={{ flex: 1, display: "block", padding: 14, borderRadius: 8, border: "1px solid hsl(220 13% 91%)", textDecoration: "none", color: "hsl(222 47% 11%)", textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "hsl(220 9% 46%)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4, display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "flex-end", width: "100%" }}>Next<i data-lucide="arrow-right" style={{ width: 11, height: 11 }}></i></div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>WHERE vs HAVING</div>
          </a>
        </nav>
      </article>

      <aside style={{ position: "sticky", top: 130, alignSelf: "flex-start", display: "flex", flexDirection: "column", gap: 24 }}>
        <div>
          <Eyebrow style={{ marginBottom: 10 }}>On this page</Eyebrow>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6, borderLeft: "1px solid hsl(220 13% 91%)" }}>
            {toc.map(t => (
              <li key={t.id}>
                <a href={`#${t.id}`} style={{
                  display: "block", padding: "4px 12px", fontSize: 13,
                  color: t.active ? "hsl(142 71% 45%)" : "hsl(220 9% 46%)",
                  fontWeight: t.active ? 500 : 400,
                  textDecoration: "none", marginLeft: -1,
                  borderLeft: t.active ? "2px solid hsl(142 71% 45%)" : "2px solid transparent",
                }}>{t.label}</a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Eyebrow style={{ marginBottom: 10 }}>Related problems</Eyebrow>
          <Card padding={0}>
            {related.map((r, i) => (
              <a key={r.slug} href="#" onClick={(e)=>{e.preventDefault();onProblem?.(r);}} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
                borderTop: i ? "1px solid hsl(220 13% 91%)" : "none",
                textDecoration: "none", color: "hsl(222 47% 11%)", fontSize: 13,
                transition: "background-color 150ms",
              }}
                onMouseEnter={(e) => e.currentTarget.style.background = "hsl(220 14% 98%)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <DifficultyPill level={r.level} />
                <span style={{ flex: 1, fontSize: 13 }}>{r.title}</span>
                <i data-lucide="arrow-right" style={{ width: 12, height: 12, color: "hsl(220 9% 46%)" }}></i>
              </a>
            ))}
          </Card>
        </div>
      </aside>
    </main>
  );
}

Object.assign(window, { ArticleReader });
