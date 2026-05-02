// Marketing homepage hero + featured problems section.
// Mirrors datalearn/app/page.tsx structure (eyebrow → headline → lede → CTAs → editor preview → featured grid).

function HeroSection() {
  return (
    <section style={{ position: "relative", padding: "80px 0 64px", overflow: "hidden" }}>
      {/* radial gradient halo + grid mask — only on hero */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at top, hsl(142 71% 45% / 0.08), transparent 60%)", pointerEvents: "none" }}></div>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(hsl(220 13% 91%) 1px, transparent 1px), linear-gradient(90deg, hsl(220 13% 91%) 1px, transparent 1px)", backgroundSize: "48px 48px", maskImage: "radial-gradient(ellipse at center, black, transparent 70%)", WebkitMaskImage: "radial-gradient(ellipse at center, black, transparent 70%)", opacity: 0.4, pointerEvents: "none" }}></div>

      <div style={{ position: "relative", maxWidth: 1280, margin: "0 auto", padding: "0 32px", display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 64, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <Eyebrow>SQL practice that respects your time</Eyebrow>
          <h1 style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.02em", margin: 0, textWrap: "balance" }}>
            Practice SQL the way <span style={{ color: "hsl(142 71% 45%)" }}>engineers do.</span>
          </h1>
          <Lede>
            Real problems. Real schemas. A real database in your browser. DuckDB-WASM runs your queries client-side — zero round-trips, zero waiting.
          </Lede>
          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            <Button size="lg" icon="play">Start solving</Button>
            <Button size="lg" variant="secondary" icon="book-open">Browse lessons</Button>
          </div>
          <div style={{ display: "flex", gap: 28, marginTop: 14, fontSize: 13, color: "hsl(220 9% 46%)" }}>
            <span><b style={{ color: "hsl(222 47% 11%)" }} className="tabular-nums">240+</b> problems</span>
            <span><b style={{ color: "hsl(222 47% 11%)" }} className="tabular-nums">38</b> topics</span>
            <span><b style={{ color: "hsl(222 47% 11%)" }} className="tabular-nums">12k</b> learners</span>
          </div>
        </div>
        <EditorPreviewCard />
      </div>
    </section>
  );
}

function EditorPreviewCard() {
  return (
    <div style={{ position: "relative" }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: -24, background: "linear-gradient(135deg, hsl(142 71% 45% / 0.18), transparent 50%, hsl(32 95% 44% / 0.12))", filter: "blur(40px)", borderRadius: 24, pointerEvents: "none" }}></div>
      <div style={{ position: "relative", background: "hsl(222 47% 6%)", borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 25px -5px hsl(220 13% 20% / 0.10), 0 10px 25px -5px hsl(142 71% 45% / 0.15)", border: "1px solid hsl(220 18% 18%)" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid hsl(220 18% 18%)", gap: 8 }}>
          <span style={{ height: 11, width: 11, borderRadius: 9999, background: "hsl(0 72% 60%)" }}></span>
          <span style={{ height: 11, width: 11, borderRadius: 9999, background: "hsl(38 92% 55%)" }}></span>
          <span style={{ height: 11, width: 11, borderRadius: 9999, background: "hsl(142 71% 50%)" }}></span>
          <span style={{ marginLeft: 12, fontFamily: "JetBrains Mono, ui-monospace", fontSize: 12, color: "hsl(220 9% 65%)" }}>top_customers.sql</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "hsl(220 9% 65%)", fontFamily: "JetBrains Mono, ui-monospace" }}>DuckDB-WASM</span>
        </div>
        <pre style={{ margin: 0, padding: "18px 20px", fontFamily: "JetBrains Mono, ui-monospace", fontSize: 13, lineHeight: 1.65, color: "hsl(210 20% 92%)" }}><span style={{ color: "hsl(220 9% 55%)" }}>-- Top 3 customers by lifetime revenue</span>
{"\n"}<span style={{ color: "hsl(142 71% 60%)" }}>SELECT</span> c.name,
{"\n"}       <span style={{ color: "hsl(32 95% 60%)" }}>SUM</span>(o.amount) <span style={{ color: "hsl(142 71% 60%)" }}>AS</span> total
{"\n"}<span style={{ color: "hsl(142 71% 60%)" }}>FROM</span> customers c
{"\n"}<span style={{ color: "hsl(142 71% 60%)" }}>JOIN</span> orders o <span style={{ color: "hsl(142 71% 60%)" }}>ON</span> o.customer_id = c.customer_id
{"\n"}<span style={{ color: "hsl(142 71% 60%)" }}>GROUP BY</span> c.name
{"\n"}<span style={{ color: "hsl(142 71% 60%)" }}>ORDER BY</span> total <span style={{ color: "hsl(142 71% 60%)" }}>DESC</span>
{"\n"}<span style={{ color: "hsl(142 71% 60%)" }}>LIMIT</span> <span style={{ color: "hsl(32 95% 60%)" }}>3</span>;</pre>
        <div style={{ padding: "10px 16px", borderTop: "1px solid hsl(220 18% 18%)", display: "flex", alignItems: "center", gap: 10, background: "hsl(220 27% 9%)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 9999, background: "hsl(142 71% 45% / 0.15)", color: "hsl(142 71% 70%)", fontSize: 11, fontWeight: 600 }}>
            <span style={{ height: 6, width: 6, borderRadius: 9999, background: "hsl(142 71% 50%)" }}></span>Accepted
          </span>
          <span style={{ fontFamily: "JetBrains Mono, ui-monospace", fontSize: 11, color: "hsl(220 9% 65%)" }}>3 rows · 0.04s</span>
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "JetBrains Mono, ui-monospace", fontSize: 11, color: "hsl(220 9% 65%)" }}>
            <kbd style={{ border: "1px solid hsl(220 18% 22%)", padding: "1px 5px", borderRadius: 3 }}>⌘</kbd>
            <kbd style={{ border: "1px solid hsl(220 18% 22%)", padding: "1px 5px", borderRadius: 3 }}>↵</kbd>
            Run
          </span>
        </div>
      </div>
    </div>
  );
}

function FeaturedProblems({ onOpen }) {
  const problems = [
    { slug: "top-customers", title: "Top 3 customers by revenue", level: "easy", topic: "Aggregation", tables: ["customers", "orders"], desc: "Sum order amounts per customer; return top 3 by total." },
    { slug: "active-accounts", title: "Active accounts in last 30 days", level: "medium", topic: "Filtering", tables: ["accounts", "events"], desc: "Filter to accounts that performed any event in the last 30 days." },
    { slug: "cohort-retention", title: "Weekly cohort retention", level: "hard", topic: "Window functions", tables: ["users", "sessions"], desc: "Compute weekly retention curves grouped by signup cohort." },
    { slug: "schema-validate", title: "Validate referential integrity", level: "medium", topic: "Joins", tables: ["orders", "customers"], desc: "Find orders whose customer_id is missing from the customers table." },
    { slug: "duplicate-emails", title: "Find duplicate emails", level: "easy", topic: "Group by", tables: ["users"], desc: "Return emails that appear more than once, sorted by count desc." },
    { slug: "rolling-mau", title: "Rolling 28-day MAU", level: "hard", topic: "Window functions", tables: ["events"], desc: "For each day, compute the rolling 28-day count of distinct active users." },
  ];
  return (
    <section style={{ padding: "32px 0 64px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Eyebrow>Featured</Eyebrow>
            <H2>Hand-picked problems to start with</H2>
          </div>
          <a href="#" style={{ fontSize: 14, color: "hsl(142 71% 45%)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>Browse all problems <i data-lucide="arrow-right" style={{ width: 14, height: 14 }}></i></a>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {problems.map(p => (
            <Card key={p.slug} hoverLift onClick={() => onOpen?.(p)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <DifficultyPill level={p.level} />
                <span style={{ fontSize: 11, color: "hsl(220 9% 46%)", fontFamily: "JetBrains Mono, ui-monospace" }}>{p.topic}</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, lineHeight: 1.3 }}>{p.title}</div>
              <div style={{ fontSize: 13, color: "hsl(220 9% 46%)", lineHeight: 1.55, marginBottom: 12 }}>{p.desc}</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", fontFamily: "JetBrains Mono, ui-monospace", fontSize: 11, color: "hsl(220 9% 46%)" }}>
                <i data-lucide="table-2" style={{ width: 12, height: 12 }}></i>
                {p.tables.join(" · ")}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { HeroSection, FeaturedProblems });
