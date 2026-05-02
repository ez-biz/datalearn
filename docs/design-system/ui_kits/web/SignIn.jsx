// /signin — auth.js sign-in page (GitHub + email magic link).
function SignIn() {
  return (
    <main style={{ minHeight: "calc(100vh - 64px - 49px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 32, position: "relative", overflow: "hidden" }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at top, hsl(142 71% 45% / 0.08), transparent 60%)", pointerEvents: "none" }}></div>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(hsl(220 13% 91%) 1px, transparent 1px), linear-gradient(90deg, hsl(220 13% 91%) 1px, transparent 1px)", backgroundSize: "48px 48px", maskImage: "radial-gradient(ellipse at center, black, transparent 70%)", WebkitMaskImage: "radial-gradient(ellipse at center, black, transparent 70%)", opacity: 0.4, pointerEvents: "none" }}></div>
      <div style={{ position: "relative", width: 420, maxWidth: "100%", background: "#fff", border: "1px solid hsl(220 13% 91%)", borderRadius: 16, padding: 36, boxShadow: "0 20px 25px -5px hsl(220 13% 20% / 0.10), 0 10px 25px -5px hsl(142 71% 45% / 0.10)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <Logo size={32} />
        </div>
        <H1 style={{ textAlign: "center", fontSize: 22, marginBottom: 8 }}>Welcome back</H1>
        <p style={{ textAlign: "center", fontSize: 14, color: "hsl(220 9% 46%)", margin: 0, marginBottom: 24, lineHeight: 1.55 }}>
          Sign in to track your streak, save submissions, and pick up where you left off.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Button size="lg" variant="secondary" icon="github" style={{ justifyContent: "center" }}>Continue with GitHub</Button>
          <Button size="lg" variant="secondary" icon="chrome" style={{ justifyContent: "center" }}>Continue with Google</Button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0", color: "hsl(220 9% 46%)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
          <span style={{ height: 1, flex: 1, background: "hsl(220 13% 91%)" }}></span>
          or with email
          <span style={{ height: 1, flex: 1, background: "hsl(220 13% 91%)" }}></span>
        </div>
        <form style={{ display: "flex", flexDirection: "column", gap: 12 }} onSubmit={(e)=>e.preventDefault()}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "hsl(220 9% 30%)" }}>Email</span>
            <input type="email" required placeholder="you@company.com" style={{
              font: "400 14px Inter, system-ui", height: 40, padding: "0 12px", borderRadius: 8,
              border: "1px solid hsl(220 13% 82%)", background: "#fff", outline: "none",
            }} />
          </label>
          <Button size="md" icon="mail" style={{ justifyContent: "center", marginTop: 4 }}>Send magic link</Button>
        </form>
        <p style={{ marginTop: 20, fontSize: 12, color: "hsl(220 9% 46%)", textAlign: "center", lineHeight: 1.6 }}>
          By continuing you agree to the <a href="#" style={{ color: "hsl(142 71% 45%)" }}>Terms</a> and <a href="#" style={{ color: "hsl(142 71% 45%)" }}>Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}

Object.assign(window, { SignIn });
