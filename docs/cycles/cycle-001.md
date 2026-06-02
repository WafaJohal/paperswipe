# Cycle 001 — Fix OpenAlex filters

- **Date finalized:** 2026-05-29
- **Branch:** `fix/openalex-filters`
- **Version:** `2.0.0` → `2.1.0` (bump: minor — backward-compatible new features + bug fix)

## Plan (as approved)

- **Scope:** Fix the broken venue filter; add work-type and open-access filters;
  introduce venue autocomplete backed by OpenAlex source IDs; write unit tests;
  scaffold project workflow documents and CI.

- **Files touched:**
  - `lib/openalex.ts` — updated `FeedFilters`, `buildOpenAlexUrl`; added `VenueFilter`, `WorkType`, source response types
  - `app/api/openalex/sources/route.ts` — new proxy route for venue autocomplete
  - `app/api/user/settings/route.ts` — updated Zod schema for venues + new filter fields
  - `app/api/papers/route.ts` — updated filter mapping for new `FeedFilters` shape
  - `hooks/usePaperFeed.ts` — updated `GuestFilters` and URL builder for new venue encoding
  - `components/settings/SettingsPanel.tsx` — venue autocomplete, work type selector, OA toggle
  - `__tests__/lib/openalex.test.ts` — Vitest test suite (23 tests)
  - `__tests__/lib/openalex.deno_test.ts` — Deno-runnable equivalent
  - `vitest.config.ts`, `.prettierrc`, `.eslintrc.json` — tooling config
  - `.github/workflows/ci.yml` — CI workflow
  - `package.json` — new devDeps, scripts
  - `README.md`, `CHANGELOG.md`, `BACKLOG.md`, `ASSUMPTIONS.md` — living docs
  - `docs/adr/adr-001-venue-source-ids.md`, `docs/cycles/cycle-001.md` — ADR + cycle record

- **Tests added:** 23 unit tests for `buildOpenAlexUrl` (filter combinations, encoding,
  no display_name usage, pipe OR, OA, work type) and `reconstructAbstract`.

## Assumptions added

- A-001: OpenAlex source IDs are stable long-lived identifiers.
- A-002: Existing venue strings are dropped; users re-enter via autocomplete.
- A-003: npm segfault is a local environment issue; Deno is the test-runner fallback.

## Decisions made

- ADR-001: Use OpenAlex source entity IDs for venue filtering.

## Test & coverage results

- **Tests:** 23/23 passed (Deno runner)
- **Coverage:** N/A — vitest install blocked by npm segfault on this machine;
  tests confirmed passing via Deno. CI (`ci.yml`) will report coverage once npm is working.
- **Lint / format:** ESLint passes (`next lint`); Prettier config added.
- **Typecheck:** TypeScript compilation clean.

## Notes

- `npm install` crashes with SIGSEGV on this machine for any new package install.
  Worked around by declaring deps in `package.json` manually and using Deno 2.1.9
  as the test runner. The Vitest test file is identical in logic to the Deno file
  and will be the primary runner once npm is restored.
- `per-page` corrected to `per_page` in the OpenAlex URL (the API accepts both but
  `per_page` is the canonical documented form).
- `filterWorkType` and `filterOpenAccessOnly` are stored in the existing `UserSettings`
  `Json` columns; typed Prisma columns are deferred to a future cycle (see BACKLOG).

## PR

- Link: (see PR created in this session)
- Merge status: pending user
