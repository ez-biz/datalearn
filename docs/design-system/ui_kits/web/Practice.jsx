// Two-pane workspace: problem description (left) + Monaco-style editor + results (right).
// Mirrors datalearn/app/practice/[slug]/page.tsx + components/sql/* + components/practice/*.

function ProblemPane({ problem }) {
  const [tab, setTab] = useState("description");
  const tabs = [
    { id: "description", label: "Description", icon: "file-text" },
    { id: "schema", label: "Schema", icon: "database" },
    { id: "hints", label: "Hints", icon: "lightbulb" },
    { id: "history", label: "History", icon: "history" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", borderRight: "1px solid hsl(220 13% 91%)", background: "#fff" }}>
      <div style={{ padding: "20px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <DifficultyPill level={problem.level} />
          <span style={{ fontSize: 12, color: "hsl(220 9% 46%)", fontFamily: "JetBrains Mono, ui-monospace" }}>{problem.topic}</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <Tag>SQL</Tag><Tag>JOIN</Tag><Tag>aggregation</Tag>
          </span>
        </div>
        <H1 style={{ fontSize: 22, marginBottom: 14 }}>{problem.title}</H1>
        <div style={{ display: "flex", gap: 2, borderBottom: "1px solid hsl(220 13% 91%)" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "10px 14px", border: "none", background: "transparent", cursor: "pointer",
              fontSize: 13, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6,
              color: tab === t.id ? "hsl(222 47% 11%)" : "hsl(220 9% 46%)",
              borderBottom: tab === t.id ? "2px solid hsl(142 71% 45%)" : "2px solid transparent",
              marginBottom: -1,
            }}>
              <i data-lucide={t.icon} style={{ width: 14, height: 14 }}></i>{t.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
        {tab === "description" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 14, lineHeight: 1.7, color: "hsl(222 47% 16%)" }}>
            <p style={{ margin: 0, textWrap: "pretty" }}>You're given two tables, <code className="code" style={{ fontFamily: "JetBrains Mono", fontSize: 13, padding: "1px 6px", background: "hsl(220 14% 96%)", borderRadius: 4 }}>customers</code> and <code className="code" style={{ fontFamily: "JetBrains Mono", fontSize: 13, padding: "1px 6px", background: "hsl(220 14% 96%)", borderRadius: 4 }}>orders</code>. Return the three customers with the highest total order amount across all time, ordered by total descending.</p>
            <div style={{ borderLeft: "3px solid hsl(142 71% 45%)", padding: "8px 14px", background: "hsl(142 76% 96% / 0.5)", borderRadius: "0 6px 6px 0" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "hsl(142 84% 24%)", marginBottom: 4 }}>Notes</div>
              <div style={{ fontSize: 13, color: "hsl(142 84% 24%)" }}>Ties on total are unlikely; if they happen, break by name ascending.</div>
            </div>
            <Eyebrow style={{ marginTop: 4 }}>Expected output</Eyebrow>
            <ResultTable
              cols={["name", "total"]}
              rows={[["Acme Corp", "$48,200"], ["Globex Ltd", "$32,910"], ["Initech", "$28,440"]]}
              numericCols={[1]}
            />
          </div>
        )}
        {tab === "schema" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { name: "customers", cols: [["customer_id", "INTEGER", "PK"], ["name", "VARCHAR", ""], ["region", "VARCHAR", ""]] },
              { name: "orders", cols: [["order_id", "INTEGER", "PK"], ["customer_id", "INTEGER", "FK"], ["amount", "DECIMAL", ""], ["created_at", "TIMESTAMP", ""]] },
            ].map(t => (
              <Card key={t.name} padding={0}>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid hsl(220 13% 91%)", display: "flex", alignItems: "center", gap: 8, background: "hsl(220 14% 98%)", borderRadius: "12px 12px 0 0" }}>
                  <i data-lucide="table-2" style={{ width: 14, height: 14, color: "hsl(142 71% 45%)" }}></i>
                  <span style={{ fontFamily: "JetBrains Mono", fontSize: 13, fontWeight: 600 }}>{t.name}</span>
                </div>
                {t.cols.map(([col, ty, key]) => (
                  <div key={col} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr auto", padding: "7px 14px", fontFamily: "JetBrains Mono", fontSize: 12, borderTop: "1px solid hsl(220 13% 95%)", alignItems: "center" }}>
                    <span>{col}</span>
                    <span style={{ color: "hsl(220 9% 46%)" }}>{ty}</span>
                    {key && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: key === "PK" ? "hsl(142 71% 45% / 0.12)" : "hsl(32 95% 44% / 0.12)", color: key === "PK" ? "hsl(142 84% 24%)" : "hsl(26 90% 30%)", fontWeight: 600 }}>{key}</span>}
                  </div>
                ))}
              </Card>
            ))}
          </div>
        )}
        {tab === "hints" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3].map(n => (
              <Card key={n} padding={14}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "hsl(220 9% 46%)", display: "inline-flex", alignItems: "center", gap: 8 }}><i data-lucide="lightbulb" style={{ width: 14, height: 14, color: "hsl(32 95% 44%)" }}></i>Hint {n} of 3</span>
                  <Button size="sm" variant="ghost">Reveal</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
        {tab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
            {[
              { ts: "Today, 14:22", verdict: "Accepted", t: "0.04s", color: "hsl(142 84% 24%)", bg: "hsl(142 76% 96%)" },
              { ts: "Today, 14:18", verdict: "Wrong answer", t: "0.05s", color: "hsl(0 70% 35%)", bg: "hsl(0 86% 97%)" },
              { ts: "Yesterday", verdict: "Wrong answer", t: "0.03s", color: "hsl(0 70% 35%)", bg: "hsl(0 86% 97%)" },
            ].map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", padding: "10px 14px", border: "1px solid hsl(220 13% 91%)", borderRadius: 8, gap: 12, fontFamily: "JetBrains Mono" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 9999, background: r.bg, color: r.color, fontSize: 11, fontWeight: 600 }}>{r.verdict}</span>
                <span style={{ fontSize: 12, color: "hsl(220 9% 46%)" }}>{r.ts}</span>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "hsl(220 9% 46%)" }}>{r.t}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CodeEditor({ value, onChange }) {
  const lines = value.split("\n");
  // very lightweight syntax coloring for SQL keywords
  const KW = /\b(SELECT|FROM|JOIN|ON|WHERE|GROUP BY|ORDER BY|LIMIT|AS|DESC|ASC|AND|OR|NOT|NULL|INNER|LEFT|RIGHT|HAVING|WITH|CASE|WHEN|THEN|ELSE|END|IS|IN|EXISTS)\b/g;
  const FN = /\b(SUM|COUNT|AVG|MIN|MAX|COALESCE|CAST|DATE_TRUNC|EXTRACT|NOW|ROW_NUMBER|RANK|OVER|PARTITION)\b/g;
  const COMMENT = /(--.*$)/gm;
  const STRING = /('[^']*')/g;
  const NUMBER = /\b(\d+)\b/g;
  const colored = (line) => {
    let out = line
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(COMMENT, "<span style=\"color:hsl(220 9% 55%)\">$1</span>")
      .replace(STRING, "<span style=\"color:hsl(32 95% 60%)\">$1</span>")
      .replace(KW, "<span style=\"color:hsl(142 71% 60%)\">$1</span>")
      .replace(FN, "<span style=\"color:hsl(280 70% 75%)\">$1</span>")
      .replace(NUMBER, "<span style=\"color:hsl(32 95% 60%)\">$1</span>");
    return out || "&nbsp;";
  };
  return (
    <div style={{ position: "relative", flex: 1, background: "hsl(222 47% 6%)", display: "flex", overflow: "hidden", fontFamily: "JetBrains Mono", fontSize: 13, lineHeight: 1.65 }}>
      <div aria-hidden="true" style={{ padding: "12px 12px 12px 16px", color: "hsl(220 9% 40%)", textAlign: "right", userSelect: "none", borderRight: "1px solid hsl(220 18% 18%)", minWidth: 36 }}>
        {lines.map((_, i) => <div key={i}>{i + 1}</div>)}
      </div>
      <pre style={{ margin: 0, padding: "12px 16px", color: "hsl(210 20% 92%)", flex: 1, overflow: "auto", whiteSpace: "pre-wrap" }}
        dangerouslySetInnerHTML={{ __html: lines.map(colored).join("\n") }}
      />
    </div>
  );
}

function ResultTable({ cols, rows, numericCols = [] }) {
  return (
    <div style={{ border: "1px solid hsl(220 13% 91%)", borderRadius: 8, overflow: "hidden", fontFamily: "JetBrains Mono", fontSize: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols.length}, 1fr)`, background: "hsl(220 14% 96%)", padding: "8px 12px", fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "hsl(220 9% 46%)", borderBottom: "1px solid hsl(220 13% 91%)" }}>
        {cols.map((c, i) => <div key={c} style={{ textAlign: numericCols.includes(i) ? "right" : "left" }}>{c}</div>)}
      </div>
      {rows.map((r, ri) => (
        <div key={ri} style={{ display: "grid", gridTemplateColumns: `repeat(${cols.length}, 1fr)`, padding: "7px 12px", borderTop: ri ? "1px solid hsl(220 13% 95%)" : "none", background: ri % 2 ? "hsl(220 14% 98%)" : "transparent" }}>
          {r.map((v, ci) => (
            <div key={ci} className={numericCols.includes(ci) ? "tabular-nums" : ""} style={{ textAlign: numericCols.includes(ci) ? "right" : "left", fontVariantNumeric: "tabular-nums" }}>{v}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Verdict({ kind, message }) {
  const cfg = kind === "accepted"
    ? { bg: "hsl(142 71% 45% / 0.08)", border: "hsl(142 71% 45% / 0.30)", fg: "hsl(142 84% 24%)", title: "Accepted", icon: "check-circle-2" }
    : { bg: "hsl(0 72% 51% / 0.08)", border: "hsl(0 72% 51% / 0.30)", fg: "hsl(0 70% 35%)", title: "Wrong answer", icon: "x-circle" };
  return (
    <div style={{ display: "flex", gap: 10, padding: "12px 14px", border: `1px solid ${cfg.border}`, background: cfg.bg, borderRadius: 8, alignItems: "flex-start" }}>
      <i data-lucide={cfg.icon} style={{ width: 18, height: 18, color: cfg.fg, flexShrink: 0, marginTop: 1 }}></i>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: cfg.fg }}>{cfg.title}</div>
        <div style={{ fontSize: 12, color: cfg.fg, opacity: 0.85, marginTop: 2 }}>{message}</div>
      </div>
    </div>
  );
}

function WorkspacePane({ problem, code, setCode, verdict, running, onRun, onSubmit }) {
  const [tab, setTab] = useState("results");
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#fff" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid hsl(220 13% 91%)", display: "flex", alignItems: "center", gap: 10, background: "hsl(220 14% 98%)" }}>
        <i data-lucide="file-code" style={{ width: 14, height: 14, color: "hsl(220 9% 46%)" }}></i>
        <span style={{ fontFamily: "JetBrains Mono", fontSize: 12 }}>{problem.slug}.sql</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "hsl(220 9% 46%)", fontFamily: "JetBrains Mono", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ height: 6, width: 6, borderRadius: 9999, background: "hsl(142 71% 45%)" }}></span>
          DuckDB-WASM ready
        </span>
      </div>
      <div style={{ flex: 1, display: "flex", minHeight: 0, flexDirection: "column" }}>
        <div style={{ display: "flex", height: "60%", minHeight: 0 }}>
          <CodeEditor value={code} onChange={setCode} />
        </div>
        <div style={{ borderTop: "1px solid hsl(220 13% 91%)", display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "#fff" }}>
          <Button size="sm" variant="secondary" icon="rotate-ccw">Reset</Button>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Button size="sm" variant="secondary" icon="play" onClick={onRun} kbd="⌘↵">Run</Button>
            <Button size="sm" icon="send" onClick={onSubmit} kbd="⌘⇧↵">Submit</Button>
          </span>
        </div>
        <div style={{ display: "flex", borderTop: "1px solid hsl(220 13% 91%)", borderBottom: "1px solid hsl(220 13% 91%)", background: "hsl(220 14% 98%)" }}>
          {[{ id: "results", l: "Results", i: "table-2" }, { id: "verdict", l: "Verdict", i: "check-circle-2" }, { id: "console", l: "Console", i: "terminal" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "8px 14px", border: "none", background: "transparent", cursor: "pointer",
              fontSize: 12, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6,
              color: tab === t.id ? "hsl(222 47% 11%)" : "hsl(220 9% 46%)",
              borderBottom: tab === t.id ? "2px solid hsl(142 71% 45%)" : "2px solid transparent",
              marginBottom: -1,
            }}>
              <i data-lucide={t.i} style={{ width: 12, height: 12 }}></i>{t.l}
            </button>
          ))}
          <span style={{ marginLeft: "auto", padding: "8px 14px", fontSize: 11, color: "hsl(220 9% 46%)", fontFamily: "JetBrains Mono" }}>
            {running ? "Running query…" : verdict ? "3 rows · 0.04s" : "No results yet."}
          </span>
        </div>
        <div style={{ flex: 1, padding: 16, overflow: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {tab === "results" && (
            running
              ? <div style={{ display: "flex", alignItems: "center", gap: 10, color: "hsl(220 9% 46%)", fontSize: 13 }}><i data-lucide="loader-2" style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }}></i> Running query…</div>
              : verdict
                ? <ResultTable cols={["name", "total"]} rows={[["Acme Corp", "$48,200"], ["Globex Ltd", "$32,910"], ["Initech", "$28,440"]]} numericCols={[1]} />
                : <div style={{ color: "hsl(220 9% 46%)", fontSize: 13 }}>No results yet. Run a query to see output here.</div>
          )}
          {tab === "verdict" && verdict && <Verdict kind={verdict} message={verdict === "accepted" ? "Your output matches the expected result. Beats 78% of submissions." : "Row 2: expected (\"Acme\", 4820), got (\"Acme\", 4280)."} />}
          {tab === "verdict" && !verdict && <div style={{ color: "hsl(220 9% 46%)", fontSize: 13 }}>Submit a query to see the verdict.</div>}
          {tab === "console" && <pre style={{ margin: 0, fontFamily: "JetBrains Mono", fontSize: 12, color: "hsl(220 9% 46%)" }}>[engine] DuckDB-WASM 0.10.0{"\n"}[ready] tables: customers, orders</pre>}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ProblemPane, WorkspacePane, ResultTable, Verdict });
