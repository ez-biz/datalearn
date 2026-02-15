---
name: nextjs-app-patterns
description: Next.js 16 App Router conventions and patterns used in the DataLearn project
---

# Next.js App Router Patterns for DataLearn

This skill documents the specific Next.js patterns used in the DataLearn project to ensure consistency when adding new features.

---

## 1. Project Structure Convention

```
app/
├── layout.tsx          # Root layout (shared nav, fonts, global CSS)
├── page.tsx            # Homepage (/)
├── globals.css         # Global styles
├── error.tsx           # Global error boundary (TODO)
├── not-found.tsx       # Custom 404 (TODO)
├── loading.tsx         # Global loading state (TODO)
├── <route>/
│   ├── page.tsx        # Route page
│   ├── layout.tsx      # Route-specific layout (optional)
│   └── loading.tsx     # Route loading state (optional)
├── [slug]/page.tsx     # Dynamic route (catch-all for CMS pages)
└── api/
    └── auth/[...nextauth]/route.ts  # NextAuth API handler
```

---

## 2. Server Components (Default)

All pages in `app/` are **Server Components by default**. They can:
- Directly `await` async functions (server actions, Prisma queries)
- Access the database without API routes
- Read cookies/headers via `next/headers`

### Pattern: Data Fetching in Server Components

```tsx
// app/learn/page.tsx — Always use this pattern
import { getTopics } from "@/actions/content"

export default async function LearnPage() {
    const { data: topics, error } = await getTopics()
    
    if (error || !topics) {
        return <div>Failed to load topics</div>
    }
    
    return (
        <div className="container mx-auto p-8">
            {/* Render data */}
        </div>
    )
}
```

### Pattern: Dynamic Route Parameters (Next.js 16+)

In Next.js 16, `params` is a **Promise** that must be awaited:

```tsx
type Props = {
    params: Promise<{ slug: string }>
}

export default async function Page({ params }: Props) {
    const { slug } = await params  // MUST await in Next.js 16
    // ... fetch data using slug
}
```

---

## 3. Client Components

Only use `"use client"` when the component needs:
- React hooks (`useState`, `useEffect`, `useRef`)
- Browser APIs (DOM, Web Workers, WebAssembly)
- Event handlers (`onClick`, `onChange`)

### Pattern: Dynamic Import for WASM Components

Components that use browser-only APIs (like DuckDB-WASM) must be dynamically imported with `ssr: false`:

```tsx
// components/sql/ProblemWorkspace.tsx
"use client"
import dynamic from "next/dynamic"

const SqlPlayground = dynamic(
    () => import("@/components/sql/SqlPlayground").then(mod => mod.SqlPlayground),
    { ssr: false }
)

export function ProblemWorkspace({ ... }) {
    return <SqlPlayground ... />
}
```

---

## 4. Server Actions

All server actions are in the `actions/` directory with `"use server"` directive.

### Pattern: Server Action with Auth Check

```tsx
// actions/admin.ts
"use server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function createPage(formData: FormData) {
    // 1. Auth check
    const session = await auth()
    if (session?.user?.role !== 'ADMIN') {
        return { success: false, error: "Unauthorized" }
    }
    
    // 2. Extract & validate input
    const title = formData.get("title") as string
    
    // 3. Database operation
    try {
        await prisma.page.create({ data: { title, ... } })
        revalidatePath('/')
        return { success: true }
    } catch (error) {
        return { success: false, error: "Failed to create page" }
    }
}
```

### Pattern: Server Action for Data Fetching

```tsx
// actions/content.ts
"use server"
import { prisma } from "@/lib/prisma"

export async function getTopics() {
    try {
        const topics = await prisma.topic.findMany({
            include: { _count: { select: { articles: true } } },
            orderBy: { name: 'asc' }
        })
        return { success: true, data: topics }
    } catch (error) {
        return { success: false, error: "Failed to fetch topics" }
    }
}
```

---

## 5. Authentication Pattern

### Checking Auth in Server Components

```tsx
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function ProtectedPage() {
    const session = await auth()
    
    if (!session?.user) {
        redirect("/api/auth/signin?callbackUrl=/protected")
    }
    
    // Admin-only check
    if (session.user.role !== 'ADMIN') {
        redirect("/")
    }
    
    // ... render page
}
```

---

## 6. Styling Convention

- Use **Tailwind CSS utility classes** inline
- Use `cn()` helper (from `lib/utils.ts`) for conditional classes:

```tsx
import { cn } from "@/lib/utils"

<div className={cn(
    "base-classes",
    condition && "conditional-classes"
)} />
```

- Common class patterns:
  - Containers: `container mx-auto p-8`
  - Cards: `bg-white rounded-lg border shadow-sm p-6`
  - Badges: `px-3 py-1 rounded-full text-xs font-medium`

---

## 7. Path Aliases

The project uses `@/` as a path alias mapping to the project root:

```json
// tsconfig.json
{
    "compilerOptions": {
        "paths": {
            "@/*": ["./*"]
        }
    }
}
```

Usage: `import { prisma } from "@/lib/prisma"`

---

## 8. Form Handling Pattern

Use Next.js Server Actions directly in forms:

```tsx
<form action={serverAction} className="space-y-4">
    <input name="title" required className="w-full border p-2 rounded" />
    <button type="submit" className="bg-black text-white px-4 py-2 rounded">
        Submit
    </button>
</form>
```
