import { NextResponse } from "next/server";
import { getRequiredUser } from "@/lib/session";
import { db } from "@/lib/db";
import { buildOpenAlexUrl, reconstructAbstract, OpenAlexResponse } from "@/lib/openalex";

const UA = "PaperSwipe/2.0 (mailto:contact@paperswipe.app)";

export async function GET() {
  const { user, error } = await getRequiredUser();
  if (error) return error;

  // Load user settings and seen IDs in parallel
  const [settings, seenRows] = await Promise.all([
    db.userSettings.findUnique({ where: { userId: user.id } }),
    db.seenPaper.findMany({
      where: { userId: user.id },
      select: { openAlexId: true },
    }),
  ]);

  const seenIds = new Set(seenRows.map((r) => r.openAlexId));

  const filters = {
    keywords: (settings?.filterKeywords as string[]) ?? [],
    dateRange: settings?.filterDateRange ?? "month",
    venues: (settings?.filterVenues as string[]) ?? [],
  };

  // Fetch up to 2 pages to fill a batch of 30 after excluding seen papers
  let results: ReturnType<typeof normalise>[] = [];
  let page = 1;

  while (results.length < 30 && page <= 3) {
    const url = buildOpenAlexUrl(filters, page);
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate: 300 }, // cache per-edge for 5 min
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
