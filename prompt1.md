Here is a refined, technically robust **Master Prompt** designed to be fed into an AI coding assistant (like the "Antigravity" tool you mentioned) or given to a development team.

It structures your requirements into a professional **Product Requirement Document (PRD)** format, organizing the logic into an incremental build strategy.

---

### **The Refined Master Prompt**

**Copy and paste the following into the Antigravity tool:**

> **Project Title:** Antigravity Data Learning Platform
> **Objective:** Build a comprehensive web platform for data engineering education, SQL practice, and real-time interview collaboration.
> **Core Tech Stack:**
> * **Frontend:** Next.js (React) with Tailwind CSS for styling.
> * **Backend:** Node.js/Python (FastAPI) for API handling.
> * **Database:** PostgreSQL (for user data/content) and a Sandbox Environment for SQL execution.
> * **Real-time:** WebSockets (Socket.io) for collaboration.
> * **CMS:** Headless CMS or custom Admin Panel.
> 
> 
> **Implementation Strategy:** Incremental/Agile (Phase 1, 2, and 3).
> ---
> 
> 
> ### **Phase 1: The Content Core (MVP)**
> 
> 
> **Goal:** Establish the learning repository and user access.
> 1. **Authentication Module:**
> * Secure Sign-up/Login (Email + Social Auth like GitHub/Google).
> * User Profile management (track progress, saved articles).
> 
> 
> 2. **Blog & Learning Hub:**
> * A "Topic-Wise" learning page (e.g., Data Warehousing, ETL, NoSQL).
> * Markdown rendering for technical articles with code snippets.
> 
> 
> 3. **SQL Question Bank (Static):**
> * A list view of SQL problems categorized by difficulty (Easy, Medium, Hard).
> * Detail view showing the Problem Statement, Schema, and Expected Output.
> 
> 
> 4. **Admin Panel (V1):**
> * Basic dashboard to CRUD (Create, Read, Update, Delete) blog posts and SQL questions.
> 
> 
> 
> 
> ### **Phase 2: The Interactive Engine**
> 
> 
> **Goal:** Enable users to run code and test skills.
> 1. **Live SQL Execution Engine:**
> * Integrate a browser-based SQL engine (like `sql.js` for lightweight use) or a server-side Docker sandbox for robust testing.
> * Interface: Code Editor (Monaco Editor) on the left, Result Table on the right.
> * Feature: "Run Code" button validates user query against the test case.
> 
> 
> 2. **News Aggregator:**
> * Automated feed fetching latest data engineering news (via RSS feeds or APIs) displayed in a "Latest News" card layout.
> 
> 
> 3. **Dynamic Navigation:**
> * Ability for Admins to add new pages/tabs to the navigation pane dynamically via the Admin Panel.
> 
> 
> 
> 
> ### **Phase 3: Collaboration & Community**
> 
> 
> **Goal:** Real-time features for interview prep.
> 1. **Interview Prep Tool:**
> * Peer-to-peer coding environment.
> * Shared code editor with syntax highlighting.
> 
> 
> 2. **System Design Whiteboard:**
> * Interactive canvas (using libraries like Fabric.js or Excalidraw) where users can drag-and-drop system components (Load Balancers, DBs) and draw arrows in real-time.
> 
> 
> 3. **Advanced Admin Features:**
> * User analytics, content moderation, and news source management.
> 
> 
> 
> 

---

### **Detailed Architecture & Breakdown**

Below is the context you need to understand *how* the tool should implement these features.

#### **1. The SQL Engine (The Complexity)**

This is the hardest part. You have two options for the "Antigravity" tool to generate:

* **Client-Side (Easier, Cheaper):** Use **WASM (WebAssembly)** technologies like `DuckDB-Wasm` or `sql.js`. This runs the SQL inside the user's browser. No server costs, fast, but limited to SQLite/DuckDB syntax.
* **Server-Side (Professional):** Spin up isolated **Docker containers** for each user session. This allows for full PostgreSQL/MySQL syntax but requires heavy backend infrastructure.

#### **2. System Design Collaboration**

For the "System Design" page, the tool needs to implement a **Canvas API**.

* Users need a toolbar with standard icons (Database, Server, Cache, User).
* It must use **WebSockets** so if User A moves a box, User B sees it move instantly.

#### **3. The Admin Panel (CMS)**

The requirement "Functionality to add such pages in the pane" suggests a **Dynamic Routing** system.

* **Database Schema:** You need a `Pages` table in your database (Columns: `page_id`, `slug`, `title`, `is_active`, `content_type`).
* **Frontend:** The Navigation Bar shouldn't be hardcoded. It should fetch the list of active pages from the API on load.

### **Recommended Incremental Steps for You**

Since you are starting, ask the tool to build **Phase 1** first. Do not try to generate the whole system at once.

1. **Step 1:** "Generate the database schema for Users, Blogs, and SQL Problems."
2. **Step 2:** "Create the Next.js frontend layout with a dynamic sidebar navigation."
3. **Step 3:** "Build the Admin Dashboard to insert a new Blog post."

Would you like me to write the specific **Database Schema (SQL code)** for the `Questions`, `Blogs`, and `Users` tables so you can feed that into the tool immediately?