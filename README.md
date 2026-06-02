# PaperSwipe

> Tinder for academic papers — swipe through research, save to Zotero, match with co-readers.

[![CI](https://github.com/WafaJohal/paperswipe/actions/workflows/ci.yml/badge.svg)](https://github.com/WafaJohal/paperswipe/actions/workflows/ci.yml)
![Version](https://img.shields.io/badge/version-2.1.0-blue)

PaperSwipe is a Next.js 14 (App Router) web app that surfaces academic papers from [OpenAlex](https://openalex.org) in a swipe-card UI. Users can:

- **Swipe right** to save a paper to their Zotero library.
- **Swipe left** to skip.
- **◎ Maybe** to save to a separate "to-read" Zotero collection.
- **Filter** by date range, keywords, venue (journal/conference), work type, and open-access status.
- **Match** with other researchers who saved the same papers.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 App Router |
| Database | PostgreSQL via Prisma + Vercel Postgres |
| Auth | NextAuth v4 |
| Paper data | OpenAlex API |
| Reference manager | Zotero API |
| Animations | Framer Motion |
| Styling | Tailwind CSS |
| Tests | Vitest (+ Deno for CI fallback) |

## Getting started

```bash
cp .env.local.example .env.local   # fill in NEXTAUTH_SECRET, DB_URL, etc.
npm install
npm run db:push                    # push Prisma schema to DB
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run lint` | ESLint |
| `npm run format` | Prettier (write) |
| `npm run format:check` | Prettier (check only) |
| `npm run typecheck` | TypeScript type-check |
| `npm run test` | Vitest unit tests |
| `npm run test:deno` | Run tests via Deno (no npm needed) |
| `npm run test:coverage` | Vitest with coverage report |

## Filters

Filters are backed by OpenAlex's native filter parameters:

| Filter | OpenAlex parameter |
|---|---|
| Date range | `from_publication_date` |
| Venue / journal | `primary_location.source.id` (resolved via autocomplete) |
| Work type | `type:article \| review \| preprint` |
| Open access | `open_access.is_oa:true` |
| Keywords | `search` |

## Coverage floor

80% line/branch/function coverage is required. Coverage must not drop below the previous cycle's level.

## Project docs

- [`CHANGELOG.md`](CHANGELOG.md) — version history
- [`BACKLOG.md`](BACKLOG.md) — planned work
- [`ASSUMPTIONS.md`](ASSUMPTIONS.md) — design assumptions
- [`docs/adr/`](docs/adr/) — architecture decision records
- [`docs/cycles/`](docs/cycles/) — per-cycle work records
