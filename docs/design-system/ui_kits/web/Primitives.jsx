// Shared primitives for the Data Learn web UI kit.
// Mirrors datalearn/components/ui/* (Button, Badge, Card, Logo, etc.) — cosmetic only.

const { useState, useEffect, useRef, useMemo } = React;

// ── Logo ───────────────────────────────────────────────────────────────
function Logo({ size = 28, withWordmark = true, dark = false, as: Tag = "a", onClick, href = "#" }) {
  const fg = dark ? "#f5f7fa" : "hsl(222 47% 11%)";
  const muted = dark ? "hsl(220 9% 65%)" : "hsl(220 9% 46%)";
  const props = Tag === "a"
    ? { href, onClick, style: { display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", color: fg, fontWeight: 700, fontSize: size > 30 ? 22 : 18, letterSpacing: "-0.01em", cursor: onClick ? "pointer" : undefined } }
    : { onClick, style: { display: "inline-flex", alignItems: "center", gap: 10, color: fg, fontWeight: 700, fontSize: size > 30 ? 22 : 18, letterSpacing: "-0.01em", cursor: onClick ? "pointer" : "inherit", border: "none", background: "transparent", padding: 0, font: "inherit" } };
  return (
    <Tag {...props}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="2" y="2" width="28" height="28" rx="7" fill="hsl(142 71% 45% / 0.10)" stroke="hsl(142 71% 45% / 0.30)" strokeWidth="1.25" />
        <path d="M9 11h5.5c2.485 0 4.5 1.567 4.5 5s-2.015 5-4.5 5H9V11Z" fill="hsl(142 71% 45%)" />
        <rect x="20.5" y="11" width="2.5" height="10" rx="1.25" fill="hsl(142 71% 45%)" />
      </svg>
      {withWordmark && (
        <span>
          <span style={{ color: fg }}>Data</span>
          <span style={{ color: muted, margin: "0 1px" }}>·</span>
          <span style={{ color: "hsl(142 71% 45%)" }}>Learn</span>
        </span>
      )}
    </Tag>
  );
}

// ── Button ─────────────────────────────────────────────────────────────
function Button({ variant = "primary", size = "md", icon, children, kbd, onClick, disabled, style, type = "button" }) {
  const sizes = { sm: { h: 28, px: 10, fs: 12, r: 6 }, md: { h: 36, px: 14, fs: 14, r: 8 }, lg: { h: 44, px: 18, fs: 16, r: 8 } };
  const s = sizes[size];
  const variants = {
    primary: { bg: "hsl(142 71% 45%)", c: "#fff", b: "transparent", hover: "hsl(142 71% 40%)" },
    secondary: { bg: "#fff", c: "hsl(222 47% 11%)", b: "hsl(220 13% 82%)", hover: "hsl(220 14% 96%)" },
    ghost: { bg: "transparent", c: "hsl(222 47% 11%)", b: "transparent", hover: "hsl(220 14% 96%)" },
    destructive: { bg: "hsl(0 72% 51%)", c: "#fff", b: "transparent", hover: "hsl(0 72% 46%)" },
  }[variant];
  const [hov, setHov] = useState(false);
  const [press, setPress] = useState(false);
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => { setHov(false); setPress(false); }}
      onMouseDown={() => setPress(true)} onMouseUp={() => setPress(false)}
      style={{
        font: `600 ${s.fs}px/1 Inter, system-ui`, height: s.h, padding: `0 ${s.px}px`,
        borderRadius: s.r, background: hov && !disabled ? variants.hover : variants.bg,
        color: variants.c, border: `1px solid ${variants.b}`, cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex", alignItems: "center", gap: 8, transition: "background-color 150ms, transform 80ms",
        transform: press ? "scale(0.96)" : "scale(1)", opacity: disabled ? 0.6 : 1,
        boxShadow: variant === "primary" ? "0 1px 2px hsl(220 13% 20% / 0.05)" : "none",
        ...style,
      }}>
      {icon && <i data-lucide={icon} style={{ width: s.fs + 2, height: s.fs + 2 }}></i>}
      {children}
      {kbd && (
        <span style={{ fontFamily: "JetBrains Mono, ui-monospace", fontSize: s.fs - 3, background: variant === "primary" ? "rgb(255 255 255 / 0.18)" : "hsl(220 14% 96%)", padding: "1px 5px", borderRadius: 3, fontWeight: 500 }}>{kbd}</span>
      )}
    </button>
  );
}

// ── Difficulty pill ───────────────────────────────────────────────────
function DifficultyPill({ level }) {
  const map = {
    easy: { bg: "hsl(142 76% 96%)", fg: "hsl(142 84% 24%)", label: "Easy" },
    medium: { bg: "hsl(33 100% 96%)", fg: "hsl(26 90% 30%)", label: "Medium" },
    hard: { bg: "hsl(0 86% 97%)", fg: "hsl(0 70% 35%)", label: "Hard" },
  }[level];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 9999,
      padding: "2px 10px", fontSize: 11, fontWeight: 500, letterSpacing: "0.02em",
      background: map.bg, color: map.fg,
    }}>{map.label}</span>
  );
}

// ── Tag chip ──────────────────────────────────────────────────────────
function Tag({ children }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 500, background: "hsl(220 14% 96%)", color: "hsl(222 47% 30%)", border: "1px solid hsl(220 13% 91%)" }}>{children}</span>;
}

// ── Card ──────────────────────────────────────────────────────────────
function Card({ children, hoverLift, selected, padding = 16, style, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: "#fff",
        border: `${selected ? 2 : 1}px solid ${selected ? "hsl(142 71% 45%)" : (hoverLift && hov ? "hsl(142 71% 45% / 0.4)" : "hsl(220 13% 91%)")}`,
        borderRadius: 12, padding, transition: "all 200ms ease-out",
        boxShadow: selected ? "0 0 0 3px hsl(142 71% 45% / 0.12)" : (hoverLift && hov ? "0 4px 6px -1px hsl(220 13% 20% / 0.08), 0 2px 4px -2px hsl(220 13% 20% / 0.06)" : "none"),
        transform: hoverLift && hov ? "translateY(-2px)" : "translateY(0)",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}>{children}</div>
  );
}

// ── Eyebrow / heading helpers ─────────────────────────────────────────
const Eyebrow = ({ children, style }) => <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "hsl(220 9% 46%)", ...style }}>{children}</div>;
const H1 = ({ children, style }) => <h1 style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.01em", margin: 0, textWrap: "balance", ...style }}>{children}</h1>;
const H2 = ({ children, style }) => <h2 style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.01em", margin: 0, textWrap: "balance", ...style }}>{children}</h2>;
const Lede = ({ children, style }) => <p style={{ fontSize: 18, lineHeight: 1.6, color: "hsl(220 9% 46%)", margin: 0, textWrap: "pretty", ...style }}>{children}</p>;

// ── Kbd ───────────────────────────────────────────────────────────────
const Kbd = ({ children }) => <kbd style={{ fontFamily: "JetBrains Mono, ui-monospace", fontSize: 11, border: "1px solid hsl(220 13% 91%)", background: "#fff", padding: "1px 6px", borderRadius: 4, color: "hsl(220 9% 46%)" }}>{children}</kbd>;

Object.assign(window, { Logo, Button, DifficultyPill, Tag, Card, Eyebrow, H1, H2, Lede, Kbd });
