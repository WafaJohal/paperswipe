# Backlog

A living list of planned, in-progress, and completed work.
Reviewed at the end of every cycle: mark delivered items done, capture newly discovered work.

## Now (in progress)

<!-- nothing currently in flight -->

## Next (planned)

- fix: resolve npm segfault on this machine so `vitest run` can replace the Deno fallback
- feat: persist `filterWorkType` and `filterOpenAccessOnly` in Prisma `UserSettings` schema (currently stored as loose JSON via existing `Json` fields; add typed columns)
- feat: show active filter chips in the TopBar so users can see what's applied at a glance
- feat: concept/topic filter using OpenAlex `topics.id` — similar autocomplete to venues
- chore: add husky pre-commit hooks once npm install is stable (`npx husky init`)
- chore: add Vitest coverage badge to README once CI is running

## Later (ideas / unscheduled)

- feat: "For you" sort mode — personalised ranking based on saved-paper concepts
- feat: share a paper card as an image (Open Graph card generation)
- feat: email digest of saved papers weekly
- feat: browser extension to swipe from any OpenAlex page
- perf: stream the swipe feed via React Suspense / streaming RSC

## Done

- fix: venue filter broken — replaced `display_name` exact match with source ID lookup — shipped v2.1.0 (cycle-001)
- feat: work type filter (article/review/preprint) — shipped v2.1.0 (cycle-001)
- feat: open access toggle — shipped v2.1.0 (cycle-001)
- feat: venue autocomplete against OpenAlex `/sources` — shipped v2.1.0 (cycle-001)
- chore: project workflow scaffold (README, CHANGELOG, BACKLOG, ASSUMPTIONS, ADR, CI) — shipped v2.1.0 (cycle-001)
