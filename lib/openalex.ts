export interface OpenAlexAuthor {
  author: { display_name: string };
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

export interface FeedFilters {
  keywords: string[];
  dateRange: string;
  venues: string[];
}

export function buildOpenAlexUrl(filters: FeedFilters, page = 1): string {
  const base = "https://api.openalex.org/works";
  const filterParts: string[] = ["type:article"];

  const fromDate = (DATE_RANGE_MAP[filters.dateRange] ?? DATE_RANGE_MAP.month)();
  filterParts.push(`from_publication_date:${fromDate}`);

  if (filters.keywords.length > 0) {
    filterParts.push(
      filters.keywords.map((k) => `concepts.display_name:${encodeURIComponent(k)}`).join("|")
    );
  }

  if (filters.venues.length > 0) {
    filterParts.push(
      filters.venues
        .map((v) => `primary_location.source.display_name:${encodeURIComponent(v)}`)
        .join("|")
    );
  }

  const fields = [
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

  const params = new URLSearchParams({
    filter: filterParts.join(","),
    sort: "cited_by_count:desc",
    "per-page": "30",
    page: String(page),
    select: fields,
  });

  return `${base}?${params}`;
}
