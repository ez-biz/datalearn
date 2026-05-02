// /learn/[topicSlug] — list of articles within a single topic.
function TopicDetail({ onArticle }) {
  const articles = [
    { slug: "group-by", title: "How GROUP BY actually works", summary: "From row groups to aggregate functions: a precise mental model that survives JOINs, HAVING, and window functions.", date: "Mar 12, 2026", read: 8 },
    { slug: "having-vs-where", title: "WHERE vs HAVING — the order of operations", summary: "Why filtering before grouping is not the same as filtering after, and how DuckDB plans both.", date: "Mar 4, 2026", read: 6 },
    { slug: "count-pitfalls", title: "Three pitfalls of COUNT", summary: "COUNT(*), COUNT(col), and COUNT(DISTINCT col) all answer different questions. Pick the right one.", date: "Feb 22, 2026", read: 5 },
    { slug: "group-rollup", title: "GROUP BY ROLLUP and CUBE", summary: "Sub-totals and grand totals without UNION gymnastics.", date: "Feb 14, 2026", read: 9 },
  ];
  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "48px 32px" }}>
      <a href="#" onClick={(e)=>e.preventDefault()} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "hsl(220 9% 46%)", textDecoration: "none", marginBottom: 24 }}>
        <i data-lucide="chevron-left" style={{ width: 14, height: 14 }}></i>
        All topics
      </a>
      <header style={{ marginBottom: 32 }}>
        <Eyebrow>Topic</Eyebrow>
        <H1 style={{ fontSize: 36, marginTop: 8 }}>SQL fundamentals</H1>
        <Lede style={{ marginTop: 12 }}>The shape of every query: how SELECT, WHERE, GROUP BY, HAVING, and ORDER BY interact, and what your engine does with them.</Lede>
        <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 13, color: "hsl(220 9% 46%)" }}>
          <span><b style={{ color: "hsl(222 47% 11%)" }} className="tabular-nums">12</b> articles</span>
          <span><b style={{ color: "hsl(222 47% 11%)" }} className="tabular-nums">28</b> related problems</span>
        </div>
      </header>
      <Card padding={0}>
        {articles.map((a, i) => (
          <a key={a.slug} href="#" onClick={(e)=>{e.preventDefault();onArticle?.(a);}} style={{
            display: "flex", alignItems: "flex-start", gap: 16, padding: 20,
            borderTop: i ? "1px solid hsl(220 13% 91%)" : "none",
            textDecoration: "none", color: "hsl(222 47% 11%)",
            transition: "background-color 150ms",
          }}
            onMouseEnter={(e) => e.currentTarget.style.background = "hsl(220 14% 98%)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <span style={{ fontSize: 12, color: "hsl(220 9% 46%)", fontFamily: "JetBrains Mono", marginTop: 3, minWidth: 28 }} className="tabular-nums">{String(i + 1).padStart(2, "0")}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{a.title}</div>
              <div style={{ fontSize: 13, color: "hsl(220 9% 46%)", lineHeight: 1.55, marginBottom: 8 }}>{a.summary}</div>
              <div style={{ display: "flex", gap: 10, fontSize: 11, color: "hsl(220 9% 46%)", fontFamily: "JetBrains Mono", alignItems: "center" }}>
                <span>{a.date}</span><span>·</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><i data-lucide="clock" style={{ width: 11, height: 11 }}></i>{a.read} min</span>
              </div>
            </div>
            <i data-lucide="arrow-right" style={{ width: 16, height: 16, color: "hsl(220 9% 46%)", marginTop: 4 }}></i>
          </a>
        ))}
      </Card>
    </main>
  );
}

Object.assign(window, { TopicDetail });
