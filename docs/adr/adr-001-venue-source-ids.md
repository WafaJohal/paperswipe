# ADR-001 — Use OpenAlex source entity IDs for venue filtering

- **Date:** 2026-05-29
- **Status:** Accepted
- **Cycle:** cycle-001

## Context

The venue/journal filter in PaperSwipe was non-functional. The original implementation used `primary_location.source.display_name:Nature|Science` as an OpenAlex filter parameter. This fails because:

1. The match is **case-sensitive and exact** — "Nature" does not match "Nature (journal)" or any variant.
2. The `display_name` field is not a reliable OR-filterable field in the OpenAlex works API.
3. There is no error or warning from the API; it simply returns results that happen to match (often zero).

## Decision

Replace free-text venue names with OpenAlex **source entity IDs** (e.g. `S137773608`).

- The filter becomes `primary_location.source.id:S137773608|S3880285`, which is the canonical, documented filter field.
- Source IDs are resolved by the user at settings time via a new autocomplete that queries `/api/openalex/sources?q=<name>` (a server-side proxy to `https://api.openalex.org/sources?search=...`).
- Both the human-readable name and the ID are stored: `{ name: string; id: string }`. The name is only for display; the ID drives the filter.

## Alternatives considered

| Option | Reason rejected |
|---|---|
| `display_name.search:Nature` | Case-insensitive partial match, but OR with multiple venues via `\|` is undocumented and untested. Still fragile. |
| ISSN-based filtering | ISSNs are authoritative but require users to know them. Poor UX. |
| Client-side post-filter | Fetch all results, then filter by name. Very wasteful for large corpora. |

## Consequences

- **Breaking:** existing `filterVenues` values (plain strings) are dropped silently on first load after upgrade. Users must re-add venues via autocomplete. (See A-002.)
- **New API route:** `/api/openalex/sources` acts as a thin proxy, keeping the `User-Agent` header server-side and enabling result caching (1 hour `revalidate`).
- **Schema:** `filterVenues` in `UserSettings` remains a `Json` column (no Prisma migration needed); the in-memory type changes from `string[]` to `{ name, id }[]`.
