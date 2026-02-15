---
description: How to develop new features using the branching strategy (create branch, develop, commit, merge)
---

# Feature Development Workflow

This workflow describes how to implement new features or changes in the DataLearn project. **Never commit directly to `main`.**

## Steps

### 1. Ensure you are on `main` and up to date

// turbo
```bash
git checkout main && git pull origin main
```

### 2. Create a feature branch

Use descriptive branch names with a prefix:

```bash
git checkout -b <branch-type>/<branch-name>
```

**Branch naming conventions:**
- `feat/` — New features (e.g., `feat/admin-panel-v2`)
- `fix/` — Bug fixes (e.g., `fix/auth-redirect-loop`)
- `docs/` — Documentation changes (e.g., `docs/api-reference`)
- `refactor/` — Code refactoring (e.g., `refactor/server-actions`)
- `chore/` — Maintenance tasks (e.g., `chore/update-deps`)

### 3. Develop on the feature branch

Make changes, test locally using the `/dev-server` workflow.

### 4. Stage and commit changes

Use conventional commit messages:

```bash
git add .
git commit -m "<type>: <description>"
```

**Commit message format:**
- `feat: add topic CRUD to admin panel`
- `fix: resolve DuckDB initialization race condition`
- `docs: update ROADMAP with Q2 goals`
- `refactor: extract validation into Zod schemas`
- `chore: update Prisma to v7.3`

### 5. Push the feature branch

```bash
git push origin <branch-name>
```

### 6. Create a Pull Request (if using GitHub)

Open a PR from `<branch-name>` → `main` on GitHub.

### 7. After merge, clean up

// turbo
```bash
git checkout main && git pull origin main && git branch -d <branch-name>
```

## Notes

- Keep commits small and atomic
- Each feature branch should map to one milestone or sub-task from the Implementation Plan
- Run `npm run build` before pushing to catch build errors early
