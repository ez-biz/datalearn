# 🚀 Antigravity Data Learning Platform — Long-Term Roadmap

> **Last updated:** 2026-02-16  
> **Status:** Active Development  
> **Version:** 0.1.0 (Beta)

---

## Vision Statement

Build the **go-to open platform** for data engineering education — combining interactive SQL challenges, curated learning content, live collaboration tools, and system design practice into a single, beautifully designed experience. Zero setup required.

---

## Current State Summary

| Area | Status | Notes |
|------|--------|-------|
| Authentication (GitHub / Google) | ✅ Done | NextAuth 5 beta with Prisma adapter |
| Learning Hub (Topics → Articles) | ✅ Done | Markdown rendering with syntax highlighting |
| SQL Question Bank | ✅ Done | 3 seeded problems (Easy / Medium / Hard) |
| SQL Playground (DuckDB-WASM) | ✅ Done | Monaco Editor + browser-side execution |
| Admin Panel (Page CRUD) | ✅ Done | Basic page creation, stats cards |
| Dynamic Navigation (DB-driven) | ✅ Done | Navbar fetches pages from DB |
| News Aggregator (RSS) | ✅ Done | Data Engineering Weekly feed |
| User Profile Page | ✅ Done | Shows session data |
| Testing | ❌ None | No tests exist yet |
| CI/CD | ❌ None | No GitHub Actions or deployment pipeline |

---

## Phase Roadmap

### 🟩 Phase 1 — Content Core (MVP) `CURRENT — 90% Complete`

**Goal:** Establish the learning repository and user access.

| Task | Status | Priority |
|------|--------|----------|
| Auth (GitHub + Google OAuth) | ✅ Done | P0 |
| User profile management | ✅ Done | P0 |
| Blog / Learning Hub (Topic-wise) | ✅ Done | P0 |
| Markdown rendering with code snippets | ✅ Done | P0 |
| SQL Question Bank (list + detail views) | ✅ Done | P0 |
| Admin Panel v1 (CRUD for pages) | ✅ Done | P1 |
| **Admin Panel: CRUD for Topics** | ⬜ Todo | P1 |
| **Admin Panel: CRUD for Articles** | ⬜ Todo | P1 |
| **Admin Panel: CRUD for SQL Problems** | ⬜ Todo | P1 |
| **Progress tracking (saved articles, solved problems)** | ⬜ Todo | P2 |
| **UI/UX polish — design system, dark mode** | ⬜ Todo | P2 |
| **Seed more Topics & Articles** | ⬜ Todo | P2 |

---

### 🟨 Phase 2 — Interactive Engine `IN PROGRESS — 40% Complete`

**Goal:** Enable users to run code and test skills interactively.

| Task | Status | Priority |
|------|--------|----------|
| Browser SQL Engine (DuckDB-WASM) | ✅ Done | P0 |
| Monaco Editor integration | ✅ Done | P0 |
| News Aggregator (RSS feed) | ✅ Done | P1 |
| Dynamic Navigation from Admin | ✅ Done | P1 |
| **Query validation — compare against expected output** | ⬜ Todo | P0 |
| **Multiple RSS feed sources (admin-managed)** | ⬜ Todo | P1 |
| **Hint system for SQL problems** | ⬜ Todo | P2 |
| **Solution reveal / editorial** | ⬜ Todo | P2 |
| **Execution history / save user queries** | ⬜ Todo | P2 |
| **Python code playground (Pyodide)** | ⬜ Todo | P3 |
| **Admin Panel v2: News source management** | ⬜ Todo | P2 |

---

### 🟥 Phase 3 — Collaboration & Community `NOT STARTED`

**Goal:** Real-time features for interview prep and system design.

| Task | Status | Priority |
|------|--------|----------|
| **Interview Prep: Peer-to-peer coding** | ⬜ Todo | P1 |
| **Shared code editor (WebSocket/Socket.io)** | ⬜ Todo | P1 |
| **System Design Whiteboard (Excalidraw-based)** | ⬜ Todo | P1 |
| **Real-time cursor & presence** | ⬜ Todo | P2 |
| **Room creation & management** | ⬜ Todo | P1 |
| **Component library for system design** | ⬜ Todo | P2 |

---

### 🟦 Phase 4 — Platform Maturity `PLANNED`

**Goal:** Production readiness, community features, and analytics.

| Task | Status | Priority |
|------|--------|----------|
| **Testing suite (unit + integration + E2E)** | ⬜ Todo | P0 |
| **CI/CD pipeline (GitHub Actions)** | ⬜ Todo | P0 |
| **Vercel deployment with preview environments** | ⬜ Todo | P0 |
| **User analytics dashboard (admin)** | ⬜ Todo | P1 |
| **Content moderation tools** | ⬜ Todo | P2 |
| **Leaderboard / gamification** | ⬜ Todo | P3 |
| **Community forums / discussions** | ⬜ Todo | P3 |
| **SEO optimization** | ⬜ Todo | P1 |
| **Performance monitoring (Sentry/Vercel Analytics)** | ⬜ Todo | P2 |
| **Accessibility audit (WCAG 2.1 AA)** | ⬜ Todo | P2 |
| **Mobile responsiveness audit** | ⬜ Todo | P1 |

---

## Quarterly Goals (2026)

### Q1 2026 (Jan–Mar)
- ✅ Project bootstrapped, Phase 1 MVP implemented
- 🔲 Complete Phase 1 remaining (Admin CRUD, progress tracking)
- 🔲 Query validation for SQL playground
- 🔲 Testing infrastructure + CI/CD
- 🔲 Deploy to Vercel (production)

### Q2 2026 (Apr–Jun)
- 🔲 Complete Phase 2 (hints, solutions, multi-feed news)
- 🔲 UI/UX overhaul — design system, animations, dark mode
- 🔲 Begin Phase 3 — real-time collaboration (Socket.io)
- 🔲 Seed 50+ SQL problems across 5 difficulty tiers

### Q3 2026 (Jul–Sep)
- 🔲 Complete Phase 3 — system design whiteboard
- 🔲 Python playground (Pyodide)
- 🔲 User analytics + content moderation

### Q4 2026 (Oct–Dec)
- 🔲 Phase 4 — production maturity
- 🔲 Leaderboard, gamification, community features
- 🔲 Performance, SEO, accessibility audits

---

## Tech Stack Evolution

| Layer | Current | Planned Evolution |
|-------|---------|-------------------|
| Framework | Next.js 16 (App Router) | Stay current with Next.js releases |
| Styling | Tailwind CSS 4 | Add design system (CSS variables + components) |
| Database | PostgreSQL + Prisma 7 | Add Redis for sessions/caching |
| SQL Engine | DuckDB-WASM (client-side) | Consider server-side PostgreSQL sandbox |
| Auth | NextAuth 5 beta | Upgrade to stable release when available |
| Real-time | — | Socket.io / Liveblocks / PartyKit |
| Whiteboard | — | Excalidraw or tldraw |
| Python | — | Pyodide (WASM) |
| Testing | — | Vitest + Playwright |
| CI/CD | — | GitHub Actions |
| Hosting | — | Vercel (frontend) + Railway/Supabase (DB) |

---

## Key Metrics to Track

1. **Content volume:** Number of topics, articles, SQL problems
2. **User engagement:** Active users, problems solved, articles read
3. **Platform quality:** Test coverage, build time, Lighthouse score
4. **SEO:** Organic traffic, Core Web Vitals
5. **Collaboration:** Rooms created, collaborative sessions count
