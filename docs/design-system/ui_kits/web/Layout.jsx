// Top navigation bar — mirrors datalearn/components/layout/Navbar.tsx
// Now navigation-aware: pass `onNavigate(screen)` and the auth state.
function Navbar({ active = "practice", authed = true, streak = 12, onNavigate, onAvatarClick, menuOpen, onMenuItem }) {
  const items = [
    { id: "practice", label: "Practice" },
    { id: "learn", label: "Learn" },
    { id: "datasets", label: "Datasets" },
    { id: "pricing", label: "Pricing" },
  ];
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 40,
      background: "hsl(0 0% 100% / 0.85)", backdropFilter: "blur(12px)",
      borderBottom: "1px solid hsl(220 13% 91%)",
    }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", height: 64, padding: "0 32px", display: "flex", alignItems: "center", gap: 24 }}>
        <Logo as="button" onClick={() => onNavigate && onNavigate("home")} />
        <nav style={{ display: "flex", gap: 4, marginLeft: 16 }}>
          {items.map(it => (
            <a key={it.id} href="#" onClick={(e) => { e.preventDefault(); onNavigate && onNavigate(it.id); }} style={{
              padding: "6px 12px", borderRadius: 8, fontSize: 14, fontWeight: 500,
              textDecoration: "none",
              color: it.id === active ? "hsl(222 47% 11%)" : "hsl(220 9% 46%)",
              background: it.id === active ? "hsl(220 14% 96%)" : "transparent",
              transition: "color 150ms",
            }}>{it.label}</a>
          ))}
        </nav>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
          {authed && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "JetBrains Mono, ui-monospace", fontSize: 12, color: "hsl(220 9% 46%)" }}>
              <i data-lucide="flame" style={{ width: 14, height: 14, color: "hsl(32 95% 44%)" }}></i>
              <span>{streak} day streak</span>
            </div>
          )}
          <button style={{ width: 36, height: 36, borderRadius: 8, background: "transparent", border: "1px solid hsl(220 13% 91%)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} aria-label="Toggle theme">
            <i data-lucide="moon" style={{ width: 16, height: 16, color: "hsl(220 9% 46%)" }}></i>
          </button>
          {authed ? (
            <div style={{ position: "relative" }}>
              <button onClick={onAvatarClick} aria-label="Account" style={{
                height: 32, width: 32, borderRadius: 9999, background: "hsl(142 71% 45%)", color: "#fff",
                border: menuOpen ? "2px solid hsl(142 71% 30%)" : "2px solid transparent",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0,
              }}>AD</button>
              {menuOpen && <AvatarMenu onItem={onMenuItem} />}
            </div>
          ) : (
            <Button size="sm" onClick={() => onNavigate && onNavigate("signin")}>Sign in</Button>
          )}
        </div>
      </div>
    </header>
  );
}

function AvatarMenu({ onItem }) {
  const items = [
    { id: "profile", label: "Your profile", icon: "user" },
    { id: "submissions", label: "Submissions", icon: "history" },
    { id: "settings", label: "Settings", icon: "settings" },
    { divider: true },
    { id: "admin", label: "Admin", icon: "shield", staff: true },
    { divider: true },
    { id: "signout", label: "Sign out", icon: "log-out" },
  ];
  return (
    <div role="menu" style={{
      position: "absolute", right: 0, top: "calc(100% + 8px)", minWidth: 220,
      background: "#fff", border: "1px solid hsl(220 13% 91%)", borderRadius: 10,
      boxShadow: "0 10px 25px -5px hsl(220 13% 20% / 0.15), 0 4px 10px hsl(220 13% 20% / 0.05)",
      padding: 6, zIndex: 50,
    }}>
      <div style={{ padding: "8px 10px 10px" }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Ada Devereux</div>
        <div style={{ fontSize: 12, color: "hsl(220 9% 46%)", fontFamily: "JetBrains Mono" }}>ada@datalearn.dev</div>
      </div>
      {items.map((it, i) => it.divider ? (
        <div key={i} style={{ height: 1, background: "hsl(220 13% 91%)", margin: "4px 0" }}></div>
      ) : (
        <button key={it.id} role="menuitem" onClick={() => onItem && onItem(it.id)} style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%",
          padding: "8px 10px", borderRadius: 6, border: "none", background: "transparent",
          fontSize: 13, color: "hsl(222 47% 11%)", cursor: "pointer", textAlign: "left",
        }}
          onMouseEnter={(e) => e.currentTarget.style.background = "hsl(220 14% 96%)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
          <i data-lucide={it.icon} style={{ width: 14, height: 14, color: it.staff ? "hsl(32 95% 44%)" : "hsl(220 9% 46%)" }}></i>
          <span style={{ flex: 1 }}>{it.label}</span>
          {it.staff && <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "hsl(32 95% 44%)", background: "hsl(32 95% 44% / 0.10)", padding: "2px 6px", borderRadius: 4 }}>Staff</span>}
        </button>
      ))}
    </div>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: "1px solid hsl(220 13% 91%)", padding: "32px 0", marginTop: 64 }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <Logo size={24} />
        <div style={{ display: "flex", gap: 24, fontSize: 13, color: "hsl(220 9% 46%)" }}>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Docs</a>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Privacy</a>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>Terms</a>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>GitHub</a>
        </div>
        <div style={{ fontSize: 12, color: "hsl(220 9% 46%)", fontFamily: "JetBrains Mono, ui-monospace" }}>© 2026 Data·Learn</div>
      </div>
    </footer>
  );
}

Object.assign(window, { Navbar, AvatarMenu, Footer });
