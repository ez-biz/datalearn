# Contributing to Data Learn

Thanks for your interest. This document is the source of truth for how
work flows into this repository. It covers branching, commits, pull
requests, merging, releases, and the rules that keep `main` deployable.

If anything here is unclear or out of date, that's a bug — open a PR.

---

## TL;DR

- **`main` is integration; `production` is what's live.** Pushes to `main` deploy to a Preview URL only. Production deploys when you open a PR `main → production` (titled `release: vX.Y.Z`) and merge it. This batches multiple feature merges into one explicit, tag-able release event.
- Every change ships through a pull request. No direct pushes to `main` or `production`.
- Branches are named `<type>/<short-description>` (e.g. `feat/admin-sorting`).
- Commits use conventional-commit-style prefixes (`feat:`, `fix:`, …).
- All three merge methods are enabled — **squash & merge**, **merge commit**, and **rebase & merge**. Pick the one that fits the change. PR title becomes the commit message on `main` for squash, so write it carefully.
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
We don't enforce this with a linter. For squash merges the PR title
becomes the commit message on `main`; for merge commits / rebase
merges, every branch commit lands on `main` verbatim. Either way the
goal is the same — `main` should read like a clean conventional log.

**On the branch:** if you plan to **squash**, branch commits can be
messy ("wip", "fix typo", "address review") — they get erased. If
you plan to **merge** or **rebase**, write each commit cleanly because
they all land on `main`. Use `git rebase -i` or `git commit --amend`
to clean up before merging if needed.

**On `main`:** every commit should read like a conventional, present-
tense statement of intent.

---

## Pull request lifecycle

```
branch → push → open PR → CI runs → preview deploy → review → merge to main → branch auto-deleted
                                                                ↓
                                                  (later, when ready to release)
                                                                ↓
                                                    main → production PR → tag → live
```

**Two merge events:**

1. **Feature PR → `main`**. Adds the change to the integration branch. Auto-deploys to a Preview URL only — your "staging" environment.
2. **Release PR `main → production`**. Promotes whatever has accumulated on `main` since the last release to live. This is when prod actually changes. See §Releases below.

### 1. Open the PR

- Push your branch: `git push -u origin <branch>`
- `gh pr create` (or use the GitHub UI). The PR template loads
  automatically (see `.github/PULL_REQUEST_TEMPLATE.md`).
- Mark **Draft** if you're not ready for review yet.

### 2. CI

CI runs on every PR and on every push to `main`:

| Check | What it does |
|---|---|
| `e2e` | End-to-end Playwright tests (`tests/e2e/*`) gated by the test workflow |
| `CodeQL` | GitHub's code-scanning analysis (security) |
| `Analyze (javascript-typescript)` | CodeQL JS/TS pass |
| `Analyze (actions)` | CodeQL workflow analysis |

If CI is red, fix it on the same branch — push more commits, the
checks re-run automatically.

> **Solo-phase note:** branch protection currently runs with
> `required_status_checks: null` — i.e. CI is **not a hard merge
> gate**. The reason: GitHub's mergeable-state computation has a
> known bug where solo, no-required-reviewer PRs stay `BLOCKED` even
> with every check green and `strict: false`, and the only escape is
> `--admin --squash`. Rather than rely on the admin override every
> merge, we drop the required-checks gate entirely while solo and
> trust the author to read the badges before merging.
>
> Other guardrails (no force-push, no
> deletion, `required_conversation_resolution`) stay on, so `main`
> still can't be force-pushed or deleted.
>
> When contributor #2 lands, re-add the required checks (and turn
> `strict: true` back on alongside required reviews — see *Future
> hardening* below). The "review approved" event will reliably push
> GitHub past the stuck state, and the gate becomes meaningful again.

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

Three merge methods are enabled — pick the one that fits the change:

| Method | When to use | What lands on `main` |
|---|---|---|
| **Squash & merge** | Default for most PRs. Many small / messy / "wip" branch commits, or anything where only the end state matters. | One commit (the PR title) |
| **Merge commit** | When the branch has a meaningful multi-commit story you want to preserve — e.g. a refactor split into reviewable steps that each compile and test green. | All branch commits + a merge commit |
| **Rebase & merge** | When the branch is one or a few clean, conventional commits and you want them in the linear log without a merge commit. | Each branch commit, replayed onto `main` |

Rules of thumb:

- If you wouldn't want to read your branch commits in `git log main` six months from now → squash.
- If each branch commit is itself a thoughtful conventional commit → rebase.
- If preserving the *path* of how the change came together has review or archaeology value → merge commit.

For all three: the PR title / commit messages should be clean before clicking merge. Click "Enable auto-merge" if CI is still running; it'll merge when green.

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

For a bug already in production that can't wait for the next release batch, branch from `production` (not `main`) so you don't drag in unfinished `main` work:

1. `git checkout production && git pull`
2. `git checkout -b fix/<bug-description>`
3. Fix it. Test it locally.
4. Open **two PRs**:
   - `fix/x → production` — ships the fix to live as soon as you merge
   - `fix/x → main` — back-merges the same fix so `main` doesn't regress on the next release
5. Tag the production merge as a patch release (e.g. `v0.3.1`) so the live state is identifiable.

The whole cycle is fast because the rest of the process is fast. The two-PR pattern is the only thing the production-branch flow adds over plain GitHub Flow.

---

## Releases

`main` accumulates merged feature PRs as Preview deploys (your "staging"). When you want a batch live, you cut a release.

### Versioning

- Pre-public-beta: `v0.x.y`. Bump `y` for fix-only releases, `x` for feature releases.
- At public beta: cut `v1.0.0`.
- After v1: full [semver](https://semver.org). MAJOR for breaking, MINOR for additive, PATCH for fixes.

### How to release

```bash
# 1. Make sure main is current and you've sanity-checked the staging Preview URL.
git checkout main && git pull
gh run list --branch main --limit 1   # CI status (informational; not a hard gate)

# 2. Open the release PR: main → production. Title MUST be `release: vX.Y.Z`.
gh pr create --base production --head main \
  --title "release: v0.3.0" \
  --body "$(gh pr list --base main --state merged --limit 50 --json title,number --jq '.[] | "- #\(.number) \(.title)"')"

# 3. Review the PR diff (this IS your release notes). Edit the body if needed.

# 4. Merge it. Vercel deploys to production automatically.
gh pr merge --squash --delete-branch  # or --merge if you want each main commit on production verbatim

# 5. Tag the production merge commit + create the GitHub release.
git checkout production && git pull
git tag -a v0.3.0 -m "v0.3.0"
git push origin v0.3.0
gh release create v0.3.0 \
  --target production \
  --generate-notes \
  --title "v0.3.0"
```

`--generate-notes` reads PR titles between the previous tag and this one and builds a categorized changelog. PR titles are your changelog — keep them clean.

### Merge mode for the release PR

- **Squash** — one commit on `production` per release. Cleanest `git log production`. Best when you don't need to revert individual feature merges from prod separately.
- **Merge commit** — preserves every `main` commit on `production`. Best when you want `git log production` to show exactly what shipped, in order.
- **Rebase** — replays each `main` commit linearly. Same outcome as merge commit but no merge commit node.

Default to squash unless you have a reason to preserve the per-PR history on `production`.

---

## Future hardening (when contributor #2 lands)

These flips are queued but not active today:

- Branch protection: re-add required status checks (`e2e`, `CodeQL`,
  `Analyze (javascript-typescript)`, `Analyze (actions)`) — disabled in
  solo phase due to GitHub's mergeable-state bug; see CI note above.
- Branch protection: `required_status_checks.strict=true` (require PRs
  to be up-to-date with `main` before merge — only meaningful with
  required reviews).
- Branch protection: `enforce_admins=true` (no more solo escape hatch).
- Branch protection: require 1 approving CODEOWNER review.
- Branch protection: dismiss stale reviews on push.
- CODEOWNERS: uncomment path-specific routes in `.github/CODEOWNERS`.

When you onboard a collaborator, do all six in the same setup pass.
The exact one-liners:

```bash
gh api -X PUT repos/ez-biz/datalearn/branches/main/protection/required_status_checks \
  -F strict=true \
  -f 'contexts[]=e2e' \
  -f 'contexts[]=CodeQL' \
  -f 'contexts[]=Analyze (javascript-typescript)' \
  -f 'contexts[]=Analyze (actions)'
gh api -X PATCH repos/ez-biz/datalearn/branches/main/protection/enforce_admins
gh api -X PUT repos/ez-biz/datalearn/branches/main/protection/required_pull_request_reviews \
  -F required_approving_review_count=1 -F dismiss_stale_reviews=true -F require_code_owner_reviews=true
```

---

## Dependabot PRs

Dependabot opens grouped weekly PRs every Monday for npm + GitHub
Actions updates (config in `.github/dependabot.yml`). Treat them like
any other PR:

- Minor + patch updates land grouped — review the diff, let CI go
  green, squash-merge (or rebase if the bump messages are useful).
- Major bumps come individually because they're likely to need real
  attention. Read release notes; verify locally; then merge.
- Don't auto-merge Dependabot PRs without a glance — CI catches
  breakage but not new behavior.

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
