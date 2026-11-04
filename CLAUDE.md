# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Architecture

Follow the existing layering when adding a feature (see README.md): route → Action class → Controller class → Sequelize model, with schema changes as a new numbered migration in `backend/src/migrations/`. On the frontend, add a page in `src/pages/`, register it in `App.tsx`, add a sidebar entry in `NAV_STRUCTURE`, and add typed client functions to `src/lib/api.ts`.

## Git workflow

`production` is the production branch. Day-to-day work happens on `mayordevstream`.

- **Always pull the latest changes from `production` before starting work,** and bring them into `mayordevstream`.
- **Work on the `mayordevstream` branch.** Raise PRs from `mayordevstream` into `production`.
- **Never create a git commit without asking first.** Confirm with the user before running `git commit`, even when a change was made at their explicit request.
- **Always ask which branch to commit to.** Don't assume a branch name without confirming it first.
- **Never push to `production` directly.** All changes reach it through a pull request.
- **When a feature or task is done, always ask whether to raise a PR to `production`.** Only open the PR once the user says yes, and report the PR link back.
- **After raising a PR to `production`, ask whether to merge it.** Never merge without an explicit yes for that specific PR.

## Verification after each feature or task

- **Always run a security check for ID enumeration, IDOR, and authorization bypass.** For every new or changed endpoint, confirm that sequential or guessable IDs can't be used to reach other users' records, that each record lookup checks the requester owns it or is allowed to see it, and that role and permission checks are enforced on the server, not only hidden in the UI. Report the findings with the rest of the work.
- **Always run a headless browser test after a feature or task is done, but confirm before starting.** Ask the user before launching a headless browser test of the affected pages; run it only after they agree, and report what was tested and the results.
