import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildOpenAlexUrl, reconstructAbstract, OpenAlexResponse } from "@/lib/openalex";

const UA = "PaperSwipe/2.0 (mailto:contact@paperswipe.app)";

import type { FeedFilters, VenueFilter } from "@/lib/openalex";

const DEFAULT_FILTERS: FeedFilters = {
  keywords: [],
  dateRange: "month",
  venues: [],
  workType: "",
  openAccessOnly: false,
};

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(req.url);

  let filters: FeedFilters = DEFAULT_FILTERS;
  let seenIds = new Set<string>();

  if (session?.user?.id) {
    const [settings, seenRows] = await Promise.all([
      db.userSettings.findUnique({ where: { userId: session.user.id } }),
      db.seenPaper.findMany({
        where: { userId: session.user.id },
        select: { openAlexId: true },
      }),
    ]);

    // keywords / dateRange / venues come from DB settings
    // workType and openAccessOnly have no DB column yet — read from query params
    // so the client-side session overrides always apply, even for auth users.
    const dbWorkType = (searchParams.get("workType") ?? "") as FeedFilters["workType"];
    const dbOAOnly = searchParams.get("openAccessOnly") === "true";

    filters = {
      keywords: (settings?.filterKeywords as string[]) ?? [],
      dateRange: settings?.filterDateRange ?? "month",
      venues: (settings?.filterVenues as VenueFilter[]) ?? [],
      workType: dbWorkType,
      openAccessOnly: dbOAOnly,
    };

    seenIds = new Set(seenRows.map((r) => r.openAlexId));
  } else {
    // Guest: read filters from query params
    const keywords = searchParams.getAll("keyword").filter(Boolean);
    const dateRange = searchParams.get("dateRange") ?? "month";
    // Venues are passed as "venueId:NAME|ID" pairs
    const venueParams = searchParams.getAll("venue").filter(Boolean);
    const venues: VenueFilter[] = venueParams.map((v) => {
      const sep = v.indexOf("|");
      return sep > -1
        ? { name: v.slice(0, sep), id: v.slice(sep + 1) }
        : { name: v, id: v };
    });
    const workType = (searchParams.get("workType") ?? "") as FeedFilters["workType"];
    const openAccessOnly = searchParams.get("openAccessOnly") === "true";
    if (
      keywords.length ||
      venues.length ||
      dateRange !== "month" ||
      workType ||
      openAccessOnly
    ) {
      filters = { keywords, dateRange, venues, workType, openAccessOnly };
    }
  }

  let results: ReturnType<typeof normalise>[] = [];
  let page = 1;

  while (results.length < 30 && page <= 3) {
    const url = buildOpenAlexUrl(filters, page);
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate: 300 },
    });

    if (!res.ok) break;

    const data: OpenAlexResponse = await res.json();
    if (data.results.length === 0) break;

    const fresh = data.results
      .filter((w) => !seenIds.has(w.id))
      .map(normalise);

    results = results.concat(fresh);
    page++;
  }

  return NextResponse.json({ papers: results.slice(0, 30) });
}

function normalise(work: OpenAlexResponse["results"][number]) {
  return {
    id: work.id,
    title: work.title ?? "Untitled",
    authors: work.authorships.map((a) => a.author.display_name),
    authorships: work.authorships.map((a) => ({
      name: a.author.display_name,
      orcid: a.author.orcid ?? null,
    })),
    year: work.publication_year,
    venue: work.primary_location?.source?.display_name ?? null,
    isOA: work.open_access?.is_oa ?? work.primary_location?.source?.is_oa ?? false,
    abstract: reconstructAbstract(work.abstract_inverted_index),
    citedByCount: work.cited_by_count,
    doi: work.doi,
    concepts: work.concepts.slice(0, 5).map((c) => c.display_name),
  };
}

export type Paper = ReturnType<typeof normalise>;
