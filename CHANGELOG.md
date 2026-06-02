# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.1.0] - 2026-05-29

### Fixed

- Venue filter now uses `primary_location.source.id` (OpenAlex source entity ID)
  instead of `display_name`, which was silently returning empty results due to
  case-sensitive exact-match requirements.

### Added

- Venue autocomplete in SettingsPanel: typing a journal name searches the
  OpenAlex `/sources` endpoint and lets users pick from suggestions (name + ISSN).
  Source IDs are stored so filtering is reliable.
- Work type filter: article / review / preprint / all — maps to OpenAlex `type:`.
- Open access toggle: `open_access.is_oa:true` filter, shown in feed and saved to
  user settings.
- `/api/openalex/sources` proxy route — server-side proxy to OpenAlex sources
  search, keeping the User-Agent header server-side.
- Vitest + `@vitest/coverage-v8` added as dev dependencies; 23 unit tests covering
  `buildOpenAlexUrl` and `reconstructAbstract`.
- Deno-runnable test file (`__tests__/lib/openalex.deno_test.ts`) as CI fallback.
- GitHub Actions CI workflow (`.github/workflows/ci.yml`).
- Prettier, ESLint-prettier integration, husky + lint-staged pre-commit hooks.
- Project workflow documents: README, CHANGELOG, BACKLOG, ASSUMPTIONS, ADR, cycle
  records.

### Changed

- `FeedFilters.venues` changed from `string[]` to `{ name: string; id: string }[]`.
  Existing saved venue names (old format) are silently dropped on first load;
  users must re-add venues via the new autocomplete.
- Guest filter URL encoding: venues now use `NAME|ID` encoding in query params.
- `per-page` → `per_page` in OpenAlex URL (correct API param name).
- `select` field list cleaned up (removed duplicate `authorships.author.orcid`).

## [2.0.0] - 2026-05-18

### Added

- Initial public release: swipe feed, Zotero integration, researcher matching,
  guest mode, seen-paper deduplication.
