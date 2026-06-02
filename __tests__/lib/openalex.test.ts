/**
 * Unit tests for lib/openalex.ts — buildOpenAlexUrl and reconstructAbstract.
 * Written for Vitest; run with `npx vitest run` once vitest is installed.
 *
 * The same assertions are also available as a Deno-runnable file at
 * __tests__/lib/openalex.deno_test.ts — used for CI until npm is stable.
 */
import { describe, it, expect } from "vitest";
import { buildOpenAlexUrl, reconstructAbstract } from "../../lib/openalex";
import type { FeedFilters } from "../../lib/openalex";

const BASE_FILTERS: FeedFilters = {
  keywords: [],
  dateRange: "month",
  venues: [],
  workType: "",
  openAccessOnly: false,
};

// ---------------------------------------------------------------------------
// buildOpenAlexUrl
// ---------------------------------------------------------------------------

describe("buildOpenAlexUrl", () => {
  it("always includes a from_publication_date filter", () => {
    const url = buildOpenAlexUrl(BASE_FILTERS);
    expect(url).toContain("from_publication_date:");
  });

  it("defaults to page 1", () => {
    const url = buildOpenAlexUrl(BASE_FILTERS);
    expect(url).toContain("&page=1");
  });

  it("passes an explicit page number", () => {
    const url = buildOpenAlexUrl(BASE_FILTERS, 3);
    expect(url).toContain("&page=3");
  });

  it("adds search param when keywords are provided", () => {
    const url = buildOpenAlexUrl({ ...BASE_FILTERS, keywords: ["machine learning"] });
    // encodeURIComponent encodes spaces as %20
    expect(url).toContain("&search=machine%20learning");
  });

  it("joins multiple keywords with a space", () => {
    const url = buildOpenAlexUrl({ ...BASE_FILTERS, keywords: ["HRI", "robots"] });
    expect(url).toContain("&search=HRI%20robots");
  });

  it("omits search param when keywords are empty", () => {
    const url = buildOpenAlexUrl(BASE_FILTERS);
    expect(url).not.toContain("&search=");
  });

  it("uses primary_location.source.id for venue filtering", () => {
    const url = buildOpenAlexUrl({
      ...BASE_FILTERS,
      venues: [{ name: "Nature", id: "S137773608" }],
    });
    expect(url).toContain("primary_location.source.id:S137773608");
  });

  it("joins multiple venue IDs with a pipe (OR)", () => {
    const url = buildOpenAlexUrl({
      ...BASE_FILTERS,
      venues: [
        { name: "Nature", id: "S137773608" },
        { name: "Science", id: "S3880285" },
      ],
    });
    expect(url).toContain("primary_location.source.id:S137773608|S3880285");
  });

  it("omits venue filter when venues array is empty", () => {
    const url = buildOpenAlexUrl(BASE_FILTERS);
    expect(url).not.toContain("primary_location.source");
  });

  it("does NOT use display_name for venue filtering", () => {
    const url = buildOpenAlexUrl({
      ...BASE_FILTERS,
      venues: [{ name: "Nature", id: "S137773608" }],
    });
    expect(url).not.toContain("display_name");
  });

  it("adds type filter for article workType", () => {
    const url = buildOpenAlexUrl({ ...BASE_FILTERS, workType: "article" });
    expect(url).toContain("type:article");
  });

  it("adds type filter for review workType", () => {
    const url = buildOpenAlexUrl({ ...BASE_FILTERS, workType: "review" });
    expect(url).toContain("type:review");
  });

  it("adds type filter for preprint workType", () => {
    const url = buildOpenAlexUrl({ ...BASE_FILTERS, workType: "preprint" });
    expect(url).toContain("type:preprint");
  });

  it("omits type filter when workType is empty string", () => {
    const url = buildOpenAlexUrl({ ...BASE_FILTERS, workType: "" });
    expect(url).not.toContain("type:");
  });

  it("adds open_access.is_oa:true when openAccessOnly is true", () => {
    const url = buildOpenAlexUrl({ ...BASE_FILTERS, openAccessOnly: true });
    expect(url).toContain("open_access.is_oa:true");
  });

  it("omits open-access filter when openAccessOnly is false", () => {
    const url = buildOpenAlexUrl({ ...BASE_FILTERS, openAccessOnly: false });
    expect(url).not.toContain("open_access.is_oa");
  });

  it("combines venue, workType, OA, and keywords correctly", () => {
    const url = buildOpenAlexUrl({
      keywords: ["climate"],
      dateRange: "year",
      venues: [{ name: "Nature", id: "S137773608" }],
      workType: "article",
      openAccessOnly: true,
    });
    expect(url).toContain("primary_location.source.id:S137773608");
    expect(url).toContain("type:article");
    expect(url).toContain("open_access.is_oa:true");
    expect(url).toContain("&search=climate");
  });

  it("does not double-encode the pipe character in venue OR", () => {
    const url = buildOpenAlexUrl({
      ...BASE_FILTERS,
      venues: [
        { name: "Nature", id: "S137773608" },
        { name: "Science", id: "S3880285" },
      ],
    });
    // %7C would be the encoded form of |
    expect(url).not.toContain("%7C");
    expect(url).toContain("|");
  });

  it("includes a select param listing required fields", () => {
    const url = buildOpenAlexUrl(BASE_FILTERS);
    expect(url).toContain("select=");
    expect(url).toContain("abstract_inverted_index");
    expect(url).toContain("open_access");
  });
});

// ---------------------------------------------------------------------------
// reconstructAbstract
// ---------------------------------------------------------------------------

describe("reconstructAbstract", () => {
  it("returns empty string for null input", () => {
    expect(reconstructAbstract(null)).toBe("");
  });

  it("reconstructs a simple inverted index", () => {
    const result = reconstructAbstract({ Hello: [0], world: [1] });
    expect(result).toBe("Hello world");
  });

  it("handles words that appear at multiple positions", () => {
    const result = reconstructAbstract({ the: [0, 3], cat: [1], sat: [2] });
    expect(result).toBe("the cat sat the");
  });

  it("sorts positions correctly regardless of key order", () => {
    const result = reconstructAbstract({ Z: [2], A: [0], M: [1] });
    expect(result).toBe("A M Z");
  });
});
