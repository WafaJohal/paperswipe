export interface OpenAlexAuthor {
  author: { display_name: string; orcid: string | null };
}

export interface OpenAlexWork {
  id: string;
  title: string | null;
  authorships: OpenAlexAuthor[];
  publication_year: number | null;
  primary_location: {
    source?: { display_name?: string; is_oa?: boolean } | null;
  } | null;
  abstract_inverted_index: Record<string, number[]> | null;
  cited_by_count: number;
  doi: string | null;
  concepts: { display_name: string; score: number }[];
  open_access?: { is_oa?: boolean };
}

export interface OpenAlexResponse {
  results: OpenAlexWork[];
  meta: { count: number; page: number; per_page: number };
}

/** A venue/source as resolved from the OpenAlex /sources endpoint. */
export interface VenueFilter {
  /** Human-readable name shown in the UI (e.g. "Nature"). */
  name: string;
  /** OpenAlex source entity ID (e.g. "S137773608"). Used for filtering. */
  id: string;
}

/** Converts OpenAlex inverted index → plain text abstract */
export function reconstructAbstract(
  invertedIndex: Record<string, number[]> | null
): string {
  if (!invertedIndex) return "";
  const entries: [number, string][] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      entries.push([pos, word]);
    }
  }
  return entries
    .sort((a, b) => a[0] - b[0])
    .map(([, word]) => word)
    .join(" ");
}

const DATE_RANGE_MAP: Record<string, () => string> = {
  week: () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  },
  month: () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  },
  quarter: () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  },
  year: () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  },
};

/** Work types supported by the OpenAlex `type` filter. */
export type WorkType = "article" | "review" | "preprint" | "";

export interface FeedFilters {
  keywords: string[];
  dateRange: string;
  /**
   * Venues as `{ name, id }` objects.  The `id` is the OpenAlex source entity
   * ID (e.g. "S137773608"), which is the only reliable filter field.
   * Display-name matching was removed: it requires exact case-sensitive matches
   * and silently returns empty results for common spellings.
   */
  venues: VenueFilter[];
  /** Filter to a specific OpenAlex work type, or "" for all types. */
  workType: WorkType;
  /** When true, adds open_access.is_oa:true to the filter. */
  openAccessOnly: boolean;
}

/**
 * Build an OpenAlex /works URL using the correct native filter parameters.
 *
 * Key design decisions:
 * - Venues → `primary_location.source.id:ID1|ID2` using OpenAlex source
 *   entity IDs.  This is the canonical filter field; display-name matching
 *   was unreliable (case-sensitive, exact-match only).
 * - Keywords → `search` param (free-text over title/abstract/concepts).
 * - `|` OR syntax requires the URL to be assembled as a raw string so the
 *   pipe is NOT percent-encoded (URLSearchParams would encode it as %7C).
 * - Work type and open-access flags use dedicated OpenAlex filter fields.
 */
export function buildOpenAlexUrl(filters: FeedFilters, page = 1): string {
  const base = "https://api.openalex.org/works";

  const filterParts: string[] = [];

  const fromDate = (DATE_RANGE_MAP[filters.dateRange] ?? DATE_RANGE_MAP.month)();
  filterParts.push(`from_publication_date:${fromDate}`);

  // Venue OR: primary_location.source.id:S137773608|S12345
  if (filters.venues.length > 0) {
    const ids = filters.venues.map((v) => v.id).join("|");
    filterParts.push(`primary_location.source.id:${ids}`);
  }

  // Work type: type:article  /  type:review  /  type:preprint
  if (filters.workType) {
    filterParts.push(`type:${filters.workType}`);
  }

  // Open access: open_access.is_oa:true
  if (filters.openAccessOnly) {
    filterParts.push("open_access.is_oa:true");
  }

  const select = [
    "id",
    "title",
    "authorships",
    "publication_year",
    "primary_location",
    "abstract_inverted_index",
    "cited_by_count",
    "doi",
    "concepts",
    "open_access",
  ].join(",");

  // Build URL as a raw string so | is preserved in filter values
  let url =
    `${base}` +
    `?filter=${filterParts.join(",")}` +
    `&sort=cited_by_count:desc` +
    `&per_page=30` +
    `&page=${page}` +
    `&select=${select}`;

  // Keywords use the search param — free-text over title/abstract/concepts
  if (filters.keywords.length > 0) {
    url += `&search=${encodeURIComponent(filters.keywords.join(" "))}`;
  }

  return url;
}

/** OpenAlex source/venue as returned by the /sources endpoint. */
export interface OpenAlexSource {
  id: string; // full URL, e.g. "https://openalex.org/S137773608"
  display_name: string;
  issn_l: string | null;
  type: string;
  works_count: number;
}

export interface OpenAlexSourcesResponse {
  results: OpenAlexSource[];
  meta: { count: number; page: number; per_page: number };
}
