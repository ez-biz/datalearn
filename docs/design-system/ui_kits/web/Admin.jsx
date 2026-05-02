// /admin — content overview + quick actions for staff.
function AdminDashboard() {
  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px 64px" }}>
      <header style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
        <div>
          <Eyebrow>Admin</Eyebrow>
          <H1 style={{ marginTop: 8, fontSize: 32 }}>Content overview</H1>
          <Lede style={{ marginTop: 6, fontSize: 15 }}>Quick actions and at-a-glance stats for staff editors.</Lede>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" icon="settings">Settings</Button>
          <Button icon="plus">New problem</Button>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        {[
          { label: "Topics", value: 38, icon: "book-text", delta: "+2" },
          { label: "Articles", value: 124, icon: "file-text", delta: "+5" },
          { label: "SQL problems", value: 240, icon: "database", delta: "+12" },
          { label: "Pages", value: 6, icon: "file-code", delta: "" },
        ].map(s => (
          <Card key={s.label} padding={18}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "hsl(220 9% 46%)" }}>{s.label}</span>
              <span style={{ height: 28, width: 28, borderRadius: 6, background: "hsl(142 71% 45% / 0.10)", color: "hsl(142 71% 45%)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <i data-lucide={s.icon} style={{ width: 14, height: 14 }}></i>
              </span>
            </div>
            <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 26, fontWeight: 700 }} className="tabular-nums">{s.value}</span>
              {s.delta && <span style={{ fontSize: 12, color: "hsl(142 71% 45%)", fontFamily: "JetBrains Mono" }} className="tabular-nums">{s.delta} this week</span>}
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 20 }}>
        <Card padding={20}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Create a page</div>
            <div style={{ fontSize: 13, color: "hsl(220 9% 46%)", marginTop: 2 }}>Markdown-backed dynamic page. It appears in the navbar once active.</div>
          </div>
          <form style={{ display: "flex", flexDirection: "column", gap: 14 }} onSubmit={(e)=>e.preventDefault()}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Title <span style={{ color: "hsl(0 72% 51%)" }}>*</span></span>
              <input placeholder="About" style={{ font: "400 14px Inter, system-ui", height: 36, padding: "0 12px", borderRadius: 8, border: "1px solid hsl(220 13% 82%)" }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Slug <span style={{ color: "hsl(0 72% 51%)" }}>*</span></span>
              <input placeholder="about" style={{ font: "400 14px JetBrains Mono, monospace", height: 36, padding: "0 12px", borderRadius: 8, border: "1px solid hsl(220 13% 82%)" }} />
              <span style={{ fontSize: 12, color: "hsl(220 9% 46%)" }}>URL path. Lowercase, hyphenated.</span>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Content <span style={{ color: "hsl(0 72% 51%)" }}>*</span></span>
              <textarea rows={8} defaultValue={"# About Data Learn\n\nA short description…"} style={{ font: "400 13px JetBrains Mono, monospace", padding: 12, borderRadius: 8, border: "1px solid hsl(220 13% 82%)", resize: "vertical", lineHeight: 1.55 }} />
              <span style={{ fontSize: 12, color: "hsl(220 9% 46%)" }}>Markdown supported (GFM).</span>
            </label>
            <div><Button>Create page</Button></div>
          </form>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card padding={20}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Pages</span>
              <a href="#" style={{ fontSize: 12, color: "hsl(142 71% 45%)" }}>Manage</a>
            </div>
            {[
              { title: "About", slug: "about", active: true },
              { title: "Pricing", slug: "pricing", active: true },
              { title: "Changelog", slug: "changelog", active: true },
              { title: "Press kit", slug: "press", active: false },
            ].map((p, i) => (
              <div key={p.slug} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderTop: i ? "1px solid hsl(220 13% 91%)" : "none" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: "hsl(220 9% 46%)", fontFamily: "JetBrains Mono" }}>/{p.slug}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 9999, background: p.active ? "hsl(142 71% 45% / 0.10)" : "hsl(220 14% 96%)", color: p.active ? "hsl(142 84% 24%)" : "hsl(220 9% 46%)" }}>{p.active ? "Active" : "Inactive"}</span>
              </div>
            ))}
          </Card>
          <Card padding={20}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Topics & articles</div>
            {[
              { name: "SQL fundamentals", n: 12 },
              { name: "Joins, deeply", n: 8 },
              { name: "Window functions", n: 6 },
              { name: "Query optimization", n: 9 },
              { name: "DuckDB", n: 4 },
            ].map(t => (
              <div key={t.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 13 }}>
                <span>{t.name}</span>
                <span style={{ fontSize: 12, color: "hsl(220 9% 46%)", fontFamily: "JetBrains Mono" }} className="tabular-nums">{t.n}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </main>
  );
}

Object.assign(window, { AdminDashboard });
