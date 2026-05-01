# Contributing to Data Learn

Thanks for your interest. This document is the source of truth for how
work flows into this repository. It covers branching, commits, pull
requests, merging, releases, and the rules that keep `main` deployable.

If anything here is unclear or out of date, that's a bug — open a PR.

---

## TL;DR

- `main` is always deployable. (Vercel deploy is on the roadmap; once shipped, `main` will auto-deploy to production.)
- Every change ships through a pull request. No direct pushes to `main`.
- Branches are named `<type>/<short-description>` (e.g. `feat/admin-sorting`).
- Commits use conventional-commit-style prefixes (`feat:`, `fix:`, …).
- PRs are merged via **squash & merge**. The PR title becomes the commit
  message on `main`, so write it carefully.
- CI must be green before merge. `--no-verify` is not allowed.
- Merged branches auto-delete. Don't fight it.

---

## Branching strategy: GitHub Flow

We use [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow):
a single long-lived branch (`main`), with short-lived topic branches
that merge back via PR. No `develop`, no `staging`, no `release/*`
branches.

**Why:**

- `main` is always the source of truth and always deployable.
- Vercel preview URLs (when enabled) cover what a `staging` branch
  would: every PR gets its own preview deploy so reviewers click
  through the actual rendered change.
- Fewer long-lived branches means fewer merge conflicts and zero
  "which branch do I cut from?" decisions.

### When NOT to use this strategy

If we ever need to support multiple released versions in parallel
(unlikely for a web app), we'll revisit. Until then: single trunk.

---

## Branch naming

Format: `<type>/<short-kebab-description>`

Optional with issue: `<type>/<issue-number>-<short-description>`

| Prefix | Use for | Example |
|---|---|---|
| `feat/` | New user-visible feature | `feat/admin-table-sorting` |
| `fix/` | Bug fix | `fix/login-redirect-loop` |
| `sec/` | Security fix or hardening | `sec/admin-validation-bypass` |
| `perf/` | Performance, no behavior change | `perf/lazy-load-charts` |
| `refactor/` | Internal restructure, no behavior change | `refactor/extract-auth-hook` |
| `docs/` | Documentation only | `docs/contributing-guide` |
| `test/` | Tests only | `test/admin-validation-edge-cases` |
| `chore/` | Repo housekeeping, deps, configs | `chore/upgrade-next` |
| `ci/` | GitHub Actions, CI tooling | `ci/add-codeql-config` |
| `build/` | Bundler, package manifests, deploy config | `build/vercel-env-vars` |

**Rules:**

- Lowercase, kebab-case after the slash.
- Keep it under ~50 chars total.
- One branch = one PR = one logical change. Don't pile features.

---

## Commit messages

Format: `<type>(<optional-scope>): <imperative summary>`

Same vocabulary as branch prefixes, applied per-commit. Examples:

- `feat: add sorting to admin user table`
- `feat(ui): add loading skeleton for charts`
- `fix(auth): prevent redirect loop on expired session`
- `chore: bump next to 16.2.4`
- `docs: explain release tagging`

**Why "conventional-ish" but not commitlint:**
We don't enforce this with a linter. The PR title is the only commit
message that ends up on `main` (squash merge), and it gets reviewed
by a human. Branch commits can be messy; the squash erases them.

**On the branch:** commit as often as you want. "wip", "fix typo",
"address review" are fine — they get squashed.

**On `main`:** every commit is a clean, conventional, present-tense
PR title.

---

## Pull request lifecycle

```
branch → push → open PR → CI runs → preview deploy → review → squash & merge → branch auto-deleted
```

### 1. Open the PR

- Push your branch: `git push -u origin <branch>`
- `gh pr create` (or use the GitHub UI). The PR template loads
  automatically (see `.github/PULL_REQUEST_TEMPLATE.md`).
- Mark **Draft** if you're not ready for review yet.

### 2. CI

These checks must pass before merge is allowed:

| Check | What it does |
|---|---|
| `e2e` | End-to-end Playwright tests (`tests/e2e/*`) gated by the test workflow |
| `CodeQL` | GitHub's code-scanning analysis (security) |
| `Analyze (javascript-typescript)` | CodeQL JS/TS pass |
| `Analyze (actions)` | CodeQL workflow analysis |

If CI is red, fix it on the same branch — push more commits, the
checks re-run automatically.

### 3. Preview deploy

Once Vercel is wired up (planned), each PR will get a preview URL
auto-commented on the PR body. Click it to verify the change in the
preview before requesting review or self-merging.

### 4. Review

- **Solo phase (current):** self-review the diff in the GitHub UI
  before merging. Read every changed line. Caching that as muscle
  memory now pays off when reviewers arrive.
- **With collaborators (future):** at least 1 approving review from a
  CODEOWNER required.

Resolve all review conversations before merging.

### 5. Merge

- Use **Squash & merge** (the only option enabled).
- The PR title becomes the commit message on `main` — edit it before
  clicking merge if it isn't clean.
- Click "Enable auto-merge" if CI is still running; it'll merge when
  green.

### 6. After merge

- The branch is auto-deleted on remote.
- Locally: `git checkout main && git pull && git branch -d <branch>`.
- (Once Vercel is wired up) `main` auto-deploys to production.

---

## PR description requirements

The template has three required sections:

- **Summary** — one paragraph: what changed and why.
- **Verified** — bullet list of things you tested and confirmed work.
- **Not yet verified** — bullet list of things you haven't tested. Be
  honest. "Not yet verified: behavior on Firefox" is far more useful
  than silence.

Plus, when applicable:

- **Screenshots / recordings** — for any UI change.
- **Linked issues** — `Closes #N` to auto-close on merge.

---

## The hard rules

### No direct push to `main`

Branch protection blocks it. Even if you can bypass as admin, *don't*.
Every change goes through a PR so the audit trail and CI gate are
uniform.

**The only exception** is the literal one-time emergency where
production is broken and CI is also broken in a way that prevents
fixing it through a PR. That hasn't happened. If it does, document
it in the next PR.

### No `--no-verify`

Pre-commit and pre-push hooks exist for a reason — they catch what
CI catches, but earlier and cheaper. If a hook is wrong, fix the hook
in a `ci/` PR. Don't skip it.

### No force-push to `main`

Branch protection blocks it. Force-push to your own topic branch is
fine (and often necessary after a rebase).

### One PR, one logical change

If your PR description has the word "also" in it, it's probably two
PRs.

---

## Hotfixes

There's no special "hotfix" branch class. A production bug is fixed
exactly like any other bug:

1. Branch from `main`: `git checkout -b fix/<bug-description>`.
2. Fix it. Test it locally.
3. Open the PR. Mention "production bug" in the summary.
4. CI runs. Preview deploys. Self-review (or expedited review).
5. Squash-merge. (When Vercel is wired up) `main` auto-deploys.

The whole cycle is fast because the rest of the process is fast. We
don't need a parallel hotfix track.

---

## Releases and tagging

We tag at **product milestones**, not per-PR.

### Versioning

- Pre-public-beta: `v0.x.y`. Bump `y` for fix-only milestones, `x`
  for feature milestones.
- At public beta: cut `v1.0.0`.
- After v1: full [semver](https://semver.org). MAJOR for breaking,
  MINOR for additive, PATCH for fixes.

### How to release

```bash
# 1. Make sure main is current and CI is green.
git checkout main
git pull
gh run list --branch main --limit 1   # confirm green

# 2. Tag.
git tag -a v0.2.0 -m "Admin dashboard GA"
git push origin v0.2.0

# 3. Create the GitHub release with auto-generated notes.
gh release create v0.2.0 \
  --generate-notes \
  --title "v0.2.0 — Admin dashboard GA"
```

`--generate-notes` reads PR titles between the previous tag (`v0.1.0`)
and `v0.2.0` and builds a categorized changelog. This is why PR
titles matter — they *are* the changelog.

---

## Future hardening (when contributor #2 lands)

These flips are queued but not active today:

- Branch protection: `enforce_admins=true` (no more solo escape hatch).
- Branch protection: require 1 approving CODEOWNER review.
- Branch protection: dismiss stale reviews on push.
- CODEOWNERS: uncomment path-specific routes in `.github/CODEOWNERS`.

When you onboard a collaborator, do all four in the same setup pass.

---

## Stale branches

The repo auto-deletes merged branches from now on. If you find an old
branch hanging around it's either (a) unmerged and abandoned — delete
it after eyeballing, or (b) unmerged and you forgot — open the PR.

Locally, occasionally:

```bash
git fetch --prune
git branch --merged main | grep -vE '^\*|^  main$' | xargs git branch -d
```

A platform-wide audit of the older branches that pre-date this policy
is intentionally deferred (~6–12 months) — they still hold useful
code archaeology while the product is finding its shape.

---

## Questions

Open an issue or a PR against this document.
