# 📐 Antigravity Data Learning Platform — Technical Design Document

> **Version:** 1.0  
> **Last updated:** 2026-02-16  
> **Author:** Anchit Gupta

---

## 1. System Overview

The Antigravity Data Learning Platform is a full-stack web application for data engineering education. It provides interactive SQL challenges, curated learning content, real-time collaboration tools, and system design practice — all within a browser, with no external setup required.

### High-Level Architecture

```mermaid
graph TB
    subgraph Client["🌐 Browser"]
        UI[Next.js App Router<br/>React 19 + Tailwind CSS 4]
        DuckDB[DuckDB-WASM<br/>In-Browser SQL Engine]
        Monaco[Monaco Editor<br/>Code Editor]
    end

    subgraph Server["⚡ Next.js Server"]
        RSC[React Server Components]
        SA[Server Actions]
        Auth[NextAuth 5<br/>GitHub / Google]
        API[API Routes]
    end

    subgraph Data["🗄️ Data Layer"]
        PG[(PostgreSQL)]
        Prisma[Prisma ORM 7]
        RSS[RSS Feeds<br/>External APIs]
    end

    UI --> RSC
    UI --> SA
    UI --> DuckDB
    UI --> Monaco
    RSC --> Prisma
    SA --> Prisma
    SA --> Auth
    Prisma --> PG
    RSC --> RSS
```

---

## 2. Technology Stack

### Core Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | Next.js | 16.1.1 | Full-stack React framework (App Router) |
| **UI Library** | React | 19.2.3 | Component library |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS framework |
| **Language** | TypeScript | 5.x | Type-safe JavaScript |
| **ORM** | Prisma | 7.2.0 | Database access with type safety |
| **Database** | PostgreSQL | — | Primary data store |
| **Auth** | NextAuth | 5.0.0-beta.30 | Authentication (GitHub & Google OAuth) |
| **SQL Engine** | DuckDB-WASM | 1.33.1-dev16.0 | Client-side SQL execution |
| **Code Editor** | Monaco Editor | 4.7.0 | In-browser code editing |
| **Markdown** | react-markdown + remark-gfm | 10.1.0 | Markdown rendering |
| **Syntax** | react-syntax-highlighter | 16.1.0 | Code syntax highlighting |
| **Validation** | Zod | 4.3.5 | Runtime schema validation |
| **Icons** | Lucide React | 0.562.0 | Icon library |

### DevDependencies

| Tool | Purpose |
|------|---------|
| Prettier + tailwindcss plugin | Code formatting |
| ESLint + Next.js config | Linting |
| PostCSS | CSS processing |

---

## 3. Application Architecture

### 3.1 Directory Structure

```
datalearn/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx                # Root layout (Navbar, fonts)
│   ├── page.tsx                  # Homepage (hero + news feed)
│   ├── globals.css               # Global styles
│   ├── [slug]/page.tsx           # Dynamic CMS pages
│   ├── admin/page.tsx            # Admin dashboard
│   ├── api/auth/[...nextauth]/   # NextAuth API route
│   ├── learn/
│   │   ├── page.tsx              # Topics listing
│   │   └── [topicSlug]/
│   │       ├── page.tsx          # Articles listing for topic
│   │       └── [articleSlug]/page.tsx  # Article detail (Markdown)
│   ├── practice/
│   │   ├── page.tsx              # SQL problems listing
│   │   └── [slug]/page.tsx       # Problem workspace (editor)
│   └── profile/page.tsx          # User profile
├── actions/                      # Server Actions
│   ├── admin.ts                  # Page CRUD
│   ├── content.ts                # Topics & Articles queries
│   ├── nav.ts                    # Dynamic navigation
│   ├── news.ts                   # RSS feed fetching
│   └── problems.ts               # SQL Problems queries
├── components/
│   ├── layout/Navbar.tsx         # Dynamic navbar (server component)
│   ├── NewsFeed.tsx              # RSS news feed (server component)
│   └── sql/
│       ├── SqlPlayground.tsx     # DuckDB-WASM + query execution
│       ├── SqlEditor.tsx         # Monaco Editor wrapper
│       ├── ResultTable.tsx       # Query results display
│       └── ProblemWorkspace.tsx  # SSR-safe dynamic import wrapper
├── lib/
│   ├── auth.ts                   # NextAuth configuration
│   ├── prisma.ts                 # Prisma client singleton
│   ├── duckdb.ts                 # DuckDB-WASM initialization
│   ├── seed-data.ts              # E-commerce schema for problems
│   └── utils.ts                  # Utility (cn helper)
├── prisma/
│   ├── schema.prisma             # Database schema
│   ├── seed.ts                   # Database seeding script
│   └── migrations/               # Prisma migrations
├── hooks/                        # Custom React hooks (empty)
├── types/                        # TypeScript types (empty)
└── public/                       # Static assets (SVGs)
```

### 3.2 Data Flow Patterns

#### Server Components (RSC) Pattern
Most pages use React Server Components for data fetching. The flow is:

```
Browser Request → Server Component → Server Action → Prisma → PostgreSQL → RSC Render → HTML to Client
```

**Used in:** `/learn`, `/practice`, `/admin`, `/profile`, `Navbar`, `NewsFeed`

#### Client Component Pattern (SQL Playground)
The SQL playground must run in the browser due to DuckDB-WASM:

```
Browser → ProblemWorkspace (dynamic import, ssr:false) → SqlPlayground (client) → DuckDB-WASM (WASM worker)
```

**Key:** `ProblemWorkspace` uses `next/dynamic` with `ssr: false` to prevent server-side rendering of WASM-dependent code.

---

## 4. Database Schema

### Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ Account : has
    User ||--o{ Session : has
    Topic ||--o{ Article : contains

    User {
        string id PK
        string name
        string email UK
        datetime emailVerified
        string image
        UserRole role
        datetime createdAt
        datetime updatedAt
    }

    Account {
        string id PK
        string userId FK
        string type
        string provider
        string providerAccountId
        string refresh_token
        string access_token
        int expires_at
        string token_type
        string scope
        string id_token
        string session_state
    }

    Session {
        string id PK
        string sessionToken UK
        string userId FK
        datetime expires
    }

    VerificationToken {
        string identifier
        string token UK
        datetime expires
    }

    Topic {
        string id PK
        string name UK
        string slug UK
        string description
        datetime createdAt
        datetime updatedAt
    }

    Article {
        string id PK
        string title
        string slug UK
        text content
        boolean published
        string topicId FK
        string authorId
        datetime createdAt
        datetime updatedAt
    }

    SQLProblem {
        string id PK
        string title
        string slug UK
        Difficulty difficulty
        text description
        text schemaDescription
        text sqlSchema
        text expectedOutput
        datetime createdAt
        datetime updatedAt
    }

    Page {
        string id PK
        string title
        string slug UK
        text content
        boolean isActive
        string contentType
        datetime createdAt
        datetime updatedAt
    }
```

### Enums

| Enum | Values |
|------|--------|
| `UserRole` | `USER`, `ADMIN` |
| `Difficulty` | `EASY`, `MEDIUM`, `HARD` |

### Key Design Decisions

1. **CUID for IDs:** All models use `@default(cuid())` for globally unique, sortable IDs
2. **Slug-based routing:** All content models have unique `slug` fields for SEO-friendly URLs
3. **Driver Adapters:** Prisma uses `driverAdapters` preview feature with `@prisma/adapter-pg` for direct PostgreSQL Pool connections
4. **No `url` in datasource:** Database URL is provided via `pg` Pool, not `datasource.url`
5. **Soft-delete for Pages:** Pages use `isActive` boolean instead of hard delete

---

## 5. Authentication System

### Configuration

```typescript
// lib/auth.ts
NextAuth({
    adapter: PrismaAdapter(prisma),
    providers: [GitHub, Google],
    callbacks: {
        session({ session, user }) {
            session.user.role = user.role  // Injects role into session
            session.user.id = user.id
        }
    }
})
```

### Auth Flow

```mermaid
sequenceDiagram
    participant U as User
    participant A as App
    participant NA as NextAuth
    participant P as Provider (GitHub/Google)
    participant DB as PostgreSQL

    U->>A: Click "Sign In"
    A->>NA: Redirect to /api/auth/signin
    NA->>P: OAuth redirect
    P->>NA: Callback with token
    NA->>DB: Create/link Account + Session
    NA->>A: Set session cookie
    A->>U: Redirect to app (authenticated)
```

### Role-Based Access

| Role | Permissions |
|------|-------------|
| `USER` | View content, practice SQL, view profile |
| `ADMIN` | All USER permissions + Admin dashboard, page CRUD |

### Protection Patterns

- **Server-side (pages):** `const session = await auth()` → check `session.user.role`
- **Server Actions:** Same auth check at the start of each action function
- **Navbar:** Conditional rendering based on session and role

---

## 6. SQL Execution Engine

### Architecture

The SQL engine runs entirely in the browser using **DuckDB-WASM** (WebAssembly):

```mermaid
graph LR
    A[User writes SQL] --> B[Monaco Editor]
    B --> C[SqlPlayground.handleRun]
    C --> D[DuckDB Connection.query]
    D --> E[Apache Arrow Table]
    E --> F[toArray + toJSON]
    F --> G[ResultTable renders rows]
```

### Key Technical Details

1. **WASM Loading:** Bundle fetched from jsDelivr CDN → Web Worker created via `Blob` URL
2. **Connection lifecycle:** Single connection created on component mount, stored in `useRef`
3. **Schema seeding:** Problem schemas (`CREATE TABLE` + `INSERT`) executed on connection init
4. **Arrow ↔ JSON:** DuckDB returns Apache Arrow tables; converted to JSON arrays for rendering
5. **SSR avoidance:** `ProblemWorkspace` uses `next/dynamic` with `ssr: false`

### Limitations

- Client-side only — no persistent state between page navigations
- DuckDB SQL dialect (close to PostgreSQL but not identical)
- Large datasets may impact browser performance
- No query timeout mechanism

---

## 7. Content Management System

### Content Types

| Type | Storage | Rendering |
|------|---------|-----------|
| Articles | PostgreSQL (markdown text) | `react-markdown` + `remark-gfm` + `react-syntax-highlighter` |
| SQL Problems | PostgreSQL (schema + expected output) | Custom components |
| Dynamic Pages | PostgreSQL (markdown text) | `react-markdown` + `remark-gfm` |
| News | External RSS feeds (runtime) | Server component on homepage |

### Admin Capabilities (Current)

- Create pages (title, slug, markdown content)
- View statistics (topic count, problem count)
- View existing pages + active status
- View content overview (topics with article counts)

### Admin Gaps (To Build)

- Edit/delete pages
- CRUD for Topics, Articles, SQL Problems
- Manage news feed sources
- User management and moderation
- Content preview before publishing

---

## 8. Future Architecture Considerations

### 8.1 Real-Time Collaboration (Phase 3)

```mermaid
graph TB
    subgraph Clients["Connected Users"]
        U1[User A<br/>Browser]
        U2[User B<br/>Browser]
    end

    subgraph Server["Collaboration Server"]
        WS[WebSocket Server<br/>Socket.io]
        CRDT[CRDT / OT<br/>Conflict Resolution]
        Rooms[Room Manager]
    end

    U1 <-->|WebSocket| WS
    U2 <-->|WebSocket| WS
    WS --> CRDT
    WS --> Rooms
```

**Options to evaluate:**
- **Socket.io:** Self-hosted WebSocket server (flexible, more infrastructure)
- **Liveblocks:** Managed collaboration (simpler, paid)
- **PartyKit:** Edge-deployed collaboration (serverless-friendly)
- **Y.js + CRDT:** For shared editor state synchronization

### 8.2 System Design Whiteboard (Phase 3)

**Options to evaluate:**
- **Excalidraw:** Open-source, React-based, built-in collaboration support
- **tldraw:** Newer, excellent API, React-native integration
- **Custom Canvas:** Full control but high development cost

### 8.3 Testing Strategy (Phase 4)

| Layer | Tool | Scope |
|-------|------|-------|
| Unit tests | Vitest | Utilities, server actions, data transformations |
| Component tests | Vitest + React Testing Library | React components |
| E2E tests | Playwright | Full user flows (auth, SQL execution, admin) |
| Visual regression | Playwright screenshots | UI consistency |

### 8.4 Performance Optimization

| Concern | Strategy |
|---------|----------|
| DuckDB-WASM load time | Lazy load, show skeleton, cache in Service Worker |
| Database queries | Add indexes, use Prisma `select` for minimal payloads |
| Page load | Next.js RSC streaming, ISR for content pages |
| Images | Next.js `Image` component, CDN optimization |
| CSS | Tailwind purging, critical CSS extraction |

---

## 9. Environment & Configuration

### Required Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:pass@host:5432/dbname?schema=public"

# NextAuth
AUTH_SECRET="openssl rand -base64 32"
AUTH_GITHUB_ID="github_oauth_app_id"
AUTH_GITHUB_SECRET="github_oauth_app_secret"
AUTH_GOOGLE_ID="google_oauth_client_id"
AUTH_GOOGLE_SECRET="google_oauth_client_secret"
```

### Prisma Configuration

The project uses a custom `prisma.config.ts` for the `pg` driver adapter, requiring the `driverAdapters` preview feature. Both `prisma/seed.ts` and `lib/prisma.ts` create their own `PrismaPg` adapter instances with `Pool` connections.

---

## 10. Known Technical Debt

| Item | Severity | Description |
|------|----------|-------------|
| `@ts-ignore` usage | Medium | Used in 4 files to bypass NextAuth type limitations for `user.role` |
| No input validation | High | Server actions lack Zod validation on form inputs |
| No error boundaries | Medium | No React error boundaries for graceful failure |
| No loading states | Low | Missing Suspense boundaries and loading.tsx files |
| Hardcoded admin email | Medium | Admin user email is hardcoded in `seed.ts` |
| No tests | Critical | Zero test coverage |
| Package name | Low | `package.json` name is `temp_init` |
| Missing metadata | Low | Root layout metadata still says "Create Next App" |
| No rate limiting | Medium | Server actions have no rate limiting |
| No CSRF on forms | Medium | Form actions lack CSRF token verification |
