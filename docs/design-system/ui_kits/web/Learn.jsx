// /learn — topic + article grid.
function LearnHub() {
  const topics = [
    { name: "SQL fundamentals", icon: "database", n: 12, color: "hsl(142 71% 45%)" },
    { name: "Joins, deeply", icon: "git-merge", n: 8, color: "hsl(32 95% 44%)" },
    { name: "Window functions", icon: "layout-grid", n: 6, color: "hsl(280 60% 55%)" },
    { name: "Query optimization", icon: "gauge", n: 9, color: "hsl(200 80% 50%)" },
  ];
  const articles = [
    { topic: "SQL fundamentals", title: "How GROUP BY actually works", read: "8 min", related: 3 },
    { topic: "Joins, deeply", title: "LEFT JOIN vs LEFT SEMI JOIN", read: "12 min", related: 5 },
    { topic: "Window functions", title: "ROW_NUMBER, RANK, DENSE_RANK", read: "10 min", related: 4 },
    { topic: "Query optimization", title: "Reading EXPLAIN ANALYZE plans", read: "15 min", related: 6 },
  ];
  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 32px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
        <Eyebrow>Learn</Eyebrow>
        <H1>Lessons that ladder into problems</H1>
        <Lede>Read a concept, then jump straight to a problem that exercises it. Every article links to its related practice set.</Lede>
      </div>
      <Eyebrow style={{ marginBottom: 16 }}>Topics</Eyebrow>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 40 }}>
        {topics.map(t => (
          <Card key={t.name} hoverLift>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ height: 40, width: 40, borderRadius: 8, background: `${t.color.replace(")", " / 0.12)")}`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <i data-lucide={t.icon} style={{ width: 20, height: 20, color: t.color }}></i>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: "hsl(220 9% 46%)", fontFamily: "JetBrains Mono" }}>{t.n} articles</div>
            </div>
          </Card>
        ))}
      </div>
      <Eyebrow style={{ marginBottom: 16 }}>Latest articles</Eyebrow>
      <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "1px solid hsl(220 13% 91%)", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
        {articles.map((a, i) => (
          <div key={a.title} style={{ display: "flex", alignItems: "center", padding: "16px 20px", borderTop: i ? "1px solid hsl(220 13% 91%)" : "none", gap: 16 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 11, color: "hsl(220 9% 46%)", fontFamily: "JetBrains Mono" }}>{a.topic}</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{a.title}</div>
            </div>
            <div style={{ fontSize: 12, color: "hsl(220 9% 46%)", fontFamily: "JetBrains Mono" }} className="tabular-nums">{a.read}</div>
            <div style={{ fontSize: 12, color: "hsl(142 71% 45%)", fontFamily: "JetBrains Mono", display: "inline-flex", alignItems: "center", gap: 4 }}><i data-lucide="puzzle" style={{ width: 12, height: 12 }}></i>{a.related} related</div>
            <i data-lucide="arrow-right" style={{ width: 16, height: 16, color: "hsl(220 9% 46%)" }}></i>
          </div>
        ))}
      </div>
    </main>
  );
}

Object.assign(window, { LearnHub });
