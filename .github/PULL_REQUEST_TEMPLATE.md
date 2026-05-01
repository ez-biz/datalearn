<!--
PR title becomes the commit message on main (squash merge), so keep it
conventional: feat:, fix:, sec:, perf:, refactor:, docs:, test:, chore:,
ci:, build:. Optional scope: feat(ui): … . Imperative summary, no period.
-->

## Summary

<!-- One paragraph: what changed and why. -->

## Type of change

- [ ] feat — new user-visible feature
- [ ] fix — bug fix
- [ ] sec — security fix or hardening
- [ ] perf — performance, no behavior change
- [ ] refactor — internal restructure, no behavior change
- [ ] docs — documentation only
- [ ] test — tests only
- [ ] chore — repo housekeeping, deps, configs
- [ ] ci — GitHub Actions, CI tooling
- [ ] build — bundler, package manifests, deploy config

## Verified

<!-- Bullet list of things you tested and confirmed work. -->
-

## Not yet verified

<!-- Bullet list of things you haven't tested. Be honest — gaps here help
reviewers focus. Write "n/a" if there's truly nothing. -->
-

## Screenshots / recordings

<!-- Required for UI changes. Delete this section otherwise. -->

## Linked issues

<!-- e.g. Closes #42. Delete if none. -->

## Pre-merge checklist

- [ ] Branch name follows `<type>/<description>` convention
- [ ] PR title is conventional and reads as the final commit message
- [ ] Pre-commit / pre-push hooks ran (no `--no-verify`)
- [ ] No leftover `console.log`, `debugger`, or `TODO` without a linked issue
- [ ] Preview deploy verified (link auto-commented once Vercel is wired up)
- [ ] CI is green or expected to be by merge time
