import { NextRequest, NextResponse } from "next/server";
import type { OpenAlexSourcesResponse } from "@/lib/openalex";

const UA = "PaperSwipe/2.0 (mailto:contact@paperswipe.app)";
const MAX_RESULTS = 8;

/**
 * Proxy for the OpenAlex /sources endpoint.
 * Used by the venue autocomplete in SettingsPanel so the client never calls
 * the OpenAlex API directly (keeps the User-Agent header server-side).
 *
 * GET /api/openalex/sources?q=<query>
 * Returns: { sources: { id: string; name: string; issn: string | null; type: string }[] }
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ sources: [] });
  }

  const url =
    `https://api.openalex.org/sources` +
    `?search=${encodeURIComponent(q)}` +
    `&per_page=${MAX_RESULTS}` +
    `&select=id,display_name,issn_l,type,works_count` +
    `&sort=works_count:desc`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate: 3600 }, // cache autocomplete results for 1 hour
    });

    if (!res.ok) {
      return NextResponse.json({ sources: [] }, { status: res.status });
    }

    const data: OpenAlexSourcesResponse = await res.json();

    const sources = data.results.map((s) => ({
      // Strip the full URL prefix to get just the bare ID (e.g. "S137773608")
      id: s.id.replace("https://openalex.org/", ""),
      name: s.display_name,
      issn: s.issn_l,
      type: s.type,
    }));

    return NextResponse.json({ sources });
  } catch {
    return NextResponse.json({ sources: [] }, { status: 502 });
  }
}
