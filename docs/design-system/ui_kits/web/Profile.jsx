// /profile — sidebar + stats grid + activity heatmap + solved donut + skills + recent.
function Profile() {
  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 32px 64px", display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
      <ProfileSidebar />
      <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
        <Card padding={20}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            <Stat label="Solved" value="84" sub="/ 240" />
            <Stat label="Submissions" value="312" />
            <Stat label="Acceptance" value="67%" />
            <Stat label="Best streak" value="22" sub="days" />
          </div>
        </Card>

        <Card padding={20}>
          <ActivityHeatmap />
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <Card padding={20}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <i data-lucide="trophy" style={{ width: 14, height: 14, color: "hsl(220 9% 46%)" }}></i>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Solved by difficulty</span>
            </div>
            <SolvedDonut />
          </Card>
          <Card padding={20}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <i data-lucide="sparkles" style={{ width: 14, height: 14, color: "hsl(220 9% 46%)" }}></i>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Skills</span>
            </div>
            <SkillsList />
          </Card>
        </div>

        <Card padding={20}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <i data-lucide="book-open" style={{ width: 14, height: 14, color: "hsl(220 9% 46%)" }}></i>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Recent activity</span>
            </div>
            <span style={{ fontSize: 11, color: "hsl(220 9% 46%)", fontFamily: "JetBrains Mono" }} className="tabular-nums">5 most recent</span>
          </div>
          <RecentActivity />
        </Card>
      </div>
    </main>
  );
}

function ProfileSidebar() {
  return (
    <aside style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 130, alignSelf: "flex-start" }}>
      <Card padding={20}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 6 }}>
          <div style={{ height: 80, width: 80, borderRadius: 9999, background: "hsl(142 71% 45%)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700 }}>AD</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginTop: 8 }}>Ada Devereux</div>
          <div style={{ fontSize: 13, color: "hsl(220 9% 46%)", fontFamily: "JetBrains Mono" }}>@ada.dev</div>
          <div style={{ fontSize: 13, color: "hsl(220 9% 46%)", marginTop: 6, lineHeight: 1.5 }}>Data engineer who would rather write SQL than YAML.</div>
        </div>
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid hsl(220 13% 91%)", display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "hsl(220 9% 46%)" }}><i data-lucide="map-pin" style={{ width: 14, height: 14 }}></i>Berlin, DE</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "hsl(220 9% 46%)" }}><i data-lucide="link" style={{ width: 14, height: 14 }}></i>ada.dev</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "hsl(220 9% 46%)" }}><i data-lucide="github" style={{ width: 14, height: 14 }}></i>ada-d</div>
        </div>
      </Card>
      <Card padding={16}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "hsl(220 9% 46%)" }}>Current streak</span>
          <i data-lucide="flame" style={{ width: 14, height: 14, color: "hsl(32 95% 44%)" }}></i>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 32, fontWeight: 700 }} className="tabular-nums">12</span>
          <span style={{ fontSize: 13, color: "hsl(220 9% 46%)" }}>days · longest 22</span>
        </div>
      </Card>
    </aside>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "hsl(220 9% 46%)" }}>{label}</div>
      <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 26, fontWeight: 600 }} className="tabular-nums">{value}</span>
        {sub && <span style={{ fontSize: 12, color: "hsl(220 9% 46%)", fontFamily: "JetBrains Mono" }} className="tabular-nums">{sub}</span>}
      </div>
    </div>
  );
}

function ActivityHeatmap() {
  // 26 weeks × 7 days
  const weeks = 26, days = 7;
  // pre-compute a deterministic pseudo-random pattern
  const cells = [];
  let seed = 7;
  for (let w = 0; w < weeks; w++) for (let d = 0; d < days; d++) {
    seed = (seed * 9301 + 49297) % 233280;
    const r = seed / 233280;
    const c = r < 0.55 ? 0 : r < 0.7 ? 1 : r < 0.85 ? 2 : r < 0.95 ? 3 : 4;
    cells.push({ w, d, c });
  }
  const colors = ["hsl(220 14% 96%)", "hsl(142 71% 85%)", "hsl(142 71% 65%)", "hsl(142 71% 50%)", "hsl(142 71% 38%)"];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>312 submissions in the last 6 months</div>
          <div style={{ fontSize: 12, color: "hsl(220 9% 46%)" }}>Each square is a day. Greener = more submissions.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "hsl(220 9% 46%)", fontFamily: "JetBrains Mono" }}>
          Less {colors.map((c, i) => <span key={i} style={{ height: 11, width: 11, borderRadius: 2, background: c, border: "1px solid hsl(220 13% 91%)" }}></span>)} More
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${weeks}, 1fr)`, gridAutoFlow: "column", gap: 3 }}>
        {cells.map(({ w, d, c }) => (
          <div key={`${w}-${d}`} style={{ aspectRatio: "1", background: colors[c], borderRadius: 2, gridColumn: w + 1, gridRow: d + 1 }}></div>
        ))}
      </div>
    </div>
  );
}

function SolvedDonut() {
  const data = [
    { label: "Easy", solved: 42, total: 80, color: "hsl(142 71% 45%)" },
    { label: "Medium", solved: 30, total: 110, color: "hsl(32 95% 44%)" },
    { label: "Hard", solved: 12, total: 50, color: "hsl(0 72% 51%)" },
  ];
  // Build conic-gradient segments
  let acc = 0;
  const total = data.reduce((s, d) => s + d.total, 0);
  const segments = data.map(d => {
    const start = acc / total * 100;
    const end = (acc + d.total) / total * 100;
    const solvedEnd = (acc + d.solved) / total * 100;
    acc += d.total;
    return { ...d, start, end, solvedEnd };
  });
  // Layered approach: for simplicity, just one ring showing total mix; numbers tell solved.
  const stops = segments.map(s => `${s.color} ${s.start}% ${s.end}%`).join(", ");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <div style={{ position: "relative", width: 130, height: 130 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `conic-gradient(${stops})` }}></div>
        <div style={{ position: "absolute", inset: 18, borderRadius: "50%", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700 }} className="tabular-nums">84</div>
          <div style={{ fontSize: 11, color: "hsl(220 9% 46%)", marginTop: -2 }}>/ 240 solved</div>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
        {data.map(d => (
          <div key={d.label}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500 }}>
                <span style={{ height: 8, width: 8, borderRadius: 9999, background: d.color }}></span>{d.label}
              </span>
              <span style={{ fontSize: 12, color: "hsl(220 9% 46%)", fontFamily: "JetBrains Mono" }} className="tabular-nums">{d.solved} / {d.total}</span>
            </div>
            <div style={{ height: 6, background: "hsl(220 14% 96%)", borderRadius: 9999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${d.solved / d.total * 100}%`, background: d.color, borderRadius: 9999, transition: "width 500ms ease-out" }}></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkillsList() {
  const skills = [
    { name: "Aggregation", solved: 22, color: "hsl(142 71% 45%)" },
    { name: "Joins", solved: 18, color: "hsl(142 71% 45%)" },
    { name: "Window functions", solved: 9, color: "hsl(32 95% 44%)" },
    { name: "Subqueries", solved: 14, color: "hsl(142 71% 45%)" },
    { name: "Date / time", solved: 7, color: "hsl(32 95% 44%)" },
    { name: "Recursive CTEs", solved: 2, color: "hsl(0 72% 51%)" },
  ];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {skills.map(s => (
        <span key={s.name} style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
          borderRadius: 9999, fontSize: 12, fontWeight: 500,
          background: "hsl(220 14% 96%)", color: "hsl(222 47% 11%)", border: "1px solid hsl(220 13% 91%)",
        }}>
          {s.name}
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: s.color, fontWeight: 600 }} className="tabular-nums">{s.solved}</span>
        </span>
      ))}
    </div>
  );
}

function RecentActivity() {
  const rows = [
    { title: "Top 3 customers by revenue", level: "easy", ok: true, when: "Apr 28" },
    { title: "Rolling 28-day MAU", level: "hard", ok: false, when: "Apr 27" },
    { title: "Validate referential integrity", level: "medium", ok: true, when: "Apr 26" },
    { title: "Find duplicate emails", level: "easy", ok: true, when: "Apr 24" },
    { title: "Cohort retention", level: "hard", ok: false, when: "Apr 22" },
  ];
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {rows.map((r, i) => (
        <li key={i}>
          <a href="#" style={{
            display: "flex", alignItems: "center", gap: 12, padding: "10px 4px",
            borderTop: i ? "1px solid hsl(220 13% 95%)" : "none",
            textDecoration: "none", color: "hsl(222 47% 11%)", fontSize: 13,
          }}>
            <span style={{ height: 6, width: 6, borderRadius: 9999, background: r.ok ? "hsl(142 71% 45%)" : "hsl(0 72% 51%)" }}></span>
            <span style={{ flex: 1, fontWeight: 500 }}>{r.title}</span>
            <DifficultyPill level={r.level} />
            <span style={{ fontSize: 11, color: "hsl(220 9% 46%)", fontFamily: "JetBrains Mono", minWidth: 50, textAlign: "right" }} className="tabular-nums">{r.when}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

Object.assign(window, { Profile });
